ALTER TYPE "WebAuthnCeremonyType" ADD VALUE 'TEACHER_ACTION';
ALTER TYPE "AttendanceAuditEventType" ADD VALUE 'ATTENDANCE_CORRECTED';

ALTER TABLE "WebAuthnCeremony"
  ADD COLUMN "purpose" TEXT,
  ADD COLUMN "payload" JSONB;

CREATE TABLE "AttendanceCorrection" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "teacherUserId" TEXT NOT NULL,
  "present" BOOLEAN NOT NULL,
  "reason" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendanceCorrection_sessionId_createdAt_idx"
  ON "AttendanceCorrection"("sessionId", "createdAt");

ALTER TABLE "AttendanceCorrection"
  ADD CONSTRAINT "AttendanceCorrection_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TeacherReportAttestation" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "teacherUserId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "publicKey" BYTEA NOT NULL,
  "counterBefore" BIGINT NOT NULL,
  "challenge" TEXT NOT NULL,
  "reportHash" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "rpId" TEXT NOT NULL,
  "assertion" JSONB NOT NULL,
  "serverSignature" TEXT NOT NULL,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherReportAttestation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherReportAttestation_reportId_key"
  ON "TeacherReportAttestation"("reportId");

ALTER TABLE "TeacherReportAttestation"
  ADD CONSTRAINT "TeacherReportAttestation_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "AttendanceReport"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
