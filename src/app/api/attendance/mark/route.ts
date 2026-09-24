import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import {
  appendAttendanceEventTx,
  auditActorId,
} from "@/lib/audit";
import { distanceInMeters } from "@/lib/attendance-utils";
import { requireProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import {
  hashPresenceProof,
  loadAcousticChallenge,
  scoreAcousticProofs,
  type AcousticProof,
} from "@/lib/presence-proof";
import { consumeRateLimit } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { authenticationOptions } from "@/lib/webauthn";
import { AttendanceConflict, lockActiveAttendance } from "@/lib/attendance-transaction";

const proofSchema = z.object({
  challengeId: z.string().min(12).max(64),
  observedHz: z.number().min(14_000).max(22_000),
  detectedAt: z.number().int().positive(),
  signalToNoiseDb: z.number().min(-20).max(120),
  amplitude: z.number().min(0).max(10),
});

const markSchema = z.object({
  sessionId: z.uuid(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).max(10_000).optional(),
  proofs: z.array(proofSchema).max(16).optional(),
});

type ValidatedEvidence = {
  confidence: number;
  distanceMeters: number | null;
  evidence: Prisma.InputJsonObject;
  proofHash: string;
};

export async function POST(request: Request) {
  try {
    return await markAttendance(request);
  } catch (error) {
    if (error instanceof AttendanceConflict) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

async function markAttendance(request: Request) {
  const profile = await requireProfile();
  if (profile.role !== "STUDENT" || !profile.student) {
    return NextResponse.json(
      { error: "Student access required." },
      { status: 403 },
    );
  }

  const rate = await consumeRateLimit({
    key: `attendance-proof:${profile.student.id}`,
    limit: 8,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many verification attempts. Wait before trying again." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const parsed = markSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Attendance evidence is incomplete." },
      { status: 400 },
    );
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
  if (
    !session ||
    session.status !== "ACTIVE" ||
    session.endsAt <= new Date()
  ) {
    return NextResponse.json(
      { error: "This attendance session has ended." },
      { status: 410 },
    );
  }
  if (session.classroom.enrollments.length === 0) {
    return NextResponse.json(
      { error: "You are not enrolled in this classroom." },
      { status: 403 },
    );
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
    return NextResponse.json(
      { error: "Attendance is already marked for this session." },
      { status: 409 },
    );
  }

  const validated =
    session.method === "GEOLOCATION"
      ? validateLocationEvidence(session, parsed.data)
      : await validateAcousticEvidence(
          session.id,
          session.minFrequencyMatches ?? 4,
          parsed.data.proofs ?? [],
        );
  if ("error" in validated) {
    return NextResponse.json(
      { error: validated.error },
      { status: validated.status },
    );
  }

  const passkeys = await db.passkeyCredential.findMany({
    where: { userId: profile.id },
  });
  if (
    profile.attendancePasskeyRequired &&
    passkeys.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Your account requires a registered attendance passkey. Restore or register a device before checking in.",
      },
      { status: 409 },
    );
  }
  const expiresAt = new Date(
    Math.min(session.endsAt.getTime(), Date.now() + 60_000),
  );

  if (passkeys.length > 0) {
    const options = await authenticationOptions(request, passkeys);
    const verification = await db.$transaction(async (tx) => {
      await lockActiveAttendance(tx, session.id, profile.student!.id);
      if (await tx.attendanceRecord.findUnique({ where: {
        sessionId_studentId: { sessionId: session.id, studentId: profile.student!.id },
      } })) throw new AttendanceConflict("Attendance is already marked for this session.");
      const pending = await tx.presenceVerification.upsert({
        where: {
          sessionId_studentId: {
            sessionId: session.id,
            studentId: profile.student!.id,
          },
        },
        update: {
          method: session.method,
          status: "PENDING_DEVICE",
          proofHash: validated.proofHash,
          confidence: validated.confidence,
          distanceMeters: validated.distanceMeters,
          evidence: validated.evidence,
          webAuthnChallenge: options.challenge,
          credentialId: null,
          expiresAt,
          verifiedAt: null,
        },
        create: {
          sessionId: session.id,
          studentId: profile.student!.id,
          method: session.method,
          proofHash: validated.proofHash,
          confidence: validated.confidence,
          distanceMeters: validated.distanceMeters,
          evidence: validated.evidence,
          webAuthnChallenge: options.challenge,
          expiresAt,
        },
      });
      await appendAttendanceEventTx(tx, {
        sessionId: session.id,
        type: "PROOF_ACCEPTED",
        actorId: auditActorId(profile.id),
        payload: {
          verificationId: pending.id,
          method: session.method,
          proofHash: validated.proofHash,
          confidence: Number(validated.confidence.toFixed(4)),
          deviceConfirmationRequired: true,
        },
      });
      return pending;
    });

    return NextResponse.json(
      {
        requiresPasskey: true,
        verificationId: verification.id,
        authenticationOptions: options,
        assurance: {
          presence: "verified",
          device: "pending",
          score: validated.confidence,
        },
      },
      { status: 202 },
    );
  }

  const record = await db.$transaction(async (tx) => {
    await lockActiveAttendance(tx, session.id, profile.student!.id);
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${profile.id} FOR UPDATE`;
    const security = await tx.user.findUnique({ where: { id: profile.id }, select: { attendancePasskeyRequired: true } });
    if (security?.attendancePasskeyRequired) {
      throw new AttendanceConflict("Account security changed. Capture presence again to confirm with your passkey.");
    }
    const existing = await tx.attendanceRecord.findUnique({ where: {
      sessionId_studentId: { sessionId: session.id, studentId: profile.student!.id },
    } });
    if (existing) return existing;
    const verification = await tx.presenceVerification.upsert({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId: profile.student!.id,
        },
      },
      update: {
        method: session.method,
        status: "VERIFIED",
        proofHash: validated.proofHash,
        confidence: validated.confidence,
        distanceMeters: validated.distanceMeters,
        evidence: validated.evidence,
        webAuthnChallenge: null,
        credentialId: null,
        expiresAt,
        verifiedAt: new Date(),
      },
      create: {
        sessionId: session.id,
        studentId: profile.student!.id,
        method: session.method,
        status: "VERIFIED",
        proofHash: validated.proofHash,
        confidence: validated.confidence,
        distanceMeters: validated.distanceMeters,
        evidence: validated.evidence,
        expiresAt,
        verifiedAt: new Date(),
      },
    });
    await appendAttendanceEventTx(tx, {
      sessionId: session.id,
      type: "PROOF_ACCEPTED",
      actorId: auditActorId(profile.id),
      payload: {
        verificationId: verification.id,
        method: session.method,
        proofHash: validated.proofHash,
        confidence: Number(validated.confidence.toFixed(4)),
        deviceConfirmationRequired: false,
      },
    });
    const created = await tx.attendanceRecord.create({
      data: {
        sessionId: session.id,
        studentId: profile.student!.id,
        method: session.method,
        confidence: validated.confidence,
        distanceMeters: validated.distanceMeters,
        deviceVerified: false,
        proofHash: validated.proofHash,
        evidence: {
          ...validated.evidence,
          verificationId: verification.id,
          deviceBound: false,
        },
      },
    });
    await appendAttendanceEventTx(tx, {
      sessionId: session.id,
      type: "ATTENDANCE_RECORDED",
      actorId: auditActorId(profile.id),
      payload: {
        recordId: created.id,
        verificationId: verification.id,
        proofHash: validated.proofHash,
        deviceVerified: false,
      },
    });
    return created;
  });

  await invalidateCache(
    `dashboard:student:${profile.student.id}`,
    `dashboard:teacher:${session.classroom.teacherId}`,
  );
  return NextResponse.json(
    {
      record,
      requiresPasskey: false,
      assurance: {
        presence: "verified",
        device: "not-registered",
        score: validated.confidence,
      },
    },
    { status: 201 },
  );
}

function validateLocationEvidence(
  session: {
    latitude: number | null;
    longitude: number | null;
    radiusMeters: number | null;
  },
  data: z.infer<typeof markSchema>,
): ValidatedEvidence | { error: string; status: number } {
  const { latitude, longitude, accuracy } = data;
  if (
    latitude === undefined ||
    longitude === undefined ||
    session.latitude === null ||
    session.longitude === null ||
    session.radiusMeters === null
  ) {
    return {
      error: "A fresh location reading is required.",
      status: 400,
    };
  }
  if ((accuracy ?? 10_000) > Math.max(120, session.radiusMeters * 2)) {
    return {
      error:
        "Location accuracy is too low for this classroom. Move near a window and try again.",
      status: 422,
    };
  }
  const distanceMeters = distanceInMeters(
    session.latitude,
    session.longitude,
    latitude,
    longitude,
  );
  const uncertaintyAllowance = Math.min(30, accuracy ?? 0);
  if (distanceMeters > session.radiusMeters + uncertaintyAllowance) {
    return {
      error: `You are ${Math.round(distanceMeters)} m from the classroom. The allowed radius is ${session.radiusMeters} m.`,
      status: 422,
    };
  }
  const confidence = Math.max(
    0,
    Math.min(
      1,
      1 -
        distanceMeters / Math.max(1, session.radiusMeters) -
        (accuracy ?? 0) / 300,
    ),
  );
  const evidence = {
    protocolVersion: 2,
    kind: "geolocation",
    accuracyMeters: Math.round((accuracy ?? 0) * 10) / 10,
    distanceMeters: Math.round(distanceMeters * 10) / 10,
    radiusMeters: session.radiusMeters,
  } satisfies Prisma.InputJsonObject;
  return {
    confidence,
    distanceMeters,
    evidence,
    proofHash: hashPresenceProof(evidence),
  };
}

async function validateAcousticEvidence(
  sessionId: string,
  required: number,
  proofs: AcousticProof[],
): Promise<ValidatedEvidence | { error: string; status: number }> {
  const receivedAt = Date.now();
  const unique = new Map(
    proofs.map((proof) => [proof.challengeId, proof]),
  );
  const candidates = await Promise.all(
    [...unique.values()].map(async (proof) => ({
      proof,
      challenge: await loadAcousticChallenge(
        sessionId,
        proof.challengeId,
      ),
    })),
  );
  const matches = candidates
    .filter(
      (
        item,
      ): item is {
        proof: AcousticProof;
        challenge: NonNullable<typeof item.challenge>;
      } => {
        if (!item.challenge) return false;
        const frequencyDelta = Math.abs(
          item.proof.observedHz - item.challenge.frequency,
        );
        const timingDelta = Math.abs(
          item.proof.detectedAt - item.challenge.emittedAt,
        );
        return (
          frequencyDelta <= 95 &&
          timingDelta <= item.challenge.durationMs + 1_200 &&
          item.challenge.emittedAt >= receivedAt - 20_000 &&
          item.challenge.emittedAt <= receivedAt + 2_000 &&
          item.proof.signalToNoiseDb >= 4.5 &&
          item.proof.amplitude >= 0.00035
        );
      },
    )
    .sort(
      (left, right) =>
        left.challenge.emittedAt - right.challenge.emittedAt,
    )
    .slice(0, 12);

  if (matches.length < required) {
    return {
      error: `Only ${matches.length} of ${required} hidden acoustic challenges were verified. Keep the microphone near the classroom speaker and try again.`,
      status: 422,
    };
  }
  const newestMatches = matches.slice(-Math.max(required, 8));
  const sequenceSpan =
    newestMatches.at(-1)!.challenge.emittedAt -
    newestMatches[0].challenge.emittedAt;
  const hasLargeGap = newestMatches.some(
    (item, index) =>
      index > 0 &&
      item.challenge.emittedAt -
        newestMatches[index - 1].challenge.emittedAt >
        4_000,
  );
  if (sequenceSpan > 15_000 || hasLargeGap) {
    return {
      error:
        "The acoustic proof was not a continuous live sequence. Listen again without leaving the session.",
      status: 422,
    };
  }

  const confidence = scoreAcousticProofs(newestMatches);
  const evidence = {
    protocolVersion: 2,
    kind: "server-hidden-frequency-hopping",
    matchedChallenges: newestMatches.map(
      ({ proof }) => proof.challengeId,
    ),
    averageFrequencyDeltaHz:
      Math.round(
        (newestMatches.reduce(
          (sum, { proof, challenge }) =>
            sum + Math.abs(proof.observedHz - challenge.frequency),
          0,
        ) /
          newestMatches.length) *
          10,
      ) / 10,
    averageSignalToNoiseDb:
      Math.round(
        (newestMatches.reduce(
          (sum, { proof }) => sum + proof.signalToNoiseDb,
          0,
        ) /
          newestMatches.length) *
          10,
      ) / 10,
    observedSequence: newestMatches.map(({ proof }) => ({
      challengeId: proof.challengeId,
      observedHz: Math.round(proof.observedHz),
      detectedAt: proof.detectedAt,
    })),
  } satisfies Prisma.InputJsonObject;
  return {
    confidence,
    distanceMeters: null,
    evidence,
    proofHash: hashPresenceProof(evidence),
  };
}
