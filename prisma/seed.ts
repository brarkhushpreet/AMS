import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/classpulse";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const DEMO_PASSWORD = "ClassPulse2026";

async function upsertTeacher(password: string) {
  const user = await db.user.upsert({
    where: { email: "khushbrar605@gmail.com" },
    update: {
      name: "Khushpreet Brar",
      password,
      role: "TEACHER",
    },
    create: {
      name: "Khushpreet Brar",
      email: "khushbrar605@gmail.com",
      password,
      role: "TEACHER",
    },
  });

  const teacher = await db.teacher.upsert({
    where: { userId: user.id },
    update: { department: "Computer Science" },
    create: { userId: user.id, department: "Computer Science" },
  });

  return { user, teacher };
}

async function upsertStudent(
  password: string,
  details: {
    email: string;
    name: string;
    registrationNumber: string;
    className: string;
    batch: string;
  },
) {
  const user = await db.user.upsert({
    where: { email: details.email },
    update: {
      name: details.name,
      password,
      role: "STUDENT",
    },
    create: {
      name: details.name,
      email: details.email,
      password,
      role: "STUDENT",
    },
  });

  const student = await db.student.upsert({
    where: { userId: user.id },
    update: {
      department: "Computer Science",
      registrationNumber: details.registrationNumber,
      className: details.className,
      batch: details.batch,
    },
    create: {
      userId: user.id,
      department: "Computer Science",
      registrationNumber: details.registrationNumber,
      className: details.className,
      batch: details.batch,
    },
  });

  return { user, student };
}

async function seedSession({
  id,
  classroomId,
  studentIds,
  weeksAgo,
  index,
}: {
  id: string;
  classroomId: string;
  studentIds: string[];
  weeksAgo: number;
  index: number;
}) {
  const startedAt = new Date();
  startedAt.setDate(startedAt.getDate() - weeksAgo * 7 - (index % 3));
  startedAt.setHours(10 + (index % 3), 0, 0, 0);
  const endsAt = new Date(startedAt.getTime() + 5 * 60_000);
  const method = index % 2 === 0 ? "GEOLOCATION" : "ULTRASOUND";

  const session = await db.attendanceSession.upsert({
    where: { id },
    update: {
      classroomId,
      method,
      status: "CLOSED",
      startedAt,
      endsAt,
    },
    create: {
      id,
      classroomId,
      method,
      status: "CLOSED",
      startedAt,
      endsAt,
      latitude: method === "GEOLOCATION" ? 30.852 : null,
      longitude: method === "GEOLOCATION" ? 75.706 : null,
      radiusMeters: method === "GEOLOCATION" ? 50 : null,
      frequencyMinHz: method === "ULTRASOUND" ? 17_200 : null,
      frequencyMaxHz: method === "ULTRASOUND" ? 18_800 : null,
      frequencyIntervalMs: method === "ULTRASOUND" ? 1_100 : null,
      minFrequencyMatches: method === "ULTRASOUND" ? 4 : null,
    },
  });

  for (const studentId of studentIds) {
    await db.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId,
        },
      },
      update: {
        method,
        status: "PRESENT",
        confidence: method === "ULTRASOUND" ? 0.96 : 0.88,
        verifiedAt: new Date(startedAt.getTime() + 75_000),
      },
      create: {
        sessionId: session.id,
        studentId,
        method,
        status: "PRESENT",
        confidence: method === "ULTRASOUND" ? 0.96 : 0.88,
        distanceMeters: method === "GEOLOCATION" ? 14 + index : null,
        evidence:
          method === "ULTRASOUND"
            ? { seeded: true, matchedChallenges: 5 }
            : { seeded: true, accuracyMeters: 12 },
        verifiedAt: new Date(startedAt.getTime() + 75_000),
      },
    });
  }
}

async function main() {
  const password = await bcrypt.hash(DEMO_PASSWORD, 12);
  const [{ teacher }, studentOne, studentTwo] = await Promise.all([
    upsertTeacher(password),
    upsertStudent(password, {
      email: "brarkhush972@gmail.com",
      name: "Brar Khush",
      registrationNumber: "CP-2026-001",
      className: "B.Tech CSE",
      batch: "2024-2028",
    }),
    upsertStudent(password, {
      email: "2140106@sliet.ac.in",
      name: "Student 2140106",
      registrationNumber: "2140106",
      className: "B.Tech CSE",
      batch: "2021-2025",
    }),
  ]);

  const classrooms = await Promise.all([
    db.classroom.upsert({
      where: {
        teacherId_subjectCode_academicTerm: {
          teacherId: teacher.id,
          subjectCode: "CS-204",
          academicTerm: "Autumn 2026",
        },
      },
      update: {
        name: "Data Structures",
        section: "A",
      },
      create: {
        name: "Data Structures",
        subjectCode: "CS-204",
        joinCode: "PULSE26",
        section: "A",
        academicTerm: "Autumn 2026",
        teacherId: teacher.id,
      },
    }),
    db.classroom.upsert({
      where: {
        teacherId_subjectCode_academicTerm: {
          teacherId: teacher.id,
          subjectCode: "CS-305",
          academicTerm: "Autumn 2026",
        },
      },
      update: {
        name: "Operating Systems",
        section: "B",
      },
      create: {
        name: "Operating Systems",
        subjectCode: "CS-305",
        joinCode: "SYSTEM8",
        section: "B",
        academicTerm: "Autumn 2026",
        teacherId: teacher.id,
      },
    }),
  ]);

  const students = [studentOne.student, studentTwo.student];
  for (const classroom of classrooms) {
    for (const student of students) {
      await db.enrollment.upsert({
        where: {
          studentId_classroomId: {
            studentId: student.id,
            classroomId: classroom.id,
          },
        },
        update: {},
        create: {
          studentId: student.id,
          classroomId: classroom.id,
        },
      });
    }
  }

  for (let index = 0; index < 10; index += 1) {
    await seedSession({
      id: `seed-ds-${String(index + 1).padStart(2, "0")}`,
      classroomId: classrooms[0].id,
      studentIds: [
        studentOne.student.id,
        ...(index % 4 === 0 ? [] : [studentTwo.student.id]),
      ],
      weeksAgo: 9 - index,
      index,
    });
    await seedSession({
      id: `seed-os-${String(index + 1).padStart(2, "0")}`,
      classroomId: classrooms[1].id,
      studentIds: [
        ...(index === 2 ? [] : [studentOne.student.id]),
        ...(index % 3 === 0 ? [] : [studentTwo.student.id]),
      ],
      weeksAgo: 9 - index,
      index: index + 10,
    });
  }

  console.log(
    "Seeded 1 teacher, 2 students, 2 classrooms, and 20 attendance sessions.",
  );
  console.log(`Development password for all three accounts: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
