-- Remove the retired administrator accounts before narrowing the role enum.
DELETE FROM "User" WHERE "role" = 'ADMIN';

CREATE TYPE "Role_new" AS ENUM ('STUDENT', 'TEACHER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_new"
  USING ("role"::text::"Role_new");
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';

ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'LATE';
CREATE TYPE "AttendanceMethod" AS ENUM ('GEOLOCATION', 'ULTRASOUND');
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('ACTIVE', 'CLOSED', 'CANCELLED');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

ALTER TABLE "User" RENAME COLUMN "username" TO "name";
ALTER TABLE "Student" RENAME COLUMN "branch" TO "department";
ALTER TABLE "Student"
  ALTER COLUMN "department" DROP NOT NULL,
  ADD COLUMN "className" TEXT,
  ADD COLUMN "batch" TEXT;
ALTER TABLE "Teacher" ALTER COLUMN "department" DROP NOT NULL;

CREATE TABLE "Classroom_new" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subjectCode" TEXT NOT NULL,
  "joinCode" TEXT NOT NULL,
  "section" TEXT,
  "academicTerm" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Classroom_new_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Classroom_new" (
  "id", "name", "subjectCode", "joinCode", "section",
  "academicTerm", "teacherId", "createdAt", "updatedAt"
)
SELECT
  md5(c."id" || ':' || tc."B"),
  c."name",
  c."code",
  upper(substring(md5(c."id" || ':' || tc."B") from 1 for 7)),
  NULL,
  c."session",
  tc."B",
  c."createdAt",
  c."updatedAt"
FROM "Course" c
JOIN "_TeacherCourses" tc ON tc."A" = c."id";

CREATE TABLE "Enrollment_new" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Enrollment_new_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Enrollment_new" ("id", "studentId", "classroomId", "joinedAt")
SELECT DISTINCT ON (e."studentId", e."courseId", e."teacherId")
  e."id",
  e."studentId",
  md5(e."courseId" || ':' || e."teacherId"),
  e."createdAt"
FROM "Enrollment" e
WHERE EXISTS (
  SELECT 1 FROM "Classroom_new" c
  WHERE c."id" = md5(e."courseId" || ':' || e."teacherId")
)
ORDER BY e."studentId", e."courseId", e."teacherId", e."createdAt";

-- Preserve implicit course enrollments that pre-date the Enrollment model.
INSERT INTO "Enrollment_new" ("id", "studentId", "classroomId", "joinedAt")
SELECT
  md5(sc."B" || ':' || sc."A" || ':' || first_teacher."teacherId"),
  sc."B",
  md5(sc."A" || ':' || first_teacher."teacherId"),
  CURRENT_TIMESTAMP
FROM "_StudentCourses" sc
CROSS JOIN LATERAL (
  SELECT tc."B" AS "teacherId"
  FROM "_TeacherCourses" tc
  WHERE tc."A" = sc."A"
  ORDER BY tc."B"
  LIMIT 1
) first_teacher
WHERE NOT EXISTS (
  SELECT 1
  FROM "Enrollment_new" e
  WHERE e."studentId" = sc."B"
    AND e."classroomId" = md5(sc."A" || ':' || first_teacher."teacherId")
);

CREATE TABLE "ClassroomInvitation" (
  "id" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "registrationNumber" TEXT,
  "department" TEXT,
  "className" TEXT,
  "batch" TEXT,
  "token" TEXT NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassroomInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceSession" (
  "id" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "method" "AttendanceMethod" NOT NULL,
  "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "radiusMeters" INTEGER,
  "frequencyMinHz" INTEGER,
  "frequencyMaxHz" INTEGER,
  "frequencyIntervalMs" INTEGER,
  "minFrequencyMatches" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AttendanceSession" (
  "id", "classroomId", "method", "status", "startedAt", "endsAt",
  "createdAt", "updatedAt"
)
SELECT
  md5(ar."courseId" || ':' || ar."teacherId" || ':' || to_char(ar."date", 'YYYYMMDD')),
  md5(ar."courseId" || ':' || ar."teacherId"),
  'GEOLOCATION',
  'CLOSED',
  min(ar."date"),
  max(ar."date") + interval '1 hour',
  min(ar."createdAt"),
  max(ar."updatedAt")
FROM "AttendanceRecord" ar
WHERE EXISTS (
  SELECT 1 FROM "Classroom_new" c
  WHERE c."id" = md5(ar."courseId" || ':' || ar."teacherId")
)
GROUP BY ar."courseId", ar."teacherId", to_char(ar."date", 'YYYYMMDD');

CREATE TABLE "AttendanceRecord_new" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "method" "AttendanceMethod" NOT NULL,
  "confidence" DOUBLE PRECISION,
  "distanceMeters" DOUBLE PRECISION,
  "evidence" JSONB,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceRecord_new_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AttendanceRecord_new" (
  "id", "sessionId", "studentId", "status", "method", "evidence",
  "verifiedAt", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (
  md5(ar."courseId" || ':' || ar."teacherId" || ':' || to_char(ar."date", 'YYYYMMDD')),
  ar."studentId"
)
  ar."id",
  md5(ar."courseId" || ':' || ar."teacherId" || ':' || to_char(ar."date", 'YYYYMMDD')),
  ar."studentId",
  ar."status",
  'GEOLOCATION',
  jsonb_build_object('migratedFrom', 'legacy-qr'),
  ar."date",
  ar."createdAt",
  ar."updatedAt"
FROM "AttendanceRecord" ar
WHERE EXISTS (
  SELECT 1 FROM "AttendanceSession" s
  WHERE s."id" = md5(ar."courseId" || ':' || ar."teacherId" || ':' || to_char(ar."date", 'YYYYMMDD'))
)
ORDER BY
  md5(ar."courseId" || ':' || ar."teacherId" || ':' || to_char(ar."date", 'YYYYMMDD')),
  ar."studentId",
  ar."date";

DROP TABLE "AttendanceRecord" CASCADE;
DROP TABLE "QRCode" CASCADE;
DROP TABLE "Enrollment" CASCADE;
DROP TABLE "_StudentCourses" CASCADE;
DROP TABLE "_TeacherCourses" CASCADE;
DROP TABLE "Course" CASCADE;
DROP TABLE "Admin" CASCADE;

ALTER TABLE "Classroom_new" RENAME TO "Classroom";
ALTER TABLE "Enrollment_new" RENAME TO "Enrollment";
ALTER TABLE "AttendanceRecord_new" RENAME TO "AttendanceRecord";

CREATE UNIQUE INDEX "Classroom_joinCode_key" ON "Classroom"("joinCode");
CREATE UNIQUE INDEX "Classroom_teacherId_subjectCode_academicTerm_key"
  ON "Classroom"("teacherId", "subjectCode", "academicTerm");
CREATE INDEX "Classroom_teacherId_idx" ON "Classroom"("teacherId");

CREATE UNIQUE INDEX "Enrollment_studentId_classroomId_key"
  ON "Enrollment"("studentId", "classroomId");
CREATE INDEX "Enrollment_classroomId_idx" ON "Enrollment"("classroomId");

CREATE UNIQUE INDEX "ClassroomInvitation_token_key" ON "ClassroomInvitation"("token");
CREATE UNIQUE INDEX "ClassroomInvitation_classroomId_email_key"
  ON "ClassroomInvitation"("classroomId", "email");
CREATE INDEX "ClassroomInvitation_email_status_idx"
  ON "ClassroomInvitation"("email", "status");

CREATE INDEX "AttendanceSession_classroomId_status_idx"
  ON "AttendanceSession"("classroomId", "status");
CREATE INDEX "AttendanceSession_endsAt_idx" ON "AttendanceSession"("endsAt");

CREATE UNIQUE INDEX "AttendanceRecord_sessionId_studentId_key"
  ON "AttendanceRecord"("sessionId", "studentId");
CREATE INDEX "AttendanceRecord_studentId_verifiedAt_idx"
  ON "AttendanceRecord"("studentId", "verifiedAt");

ALTER TABLE "Classroom"
  ADD CONSTRAINT "Classroom_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment"
  ADD CONSTRAINT "Enrollment_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrollment"
  ADD CONSTRAINT "Enrollment_classroomId_fkey"
  FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassroomInvitation"
  ADD CONSTRAINT "ClassroomInvitation_classroomId_fkey"
  FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession"
  ADD CONSTRAINT "AttendanceSession_classroomId_fkey"
  FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
