import { db } from "@/lib/db";
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_STUDENT_ID,
  DEMO_TEACHER_ID,
  DEMO_TEACHER_PROFILE_ID,
} from "@/lib/demo-policy";

/** Creates a fixed, isolated fictional dataset once; never reuses personal accounts. */
export async function ensureDemoAccounts() {
  if (await db.user.findUnique({ where: { id: DEMO_TEACHER_ID }, select: { id: true } })) return;

  try {
    await db.$transaction(async (tx) => {
      // Not a password/hash: these accounts cannot use password authentication.
      const disabledPassword = "!password-login-disabled!";
      await tx.user.create({
        data: {
          id: DEMO_TEACHER_ID,
          name: "Alex Morgan (Demo)",
          email: `teacher@${DEMO_EMAIL_DOMAIN}`,
          password: disabledPassword,
          role: "TEACHER",
          teacher: { create: { id: DEMO_TEACHER_PROFILE_ID, department: "Computer Science" } },
        },
      });

      const studentIds: string[] = [];
      const names = ["Jamie Lee (Demo)", "Avery Chen", "Sam Rivera", "Taylor Reed", "Riley Patel", "Jordan Park"];
      for (const [index, name] of names.entries()) {
        const user = await tx.user.create({
          data: {
            ...(index === 0 ? { id: DEMO_STUDENT_ID } : {}),
            name,
            email: `${index === 0 ? "student" : `classmate-${index}`}@${DEMO_EMAIL_DOMAIN}`,
            password: disabledPassword,
            role: "STUDENT",
            student: { create: {
              registrationNumber: `PORTFOLIO-DEMO-${index + 1}`,
              department: "Computer Science",
              className: "B.Tech CSE",
              batch: "Demo cohort",
            } },
          },
          select: { student: { select: { id: true } } },
        });
        studentIds.push(user.student!.id);
      }

      for (const [classIndex, name] of ["Data Structures", "Operating Systems"].entries()) {
        const classroom = await tx.classroom.create({
          data: {
            teacherId: DEMO_TEACHER_PROFILE_ID,
            name,
            subjectCode: classIndex === 0 ? "CS-204" : "CS-305",
            joinCode: classIndex === 0 ? "DEMODSA" : "DEMOOS",
            academicTerm: "Demo semester",
            section: classIndex === 0 ? "A" : "B",
            enrollments: { create: studentIds.map((studentId) => ({ studentId })) },
          },
        });
        for (let index = 0; index < 10; index++) {
          const startedAt = new Date();
          startedAt.setUTCDate(startedAt.getUTCDate() - (10 - index) * 2 - classIndex);
          startedAt.setUTCHours(9 + classIndex, 0, 0, 0);
          const method = index % 2 === 0 ? "GEOLOCATION" : "ULTRASOUND";
          await tx.attendanceSession.create({
            data: {
              classroomId: classroom.id,
              method,
              status: "CLOSED",
              startedAt,
              endsAt: new Date(startedAt.getTime() + 5 * 60_000),
              attendanceRecords: { create: studentIds.flatMap((studentId, studentIndex) => {
                if ((index + studentIndex + classIndex) % 5 === 0) return [];
                return [{
                  studentId,
                  method,
                  status: "PRESENT" as const,
                  verifiedAt: new Date(startedAt.getTime() + 60_000),
                  // Fictional history, not a signed or device-verified attendance proof.
                  deviceVerified: false,
                }];
              }) },
            },
          });
        }
      }
    }, { timeout: 20_000 });
  } catch (error) {
    // A competing first login may have finished the same atomic seed.
    if (error && typeof error === "object" && "code" in error && error.code === "P2002" &&
        await db.user.findUnique({ where: { id: DEMO_TEACHER_ID }, select: { id: true } })) return;
    throw error;
  }
}
