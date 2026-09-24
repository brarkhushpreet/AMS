import type { Prisma } from "@/generated/prisma/client";

export class AttendanceConflict extends Error {
  constructor(message: string, public status = 409) {
    super(message);
  }
}

export async function closeAttendance(tx: Prisma.TransactionClient, sessionId: string, closedAt = new Date()) {
  await tx.$queryRaw`SELECT "id" FROM "AttendanceSession" WHERE "id" = ${sessionId} FOR UPDATE`;
  return tx.attendanceSession.updateMany({
    where: { id: sessionId, status: "ACTIVE" },
    data: { status: "CLOSED", endsAt: closedAt },
  });
}

// All proof writes, finalization, closure and sealing take this same row lock.
// Re-read authorization and lifecycle state after waiting for the lock.
export async function lockActiveAttendance(
  tx: Prisma.TransactionClient,
  sessionId: string,
  studentId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "AttendanceSession" WHERE "id" = ${sessionId} FOR UPDATE`;
  const session = await tx.attendanceSession.findUnique({
    where: { id: sessionId },
    include: { report: { select: { id: true } } },
  });
  if (!session || session.status !== "ACTIVE" || session.endsAt <= new Date() || session.report) {
    throw new AttendanceConflict("This attendance session has ended.", 410);
  }
  const enrollment = await tx.enrollment.findUnique({
    where: { studentId_classroomId: { studentId, classroomId: session.classroomId } },
  });
  if (!enrollment) throw new AttendanceConflict("You are not enrolled in this classroom.", 403);
  return session;
}

export async function consumePresenceProof(
  tx: Prisma.TransactionClient,
  input: { id: string; studentId: string; challenge: string; proofHash: string; credentialId: string },
) {
  const consumed = await tx.presenceVerification.updateMany({
    where: {
      id: input.id,
      studentId: input.studentId,
      status: "PENDING_DEVICE",
      webAuthnChallenge: input.challenge,
      proofHash: input.proofHash,
      expiresAt: { gt: new Date() },
    },
    data: {
      status: "VERIFIED",
      credentialId: input.credentialId,
      webAuthnChallenge: null,
      verifiedAt: new Date(),
    },
  });
  if (consumed.count !== 1) {
    throw new AttendanceConflict("This proof was replaced, expired, or already used. Capture presence again.");
  }
}
