import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import {
  appendAttendanceEventTx,
  auditActorId,
  sha256Hex,
} from "@/lib/audit";
import { requireProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { invalidateCache } from "@/lib/redis";
import { verifyUserPasskey } from "@/lib/webauthn";
import { AttendanceConflict, consumePresenceProof, lockActiveAttendance } from "@/lib/attendance-transaction";

const schema = z.object({
  verificationId: z.uuid(),
  response: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const profile = await requireProfile();
  if (profile.role !== "STUDENT" || !profile.student) {
    return NextResponse.json(
      { error: "Student access required." },
      { status: 403 },
    );
  }
  const rate = await consumeRateLimit({
    key: `attendance-device:${profile.student.id}`,
    limit: 6,
    windowSeconds: 120,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many device verification attempts." },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "The device assertion is incomplete." },
      { status: 400 },
    );
  }

  const response = parsed.data
    .response as unknown as AuthenticationResponseJSON;
  const verification = await db.presenceVerification.findFirst({
    where: {
      id: parsed.data.verificationId,
      studentId: profile.student.id,
      status: "PENDING_DEVICE",
    },
    include: {
      session: {
        include: {
          classroom: { select: { teacherId: true } },
        },
      },
    },
  });
  if (
    !verification ||
    verification.expiresAt <= new Date() ||
    !verification.webAuthnChallenge ||
    verification.session.status !== "ACTIVE" ||
    verification.session.endsAt <= new Date()
  ) {
    if (verification) {
      await db.presenceVerification.updateMany({
        where: { id: verification.id, status: "PENDING_DEVICE", webAuthnChallenge: verification.webAuthnChallenge },
        data: { status: "EXPIRED" },
      });
    }
    return NextResponse.json(
      { error: "The device confirmation expired. Capture presence again." },
      { status: 410 },
    );
  }

  try {
    const {
      passkey,
      verification: result,
    } = await verifyUserPasskey({
      request,
      userId: profile.id,
      expectedChallenge: verification.webAuthnChallenge,
      response,
    });

    const record = await db.$transaction(async (tx) => {
      await lockActiveAttendance(tx, verification.sessionId, profile.student!.id);
      const current = await tx.presenceVerification.findUnique({
        where: { id: verification.id },
      });
      if (
        !current ||
        current.status !== "PENDING_DEVICE" ||
        current.expiresAt <= new Date()
      ) {
        throw new Error("This verification has already been consumed.");
      }
      const existing = await tx.attendanceRecord.findUnique({
        where: {
          sessionId_studentId: {
            sessionId: current.sessionId,
            studentId: current.studentId,
          },
        },
      });
      if (existing) throw new AttendanceConflict("Attendance has already been confirmed.");

      await consumePresenceProof(tx, {
        id: verification.id,
        studentId: profile.student!.id,
        challenge: verification.webAuthnChallenge!,
        proofHash: verification.proofHash,
        credentialId: passkey.id,
      });

      const updatedCredential = await tx.passkeyCredential.updateMany({
        where: { id: passkey.id, userId: profile.id, counter: passkey.counter },
        data: {
          counter: BigInt(result.authenticationInfo.newCounter),
          backedUp:
            result.authenticationInfo.credentialBackedUp,
          deviceType:
            result.authenticationInfo.credentialDeviceType,
          lastUsedAt: new Date(),
        },
      });
      if (updatedCredential.count !== 1) throw new AttendanceConflict("Your passkey changed. Confirm attendance again.");
      await appendAttendanceEventTx(tx, {
        sessionId: current.sessionId,
        type: "DEVICE_VERIFIED",
        actorId: auditActorId(profile.id),
        payload: {
          verificationId: current.id,
          credentialFingerprint: sha256Hex(passkey.id).slice(
            0,
            20,
          ),
          userVerified: result.authenticationInfo.userVerified,
        },
      });
      const created = await tx.attendanceRecord.create({
        data: {
          sessionId: current.sessionId,
          studentId: current.studentId,
          method: current.method,
          confidence: current.confidence,
          distanceMeters: current.distanceMeters,
          deviceVerified: true,
          proofHash: current.proofHash,
          evidence: {
            ...(current.evidence as Prisma.InputJsonObject),
            verificationId: current.id,
            deviceBound: result.authenticationInfo.credentialDeviceType === "singleDevice",
            assurance: "PASSKEY_CONFIRMED",
            credentialDeviceType: result.authenticationInfo.credentialDeviceType,
            credentialBackedUp: result.authenticationInfo.credentialBackedUp,
            credentialFingerprint: sha256Hex(passkey.id).slice(
              0,
              20,
            ),
          },
        },
      });
      await appendAttendanceEventTx(tx, {
        sessionId: current.sessionId,
        type: "ATTENDANCE_RECORDED",
        actorId: auditActorId(profile.id),
        payload: {
          recordId: created.id,
          verificationId: current.id,
          proofHash: current.proofHash,
          deviceVerified: true,
        },
      });
      return created;
    });

    await invalidateCache(
      `dashboard:student:${profile.student.id}`,
      `dashboard:teacher:${verification.session.classroom.teacherId}`,
    );
    return NextResponse.json({
      record,
      assurance: {
        presence: "verified",
        device: "verified",
        score: verification.confidence,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Device confirmation failed.";
    return NextResponse.json({ error: message }, { status: error instanceof AttendanceConflict ? error.status : 400 });
  }
}
