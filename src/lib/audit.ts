import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  sign,
  timingSafeEqual,
  verify,
} from "node:crypto";
import type {
  AttendanceAuditEventType,
  Prisma,
} from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  AUDIT_GENESIS_HASH,
  canonicalJson,
  computeAuditEventHash,
  sha256Hex,
} from "@/lib/audit-core.js";

const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

type AuditPayload = Prisma.InputJsonObject;
type Transaction = Prisma.TransactionClient;

function signingKeys() {
  const secret =
    process.env.ATTENDANCE_SIGNING_SECRET ??
    process.env.AUTH_SECRET ??
    "development-only-change-me";
  const seed = createHmac("sha256", secret)
    .update("classpulse:attendance-report:ed25519:v1")
    .digest();
  const privateKeyDer = Buffer.concat([
    ED25519_PKCS8_PREFIX,
    seed,
  ]);
  const privateKey = createPrivateKey({
    key: privateKeyDer,
    format: "der",
    type: "pkcs8",
  });
  const privateJwk = privateKey.export({ format: "jwk" });
  const publicJwk = { ...privateJwk };
  delete publicJwk.d;
  const publicKey = createPublicKey({
    key: publicJwk,
    format: "jwk",
  });
  return {
    privateKey,
    publicKey,
    encodedPublicKey: publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64url"),
  };
}

export function attendanceSigningIdentity() {
  const { encodedPublicKey } = signingKeys();
  return {
    algorithm: "Ed25519" as const,
    publicKey: encodedPublicKey,
    fingerprint: sha256Hex(
      Buffer.from(encodedPublicKey, "base64url"),
    ).slice(0, 24),
  };
}

export function auditActorId(userId: string) {
  const secret =
    process.env.ATTENDANCE_SIGNING_SECRET ??
    process.env.AUTH_SECRET ??
    "development-only-change-me";
  return createHmac("sha256", secret)
    .update(`classpulse:audit-actor:${userId}`)
    .digest("hex")
    .slice(0, 32);
}

export async function appendAttendanceEventTx(
  tx: Transaction,
  input: {
    sessionId: string;
    type: AttendanceAuditEventType;
    actorId?: string | null;
    payload: AuditPayload;
    createdAt?: Date;
  },
) {
  await tx.$queryRaw`SELECT "id" FROM "AttendanceSession" WHERE "id" = ${input.sessionId} FOR UPDATE`;
  const sealed = await tx.attendanceReport.findUnique({ where: { sessionId: input.sessionId } });
  if (sealed && input.type !== "REPORT_SIGNED") {
    throw new Error("Sealed attendance history cannot be changed.");
  }
  const previous = await tx.attendanceAuditEvent.findFirst({
    where: { sessionId: input.sessionId },
    orderBy: { sequence: "desc" },
    select: { sequence: true, eventHash: true },
  });
  const sequence = (previous?.sequence ?? 0) + 1;
  const previousHash = previous?.eventHash ?? AUDIT_GENESIS_HASH;
  const createdAt = input.createdAt ?? new Date();
  const eventHash = computeAuditEventHash({
    sessionId: input.sessionId,
    sequence,
    type: input.type,
    actorId: input.actorId ?? null,
    payload: input.payload,
    previousHash,
    createdAt: createdAt.toISOString(),
  });

  return tx.attendanceAuditEvent.create({
    data: {
      sessionId: input.sessionId,
      sequence,
      type: input.type,
      actorId: input.actorId ?? null,
      payload: input.payload,
      previousHash,
      eventHash,
      createdAt,
    },
  });
}

export function appendAttendanceEvent(input: {
  sessionId: string;
  type: AttendanceAuditEventType;
  actorId?: string | null;
  payload: AuditPayload;
  createdAt?: Date;
}) {
  return db.$transaction((tx) => appendAttendanceEventTx(tx, input));
}

export async function generateAttendanceReport(sessionId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "AttendanceSession" WHERE "id" = ${sessionId} FOR UPDATE`;
    const existing = await tx.attendanceReport.findUnique({
      where: { sessionId },
    });
    if (existing) return existing;

    const session = await tx.attendanceSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        classroomId: true,
        method: true,
        status: true,
        startedAt: true,
        endsAt: true,
        _count: { select: { attendanceRecords: true } },
      },
    });
    if (!session || session.status === "ACTIVE") {
      throw new Error("The attendance session must be closed before sealing it.");
    }

    const events = await tx.attendanceAuditEvent.findMany({
      where: { sessionId },
      orderBy: { sequence: "asc" },
    });
    const eventCount = events.length;
    const headHash =
      events.at(-1)?.eventHash ?? AUDIT_GENESIS_HASH;
    const generatedAt = new Date();
    const payload = {
      version: 1,
      sessionId,
      classroomId: session.classroomId,
      method: session.method,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endsAt.toISOString(),
      eventCount,
      recordCount: session._count.attendanceRecords,
      headHash,
      generatedAt: generatedAt.toISOString(),
    };
    const canonicalPayload = canonicalJson(payload);
    const payloadHash = sha256Hex(canonicalPayload);
    const keys = signingKeys();
    const signature = sign(
      null,
      Buffer.from(canonicalPayload),
      keys.privateKey,
    ).toString("base64url");

    const report = await tx.attendanceReport.create({
      data: {
        sessionId,
        eventCount,
        recordCount: session._count.attendanceRecords,
        headHash,
        payloadHash,
        signature,
        publicKey: keys.encodedPublicKey,
        generatedAt,
      },
    });

    await appendAttendanceEventTx(tx, {
      sessionId,
      type: "REPORT_SIGNED",
      payload: {
        reportId: report.id,
        sealedEventCount: eventCount,
        sealedHeadHash: headHash,
        payloadHash,
      },
      createdAt: generatedAt,
    });
    return report;
  });
}

export async function ensureAttendanceReport(sessionId: string) {
  const session = await db.attendanceSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      endsAt: true,
      report: true,
    },
  });
  if (!session) throw new Error("Attendance session not found.");
  if (session.report) return session.report;

  if (session.status === "ACTIVE") {
    if (session.endsAt > new Date()) {
      throw new Error(
        "The attendance session is still active and cannot be sealed.",
      );
    }
    const closedAt = new Date();
    await db.$transaction(async (tx) => {
      const updated = await tx.attendanceSession.updateMany({
        where: { id: sessionId, status: "ACTIVE" },
        data: { status: "CLOSED" },
      });
      if (updated.count) {
        await appendAttendanceEventTx(tx, {
          sessionId,
          type: "SESSION_CLOSED",
          payload: { reason: "AUTO_EXPIRED" },
          createdAt: closedAt,
        });
      }
    });
  }
  return generateAttendanceReport(sessionId);
}

export async function verifyAttendanceReport(reportId: string) {
  const report = await db.attendanceReport.findUnique({
    where: { id: reportId },
    include: {
      session: {
        select: {
          id: true,
          classroomId: true,
          method: true,
          startedAt: true,
          endsAt: true,
          classroom: {
            select: { name: true, subjectCode: true },
          },
          auditEvents: {
            orderBy: { sequence: "asc" },
          },
        },
      },
    },
  });
  if (!report) return null;

  const events = report.session.auditEvents.slice(0, report.eventCount);
  let previousHash = AUDIT_GENESIS_HASH;
  let chainValid = events.length === report.eventCount;
  for (const event of events) {
    const expected = computeAuditEventHash({
      sessionId: event.sessionId,
      sequence: event.sequence,
      type: event.type,
      actorId: event.actorId,
      payload: event.payload,
      previousHash,
      createdAt: event.createdAt.toISOString(),
    });
    if (event.previousHash !== previousHash || event.eventHash !== expected) {
      chainValid = false;
      break;
    }
    previousHash = event.eventHash;
  }
  chainValid = chainValid && previousHash === report.headHash;

  const payload = {
    version: 1,
    sessionId: report.sessionId,
    classroomId: report.session.classroomId,
    method: report.session.method,
    startedAt: report.session.startedAt.toISOString(),
    endedAt: report.session.endsAt.toISOString(),
    eventCount: report.eventCount,
    recordCount: report.recordCount,
    headHash: report.headHash,
    generatedAt: report.generatedAt.toISOString(),
  };
  const canonicalPayload = canonicalJson(payload);
  const payloadHash = sha256Hex(canonicalPayload);
  let signatureValid = false;
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(report.publicKey, "base64url"),
      format: "der",
      type: "spki",
    });
    signatureValid = verify(
      null,
      Buffer.from(canonicalPayload),
      publicKey,
      Buffer.from(report.signature, "base64url"),
    );
  } catch {
    signatureValid = false;
  }
  const trustedIdentity = attendanceSigningIdentity();
  const trustedKeyBytes = Buffer.from(
    trustedIdentity.publicKey,
    "base64url",
  );
  const reportKeyBytes = Buffer.from(
    report.publicKey,
    "base64url",
  );
  const keyTrusted =
    trustedKeyBytes.length === reportKeyBytes.length &&
    timingSafeEqual(trustedKeyBytes, reportKeyBytes);

  return {
    report,
    payload,
    chainValid,
    payloadValid: payloadHash === report.payloadHash,
    signatureValid,
    keyTrusted,
    valid:
      chainValid &&
      payloadHash === report.payloadHash &&
      signatureValid &&
      keyTrusted,
    keyFingerprint: sha256Hex(
      Buffer.from(report.publicKey, "base64url"),
    ).slice(0, 24),
  };
}

export { canonicalJson, sha256Hex };
