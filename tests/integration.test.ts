import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createClient } from "redis";
import { db } from "../src/lib/db";
import { closeAttendance, consumePresenceProof, lockActiveAttendance } from "../src/lib/attendance-transaction";
import { appendAttendanceEventTx, generateAttendanceReport, verifyAttendanceReport } from "../src/lib/audit";
import { CONSUME_RATE_LIMIT, PUBLISH_CHALLENGE, RENEW_OR_ACQUIRE_LEASE } from "../src/lib/redis-protocol.js";

if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL) throw new Error("Use npm run test:integration; never run against the application database.");
const redis = createClient({ url: process.env.TEST_REDIS_URL, socket: { reconnectStrategy: false, connectTimeout: 2000 } });
redis.on("error", () => undefined);
const prefix = "classpulse:test:" + randomUUID();
const keys = new Set<string>();
function key(suffix: string) { const result = prefix + ":" + suffix; keys.add(result); return result; }
before(async () => { await redis.connect(); });
after(async () => { if (redis.isReady) { if (keys.size) await redis.del([...keys]); await redis.quit(); } await db.$disconnect(); });

async function fixture() {
  const teacher = await db.user.create({ data: { email: randomUUID() + "@test.invalid", name: "Test teacher", password: "not-a-login", role: "TEACHER", teacher: { create: {} } }, include: { teacher: true } });
  const student = await db.user.create({ data: { email: randomUUID() + "@test.invalid", name: "Test student", password: "not-a-login", student: { create: { registrationNumber: randomUUID() } } }, include: { student: true } });
  const classroom = await db.classroom.create({ data: { name: "Test room", subjectCode: randomUUID(), academicTerm: "test", joinCode: randomUUID(), teacherId: teacher.teacher!.id, enrollments: { create: { studentId: student.student!.id } } } });
  const session = await db.attendanceSession.create({ data: { classroomId: classroom.id, method: "ULTRASOUND", endsAt: new Date(Date.now() + 60000) } });
  const credential = await db.passkeyCredential.create({ data: { id: randomUUID(), userId: student.id, name: "Fixture credential", publicKey: Buffer.from([1]), transports: [], deviceType: "multiDevice" } });
  const proof = await db.presenceVerification.create({ data: { sessionId: session.id, studentId: student.student!.id, method: "ULTRASOUND", proofHash: "original-proof", confidence: .8, evidence: {}, webAuthnChallenge: randomUUID(), expiresAt: new Date(Date.now() + 60000) } });
  return { teacher, student, classroom, session, credential, proof };
}

test("only one Redis node owns a lease, including concurrent acquisition", async () => {
  const lease = key("lease");
  const outcomes = await Promise.all(["a", "b", "c"].map(owner => redis.eval(RENEW_OR_ACQUIRE_LEASE, { keys: [lease], arguments: [owner, "3000"] })));
  assert.equal(outcomes.filter(value => value === 1).length, 1);
  const owner = await redis.get(lease);
  assert.equal(await redis.eval(RENEW_OR_ACQUIRE_LEASE, { keys: [lease], arguments: ["outsider", "9000"] }), 0);
  assert.equal(await redis.get(lease), owner);
});

test("a former lease owner cannot publish after ownership changes", async () => {
  const lease = key("publish-leader"), slot = key("slot"), challenge = key("challenge");
  await redis.set(lease, "new-owner", { PX: 3000 });
  const publish = (owner: string) => redis.eval(PUBLISH_CHALLENGE, { keys: [lease, slot, challenge], arguments: [owner, "90000", '{"id":"test"}', key("channel")] });
  assert.equal(await publish("old-owner"), 0);
  assert.equal(await redis.exists(challenge), 0);
  assert.equal(await publish("new-owner"), 1);
  assert.equal(await redis.get(challenge), '{"id":"test"}');
  assert.equal(await publish("new-owner"), 0);
});

test("rate-limit counts and expiry are atomic across concurrent requests", async () => {
  const rateKey = key("rate");
  const results = await Promise.all(Array.from({ length: 30 }, () => redis.eval(CONSUME_RATE_LIMIT, { keys: [rateKey], arguments: ["60"] }) as Promise<[number, number]>));
  assert.equal(new Set(results.map(([count]) => count)).size, 30);
  assert.equal(results.filter(([count]) => count <= 8).length, 8);
  assert.ok(results.every(([, ttl]) => ttl > 0));
});

test("a replacement proof cannot be authorized by an assertion for the old challenge", async () => {
  const f = await fixture();
  await db.presenceVerification.update({ where: { id: f.proof.id }, data: { webAuthnChallenge: "replacement", proofHash: "replacement-proof" } });
  await assert.rejects(db.$transaction(async tx => {
    await lockActiveAttendance(tx, f.session.id, f.student.student!.id);
    await consumePresenceProof(tx, { id: f.proof.id, studentId: f.student.student!.id, challenge: f.proof.webAuthnChallenge!, proofHash: f.proof.proofHash, credentialId: f.credential.id });
  }), /replaced, expired, or already used/);
  assert.equal((await db.presenceVerification.findUniqueOrThrow({ where: { id: f.proof.id } })).status, "PENDING_DEVICE");
});

test("concurrent proof consumption produces one attendance record and one acceptance", async () => {
  const f = await fixture();
  const attempt = () => db.$transaction(async tx => {
    await lockActiveAttendance(tx, f.session.id, f.student.student!.id);
    await consumePresenceProof(tx, { id: f.proof.id, studentId: f.student.student!.id, challenge: f.proof.webAuthnChallenge!, proofHash: f.proof.proofHash, credentialId: f.credential.id });
    const record = await tx.attendanceRecord.create({ data: { sessionId: f.session.id, studentId: f.student.student!.id, method: "ULTRASOUND", deviceVerified: true } });
    await appendAttendanceEventTx(tx, { sessionId: f.session.id, type: "ATTENDANCE_RECORDED", payload: { recordId: record.id } });
  }, { timeout: 15000 });
  const results = await Promise.allSettled(Array.from({ length: 10 }, attempt));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(await db.attendanceRecord.count({ where: { sessionId: f.session.id } }), 1);
  assert.equal(await db.attendanceAuditEvent.count({ where: { sessionId: f.session.id } }), 1);
});

test("waiting attendance writers recheck closure; repeated closure does not alter a receipt", async () => {
  const f = await fixture();
  let locked!: () => void;
  let release!: () => void;
  const acquired = new Promise<void>(resolve => { locked = resolve; });
  const resume = new Promise<void>(resolve => { release = resolve; });
  const closure = db.$transaction(async tx => {
    await closeAttendance(tx, f.session.id);
    locked(); await resume;
    await appendAttendanceEventTx(tx, { sessionId: f.session.id, type: "SESSION_CLOSED", payload: {} });
  });
  await acquired;
  const waiting = db.$transaction(tx => lockActiveAttendance(tx, f.session.id, f.student.student!.id));
  release(); await closure;
  await assert.rejects(waiting, /session has ended/);
  const before = await db.attendanceSession.findUniqueOrThrow({ where: { id: f.session.id } });
  const report = await generateAttendanceReport(f.session.id);
  await db.$transaction(tx => closeAttendance(tx, f.session.id, new Date(Date.now() + 10000)));
  assert.equal((await db.attendanceSession.findUniqueOrThrow({ where: { id: f.session.id } })).endsAt.toISOString(), before.endsAt.toISOString());
  assert.equal((await verifyAttendanceReport(report.id))?.valid, true);
  await assert.rejects(db.$transaction(tx => appendAttendanceEventTx(tx, { sessionId: f.session.id, type: "ATTENDANCE_RECORDED", payload: {} })), /Sealed attendance history/);
});

test("a student from another classroom cannot acquire authorization to write attendance", async () => {
  const a = await fixture(), b = await fixture();
  await assert.rejects(db.$transaction(tx => lockActiveAttendance(tx, a.session.id, b.student.student!.id)), /not enrolled/);
});
