import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import { distanceInMeters } from "@/lib/attendance-utils";
import { getRedis, invalidateCache } from "@/lib/redis";

const proofSchema = z.object({
  challengeId: z.string().min(8),
  expectedHz: z.number(),
  observedHz: z.number(),
  detectedAt: z.number(),
});

const markSchema = z.object({
  sessionId: z.uuid(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracy: z.number().min(0).max(10_000).optional(),
  proofs: z.array(proofSchema).max(12).optional(),
});

type Challenge = {
  id: string;
  frequency: number;
  emittedAt: number;
};

declare global {
  var __classpulseChallenges: Map<string, Challenge[]> | undefined;
}

export async function POST(request: Request) {
  const profile = await requireProfile();
  if (profile.role !== "STUDENT" || !profile.student) {
    return NextResponse.json({ error: "Student access required." }, { status: 403 });
  }

  const parsed = markSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Attendance evidence is incomplete." }, { status: 400 });
  }

  const session = await db.attendanceSession.findUnique({
    where: { id: parsed.data.sessionId },
    include: {
      classroom: {
        include: {
          enrollments: {
            where: { studentId: profile.student.id },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!session || session.status !== "ACTIVE" || session.endsAt <= new Date()) {
    return NextResponse.json({ error: "This attendance session has ended." }, { status: 410 });
  }
  if (session.classroom.enrollments.length === 0) {
    return NextResponse.json({ error: "You are not enrolled in this classroom." }, { status: 403 });
  }

  const existing = await db.attendanceRecord.findUnique({
    where: {
      sessionId_studentId: {
        sessionId: session.id,
        studentId: profile.student.id,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Attendance is already marked for this session." }, { status: 409 });
  }

  let distanceMeters: number | null = null;
  let confidence: number | null = null;
  let evidence: Record<string, unknown>;

  if (session.method === "GEOLOCATION") {
    const { latitude, longitude, accuracy } = parsed.data;
    if (
      latitude === undefined ||
      longitude === undefined ||
      session.latitude === null ||
      session.longitude === null ||
      session.radiusMeters === null
    ) {
      return NextResponse.json({ error: "A precise location reading is required." }, { status: 400 });
    }

    distanceMeters = distanceInMeters(
      session.latitude,
      session.longitude,
      latitude,
      longitude,
    );
    if (distanceMeters > session.radiusMeters) {
      return NextResponse.json(
        {
          error: `You are ${Math.round(distanceMeters)} m from the classroom. The allowed radius is ${session.radiusMeters} m.`,
        },
        { status: 422 },
      );
    }
    confidence = Math.max(0, Math.min(1, 1 - distanceMeters / session.radiusMeters));
    evidence = { accuracyMeters: accuracy ?? null };
  } else {
    const redis = await getRedis();
    const cached = redis?.isReady
      ? await redis.get(`attendance:challenges:${session.id}`)
      : null;
    const challenges: Challenge[] = cached
      ? JSON.parse(cached)
      : globalThis.__classpulseChallenges?.get(session.id) ?? [];
    const proofs = parsed.data.proofs ?? [];
    const uniqueIds = new Set<string>();
    const matches = proofs.filter((proof) => {
      if (uniqueIds.has(proof.challengeId)) return false;
      uniqueIds.add(proof.challengeId);
      const challenge = challenges.find((item) => item.id === proof.challengeId);
      return Boolean(
        challenge &&
          challenge.frequency === proof.expectedHz &&
          Math.abs(proof.observedHz - challenge.frequency) <= 90 &&
          Math.abs(proof.detectedAt - challenge.emittedAt) <= 2_600,
      );
    });
    const required = session.minFrequencyMatches ?? 4;
    if (matches.length < required) {
      return NextResponse.json(
        {
          error: `Only ${matches.length} of ${required} live tones were verified. Keep the microphone near the classroom audio and try again.`,
        },
        { status: 422 },
      );
    }
    const averageDelta =
      matches.reduce(
        (sum, proof) => sum + Math.abs(proof.observedHz - proof.expectedHz),
        0,
      ) / matches.length;
    confidence = Math.max(0, 1 - averageDelta / 90);
    evidence = {
      matchedChallenges: matches.map((proof) => proof.challengeId),
      averageFrequencyDeltaHz: Math.round(averageDelta),
    };
  }

  const record = await db.attendanceRecord.create({
    data: {
      sessionId: session.id,
      studentId: profile.student.id,
      method: session.method,
      confidence,
      distanceMeters,
      evidence: evidence as Prisma.InputJsonValue,
    },
  });

  await invalidateCache(
    `dashboard:student:${profile.student.id}`,
    `dashboard:teacher:${session.classroom.teacherId}`,
  );
  return NextResponse.json({ record }, { status: 201 });
}
