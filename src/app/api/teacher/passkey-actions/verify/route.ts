import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { appendAttendanceEventTx, auditActorId, signTeacherApproval } from "@/lib/audit";
import { sha256Hex } from "@/lib/audit-core.js";
import { requireRole } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { invalidateCache } from "@/lib/redis";
import { verifyUserPasskey, webAuthnConfig } from "@/lib/webauthn";
import { matchesTeacherActionChallenge } from "@/lib/teacher-action-challenge";

const requestSchema = z.object({ ceremonyId: z.uuid(), response: z.record(z.string(), z.unknown()) });
const correctionSchema = z.object({
  action: z.literal("CORRECT_ATTENDANCE"),
  sessionId: z.uuid(), studentId: z.uuid(), present: z.boolean(), reason: z.string().min(8).max(500),
});
const signSchema = z.object({ action: z.literal("SIGN_REPORT"), reportId: z.uuid(), reportHash: z.string() });

export async function POST(request: Request) {
  const profile = await requireRole("TEACHER");
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The passkey response is incomplete." }, { status: 400 });
  const ceremony = await db.webAuthnCeremony.findFirst({
    where: { id: parsed.data.ceremonyId, userId: profile.id, type: "TEACHER_ACTION", authorizedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!ceremony) return NextResponse.json({ error: "This confirmation expired. Start again." }, { status: 410 });
  const correction = ceremony.purpose === "CORRECT_ATTENDANCE" ? correctionSchema.safeParse(ceremony.payload) : null;
  const signing = ceremony.purpose === "SIGN_REPORT" ? signSchema.safeParse(ceremony.payload) : null;
  if ((!correction?.success && !signing?.success) || !ceremony.payload) {
    return NextResponse.json({ error: "The action details are invalid." }, { status: 400 });
  }
  if (!matchesTeacherActionChallenge(ceremony.challenge, ceremony.payload)) {
    return NextResponse.json({ error: "The action confirmation no longer matches its details." }, { status: 409 });
  }

  try {
    const assertion = parsed.data.response as unknown as AuthenticationResponseJSON;
    const { passkey, verification } = await verifyUserPasskey({
      request, userId: profile.id, expectedChallenge: ceremony.challenge, response: assertion,
    });
    let affectedStudentId: string | null = null;
    await db.$transaction(async (tx) => {
      const consumed = await tx.webAuthnCeremony.updateMany({
        where: { id: ceremony.id, userId: profile.id, type: "TEACHER_ACTION", authorizedAt: null, expiresAt: { gt: new Date() } },
        data: { authorizedAt: new Date() },
      });
      if (consumed.count !== 1) throw new Error("This confirmation was already used or expired.");

      const updatedCredential = await tx.passkeyCredential.updateMany({
        where: { id: passkey.id, userId: profile.id, counter: passkey.counter },
        data: {
          counter: BigInt(verification.authenticationInfo.newCounter),
          backedUp: verification.authenticationInfo.credentialBackedUp,
          deviceType: verification.authenticationInfo.credentialDeviceType,
          lastUsedAt: new Date(),
        },
      });
      if (updatedCredential.count !== 1) throw new Error("Your passkey changed. Confirm the action again.");

      if (correction?.success) {
        const action = correction.data;
        await tx.$queryRaw`SELECT "id" FROM "AttendanceSession" WHERE "id" = ${action.sessionId} FOR UPDATE`;
        const session = await tx.attendanceSession.findFirst({
          where: { id: action.sessionId, classroom: { teacherId: profile.teacher!.id }, status: "ACTIVE", endsAt: { gt: new Date() }, report: null },
          select: { id: true, classroomId: true, method: true },
        });
        const enrolled = session && await tx.enrollment.findUnique({
          where: { studentId_classroomId: { studentId: action.studentId, classroomId: session.classroomId } }, select: { id: true },
        });
        if (!session || !enrolled) throw new Error("This session closed or the student is no longer enrolled. No correction was made.");
        const existing = await tx.attendanceRecord.findUnique({
          where: { sessionId_studentId: { sessionId: session.id, studentId: action.studentId } },
        });
        if (Boolean(existing) === action.present) throw new Error("Attendance already has that status; no correction was needed.");
        const correctionRecord = await tx.attendanceCorrection.create({
          data: {
            sessionId: session.id, studentId: action.studentId, teacherUserId: profile.id,
            present: action.present, reason: action.reason, credentialId: passkey.id,
          },
        });
        if (action.present) {
          await tx.attendanceRecord.create({
            data: {
              sessionId: session.id, studentId: action.studentId, method: session.method,
              status: "PRESENT", deviceVerified: false,
              evidence: { source: "TEACHER_CORRECTION", correctionId: correctionRecord.id },
            },
          });
        } else {
          await tx.attendanceRecord.delete({ where: { id: existing!.id } });
        }
        await appendAttendanceEventTx(tx, {
          sessionId: session.id, type: "ATTENDANCE_CORRECTED", actorId: auditActorId(profile.id),
          payload: {
            correctionId: correctionRecord.id, studentRef: sha256Hex(action.studentId).slice(0, 20),
            previous: Boolean(existing), present: action.present,
            reasonHash: sha256Hex(action.reason), credentialFingerprint: sha256Hex(passkey.id).slice(0, 20),
          },
        });
        affectedStudentId = action.studentId;
      } else if (signing?.success) {
        const action = signing.data;
        const report = await tx.attendanceReport.findFirst({
          where: { id: action.reportId, payloadHash: action.reportHash, session: { classroom: { teacherId: profile.teacher!.id }, status: "CLOSED" }, teacherAttestation: null },
          select: { id: true },
        });
        if (!report) throw new Error("This report changed or has already been signed.");
        const { origin, rpID } = webAuthnConfig(request);
        const signedAt = new Date();
        const serverSignature = signTeacherApproval({
          reportId: report.id, reportHash: action.reportHash,
          teacherUserId: profile.id, credentialId: passkey.id,
          publicKeyHash: sha256Hex(passkey.publicKey),
          challenge: ceremony.challenge, origin, rpId: rpID,
          counterBefore: String(passkey.counter), signedAt: signedAt.toISOString(),
        });
        await tx.teacherReportAttestation.create({
          data: {
            reportId: report.id, teacherUserId: profile.id, credentialId: passkey.id,
            publicKey: passkey.publicKey, counterBefore: passkey.counter,
            challenge: ceremony.challenge, reportHash: action.reportHash, origin, rpId: rpID,
            assertion: assertion as unknown as Prisma.InputJsonObject,
            serverSignature, signedAt,
          },
        });
      }
      await tx.webAuthnCeremony.delete({ where: { id: ceremony.id } });
    }, { maxWait: 10_000, timeout: 20_000 });
    if (affectedStudentId) await invalidateCache(`dashboard:student:${affectedStudentId}`, `dashboard:teacher:${profile.teacher!.id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Passkey confirmation failed." }, { status: 409 });
  }
}
