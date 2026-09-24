CREATE TYPE "WebAuthnCeremonyType" AS ENUM ('REGISTRATION', 'MANAGEMENT');
CREATE TYPE "PresenceVerificationStatus" AS ENUM (
  'PENDING_DEVICE',
  'VERIFIED',
  'REJECTED',
  'EXPIRED'
);
CREATE TYPE "AttendanceAuditEventType" AS ENUM (
  'SESSION_STARTED',
  'CHALLENGE_COMMITTED',
  'PROOF_ACCEPTED',
  'DEVICE_VERIFIED',
  'ATTENDANCE_RECORDED',
  'SESSION_CLOSED',
  'REPORT_SIGNED'
);

ALTER TABLE "AttendanceRecord"
  ADD COLUMN "deviceVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "proofHash" TEXT;

ALTER TABLE "User"
  ADD COLUMN "attendancePasskeyRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PasskeyCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "publicKey" BYTEA NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "transports" TEXT[] NOT NULL,
  "deviceType" TEXT NOT NULL,
  "backedUp" BOOLEAN NOT NULL DEFAULT false,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebAuthnCeremony" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "WebAuthnCeremonyType" NOT NULL,
  "challenge" TEXT NOT NULL,
  "authorizedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebAuthnCeremony_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasskeyRecoveryCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasskeyRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PresenceVerification" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "method" "AttendanceMethod" NOT NULL,
  "status" "PresenceVerificationStatus" NOT NULL DEFAULT 'PENDING_DEVICE',
  "proofHash" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "distanceMeters" DOUBLE PRECISION,
  "evidence" JSONB NOT NULL,
  "webAuthnChallenge" TEXT,
  "credentialId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PresenceVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceAuditEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "type" "AttendanceAuditEventType" NOT NULL,
  "actorId" TEXT,
  "payload" JSONB NOT NULL,
  "previousHash" TEXT NOT NULL,
  "eventHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceReport" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "eventCount" INTEGER NOT NULL,
  "recordCount" INTEGER NOT NULL,
  "headHash" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL DEFAULT 'Ed25519',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasskeyCredential_userId_idx"
  ON "PasskeyCredential"("userId");
CREATE UNIQUE INDEX "WebAuthnCeremony_challenge_key"
  ON "WebAuthnCeremony"("challenge");
CREATE INDEX "WebAuthnCeremony_userId_type_expiresAt_idx"
  ON "WebAuthnCeremony"("userId", "type", "expiresAt");
CREATE UNIQUE INDEX "PasskeyRecoveryCode_codeHash_key"
  ON "PasskeyRecoveryCode"("codeHash");
CREATE INDEX "PasskeyRecoveryCode_userId_usedAt_idx"
  ON "PasskeyRecoveryCode"("userId", "usedAt");
CREATE UNIQUE INDEX "PresenceVerification_sessionId_studentId_key"
  ON "PresenceVerification"("sessionId", "studentId");
CREATE INDEX "PresenceVerification_studentId_status_expiresAt_idx"
  ON "PresenceVerification"("studentId", "status", "expiresAt");
CREATE UNIQUE INDEX "AttendanceAuditEvent_eventHash_key"
  ON "AttendanceAuditEvent"("eventHash");
CREATE UNIQUE INDEX "AttendanceAuditEvent_sessionId_sequence_key"
  ON "AttendanceAuditEvent"("sessionId", "sequence");
CREATE INDEX "AttendanceAuditEvent_sessionId_createdAt_idx"
  ON "AttendanceAuditEvent"("sessionId", "createdAt");
CREATE UNIQUE INDEX "AttendanceReport_sessionId_key"
  ON "AttendanceReport"("sessionId");

ALTER TABLE "PasskeyCredential"
  ADD CONSTRAINT "PasskeyCredential_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebAuthnCeremony"
  ADD CONSTRAINT "WebAuthnCeremony_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasskeyRecoveryCode"
  ADD CONSTRAINT "PasskeyRecoveryCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresenceVerification"
  ADD CONSTRAINT "PresenceVerification_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresenceVerification"
  ADD CONSTRAINT "PresenceVerification_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresenceVerification"
  ADD CONSTRAINT "PresenceVerification_credentialId_fkey"
  FOREIGN KEY ("credentialId") REFERENCES "PasskeyCredential"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceAuditEvent"
  ADD CONSTRAINT "AttendanceAuditEvent_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceReport"
  ADD CONSTRAINT "AttendanceReport_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
