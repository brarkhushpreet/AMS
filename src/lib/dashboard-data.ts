import { db } from "@/lib/db";
import { attendanceRate } from "@/lib/attendance-utils";
import { cacheJson } from "@/lib/redis";

function weekLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function getStudentDashboard(studentId: string) {
  return cacheJson(`dashboard:student:${studentId}`, 45, async () => {
    const [enrollments, records] = await Promise.all([
      db.enrollment.findMany({
        where: { studentId },
        include: {
          classroom: {
            include: {
              teacher: { include: { user: { select: { name: true } } } },
              attendanceSessions: {
                where: { status: "ACTIVE", endsAt: { gt: new Date() } },
                orderBy: { startedAt: "desc" },
                take: 1,
              },
              _count: { select: { attendanceSessions: true } },
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      }),
      db.attendanceRecord.findMany({
        where: { studentId },
        include: {
          session: {
            include: {
              classroom: { select: { id: true, name: true, subjectCode: true } },
            },
          },
        },
        orderBy: { verifiedAt: "desc" },
      }),
    ]);

    const totalSessions = enrollments.reduce(
      (sum, enrollment) => sum + enrollment.classroom._count.attendanceSessions,
      0,
    );
    const presentRecords = records.filter((record) => record.status !== "ABSENT");

    const classroomBreakdown = enrollments.map((enrollment) => {
      const classroomRecords = records.filter(
        (record) => record.session.classroomId === enrollment.classroomId,
      );
      return {
        id: enrollment.classroom.id,
        name: enrollment.classroom.name,
        code: enrollment.classroom.subjectCode,
        teacher: enrollment.classroom.teacher.user.name,
        term: enrollment.classroom.academicTerm,
        present: classroomRecords.filter((record) => record.status !== "ABSENT")
          .length,
        total: enrollment.classroom._count.attendanceSessions,
        rate: attendanceRate(
          classroomRecords.filter((record) => record.status !== "ABSENT").length,
          enrollment.classroom._count.attendanceSessions,
        ),
        activeSession: enrollment.classroom.attendanceSessions[0]
          ? {
              id: enrollment.classroom.attendanceSessions[0].id,
              method: enrollment.classroom.attendanceSessions[0].method,
              endsAt:
                enrollment.classroom.attendanceSessions[0].endsAt.toISOString(),
            }
          : null,
      };
    });

    const trend = Array.from({ length: 8 }, (_, index) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (7 - index) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const count = records.filter(
        (record) => record.verifiedAt >= start && record.verifiedAt < end,
      ).length;
      return { week: weekLabel(start), attended: count };
    });

    return {
      summary: {
        classrooms: enrollments.length,
        attended: presentRecords.length,
        totalSessions,
        rate: attendanceRate(presentRecords.length, totalSessions),
      },
      classrooms: classroomBreakdown,
      trend,
      recent: records.slice(0, 8).map((record) => ({
        id: record.id,
        classroom: record.session.classroom.name,
        subjectCode: record.session.classroom.subjectCode,
        method: record.method,
        status: record.status,
        verifiedAt: record.verifiedAt.toISOString(),
      })),
    };
  });
}

export async function getTeacherDashboard(teacherId: string) {
  return cacheJson(`dashboard:teacher:${teacherId}`, 45, async () => {
    const classrooms = await db.classroom.findMany({
      where: { teacherId },
      include: {
        enrollments: true,
        attendanceSessions: {
          include: { attendanceRecords: true },
          orderBy: { startedAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const sessions = classrooms.flatMap((classroom) =>
      classroom.attendanceSessions.map((session) => ({ classroom, session })),
    );
    const studentIds = new Set(
      classrooms.flatMap((classroom) =>
        classroom.enrollments.map((enrollment) => enrollment.studentId),
      ),
    );
    const marked = sessions.reduce(
      (sum, item) => sum + item.session.attendanceRecords.length,
      0,
    );
    const possible = sessions.reduce(
      (sum, item) => sum + item.classroom.enrollments.length,
      0,
    );

    const trend = Array.from({ length: 8 }, (_, index) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (7 - index) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const weeklySessions = sessions.filter(
        ({ session }) => session.startedAt >= start && session.startedAt < end,
      );
      const weeklyMarked = weeklySessions.reduce(
        (sum, { session }) => sum + session.attendanceRecords.length,
        0,
      );
      const weeklyPossible = weeklySessions.reduce(
        (sum, { classroom }) => sum + classroom.enrollments.length,
        0,
      );
      return { week: weekLabel(start), attendance: attendanceRate(weeklyMarked, weeklyPossible) };
    });

    return {
      summary: {
        classrooms: classrooms.length,
        students: studentIds.size,
        sessions: sessions.length,
        rate: attendanceRate(marked, possible),
      },
      trend,
      classrooms: classrooms.map((classroom) => {
        const totalPossible =
          classroom.attendanceSessions.length * classroom.enrollments.length;
        const present = classroom.attendanceSessions.reduce(
          (sum, session) => sum + session.attendanceRecords.length,
          0,
        );
        const active = classroom.attendanceSessions.find(
          (session) => session.status === "ACTIVE" && session.endsAt > new Date(),
        );
        return {
          id: classroom.id,
          name: classroom.name,
          code: classroom.subjectCode,
          joinCode: classroom.joinCode,
          section: classroom.section,
          term: classroom.academicTerm,
          students: classroom.enrollments.length,
          sessions: classroom.attendanceSessions.length,
          rate: attendanceRate(present, totalPossible),
          activeSession: active
            ? {
                id: active.id,
                method: active.method,
                endsAt: active.endsAt.toISOString(),
              }
            : null,
        };
      }),
      recent: sessions.slice(0, 8).map(({ classroom, session }) => ({
        id: session.id,
        classroomId: classroom.id,
        classroom: classroom.name,
        subjectCode: classroom.subjectCode,
        method: session.method,
        startedAt: session.startedAt.toISOString(),
        present: session.attendanceRecords.length,
        total: classroom.enrollments.length,
      })),
    };
  });
}
