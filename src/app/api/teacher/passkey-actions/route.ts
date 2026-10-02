import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/current-profile";
import { consumeRateLimit } from "@/lib/rate-limit";
import { authenticationOptions } from "@/lib/webauthn";
import { makeTeacherActionChallenge } from "@/lib/teacher-action-challenge";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CORRECT_ATTENDANCE"),
    sessionId: z.uuid(),
    studentId: z.uuid(),
    present: z.boolean(),
    reason: z.string().trim().min(8).max(500),
  }),
  z.object({
    action: z.literal("SIGN_REPORT"),
    reportId: z.uuid(),
  }),
]);

export async function POST(request: Request) {
  const profile = await requireRole("TEACHER");
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the action details and reason." }, { status: 400 });
  const rate = await consumeRateLimit({ key: `teacher-passkey:${profile.id}`, limit: 8, windowSeconds: 300 });
  if (!rate.allowed) return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });

  const passkeys = await db.passkeyCredential.findMany({ where: { userId: profile.id } });
  if (!passkeys.length) return NextResponse.json({ error: "Register a teacher passkey in Device security first." }, { status: 409 });

  const action = parsed.data;
  let payload: Record<string, string | boolean>;
  if (action.action === "CORRECT_ATTENDANCE") {
    const session = await db.attendanceSession.findFirst({
      where: { id: action.sessionId, classroom: { teacherId: profile.teacher!.id }, status: "ACTIVE", endsAt: { gt: new Date() }, report: null },
      select: { id: true, classroomId: true },
    });
    const enrollment = session && await db.enrollment.findUnique({ where: { studentId_classroomId: { studentId: action.studentId, classroomId: session.classroomId } }, select: { id: true } });
    if (!session || !enrollment) return NextResponse.json({ error: "Corrections are available only for enrolled students in a live, unsealed session." }, { status: 409 });
    payload = action;
  } else {
    const report = await db.attendanceReport.findFirst({
      where: { id: action.reportId, session: { classroom: { teacherId: profile.teacher!.id }, status: "CLOSED" }, teacherAttestation: null },
      select: { id: true, payloadHash: true },
    });
    if (!report) return NextResponse.json({ error: "This closed report is unavailable or already signed by its teacher." }, { status: 409 });
    payload = { action: action.action, reportId: report.id, reportHash: report.payloadHash };
  }

  // The authenticator signs a nonce *and* the exact action details/report hash.
  const challenge = makeTeacherActionChallenge(payload);
  const options = await authenticationOptions(request, passkeys, challenge);
  const ceremony = await db.webAuthnCeremony.create({
    data: {
      userId: profile.id,
      type: "TEACHER_ACTION",
      purpose: action.action,
      payload,
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  return NextResponse.json({ ceremonyId: ceremony.id, authenticationOptions: options });
}
