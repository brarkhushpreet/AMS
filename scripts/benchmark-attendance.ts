import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import net from "node:net";
import { once } from "node:events";
import { encode } from "next-auth/jwt";
import { WebSocket } from "ws";
import { db } from "../src/lib/db";
import { createRealtimeTicket } from "../src/lib/realtime-ticket";
import { AUDIT_GENESIS_HASH, computeAuditEventHash } from "../src/lib/audit-core.js";

if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL) throw new Error("Use npm run benchmark with its isolated PostgreSQL runner.");
const count = Number(process.env.BENCHMARK_STUDENTS ?? 500);
const concurrency = Number(process.env.BENCHMARK_CONCURRENCY ?? 25);
assert.ok(Number.isInteger(count) && count >= 10 && count <= 2000);
assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 100);
const processes: ChildProcess[] = [];
const sockets: WebSocket[] = [];
const logs: string[] = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function startServer() {
  const listener = net.createServer();
  await new Promise<void>(resolve => listener.listen(0, "127.0.0.1", resolve));
  const port = (listener.address() as net.AddressInfo).port;
  await new Promise<void>(resolve => listener.close(() => resolve()));
  const url = "http://127.0.0.1:" + port;
  const child = spawn(process.execPath, ["server.mjs", "--production"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PORT: String(port), APP_HOST: "127.0.0.1", AUTH_URL: url, AUTH_TRUST_HOST: "true", REDIS_URL: process.env.TEST_REDIS_URL } });
  processes.push(child);
  child.stdout!.on("data", chunk => { logs.push(String(chunk)); if (logs.length > 100) logs.shift(); });
  child.stderr!.on("data", chunk => { logs.push(String(chunk)); if (logs.length > 100) logs.shift(); });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error("Benchmark server exited: " + logs.slice(-5).join(""));
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return { child, url }; } catch { /* wait for startup */ }
    await sleep(200);
  }
  throw new Error("Benchmark server did not become ready.");
}

async function cookie(userId: string, role = "STUDENT") {
  return "authjs.session-token=" + await encode({ token: { sub: userId, role }, secret: process.env.AUTH_SECRET!, salt: "authjs.session-token", maxAge: 3600 });
}

try {
  const teacherId = randomUUID(), teacherUserId = randomUUID();
  await db.user.create({ data: { id: teacherUserId, email: randomUUID() + "@benchmark.invalid", name: "Benchmark teacher", password: "no-login", role: "TEACHER", teacher: { create: { id: teacherId } } } });
  const rooms = await Promise.all(Array.from({ length: 5 }, (_, i) => db.classroom.create({ data: { name: "Benchmark room " + i, subjectCode: "BENCH" + i, academicTerm: "test", teacherId, joinCode: randomUUID() } })));
  const sessions = await Promise.all(rooms.map(room => db.attendanceSession.create({ data: { classroomId: room.id, method: "GEOLOCATION", latitude: 30, longitude: 75, radiusMeters: 50, endsAt: new Date(Date.now() + 600000) } })));
  const identities = Array.from({ length: count }, (_, i) => ({ userId: randomUUID(), studentId: randomUUID(), room: i % rooms.length }));
  await db.user.createMany({ data: identities.map(item => ({ id: item.userId, email: item.userId + "@benchmark.invalid", name: "Synthetic student", password: "no-login", role: "STUDENT" })) });
  await db.student.createMany({ data: identities.map(item => ({ id: item.studentId, userId: item.userId, registrationNumber: item.studentId })) });
  await db.enrollment.createMany({ data: identities.map(item => ({ studentId: item.studentId, classroomId: rooms[item.room].id })) });
  const cookies = await Promise.all(identities.map(item => cookie(item.userId)));
  console.log("Starting two production server nodes for role-isolation and reconnect checks...");
  const first = await startServer(), second = await startServer();

  const acoustic = await db.attendanceSession.create({ data: { classroomId: rooms[0].id, method: "ULTRASOUND", frequencyMinHz: 17200, frequencyMaxHz: 18800, frequencyIntervalMs: 1100, minFrequencyMatches: 4, endsAt: new Date(Date.now() + 600000) } });
  function subscribe(url: string, role: "TEACHER" | "STUDENT", userId: string) {
    const ws = new WebSocket(url.replace("http:", "ws:") + "/ws/attendance");
    sockets.push(ws);
    const messages: Array<Record<string, unknown>> = [];
    ws.on("message", raw => messages.push(JSON.parse(raw.toString())));
    ws.on("open", () => ws.send(JSON.stringify({ type: "subscribe", sessionId: acoustic.id, ticket: createRealtimeTicket({ userId, role, sessionId: acoustic.id, classroomId: rooms[0].id, sessionEndsAt: acoustic.endsAt.getTime(), frequencyMinHz: 17200, frequencyMaxHz: 18800, frequencyIntervalMs: 1100, minFrequencyMatches: 4, protocolVersion: 2 }) })));
    ws.on("error", () => undefined);
    return { ws, messages };
  }
  async function waitFor(predicate: () => boolean, label: string) {
    for (let i = 0; i < 100; i++) { if (predicate()) return; await sleep(100); }
    throw new Error(label);
  }
  const receivers = identities.filter(item => item.room === 0).slice(0, 20).map(item => subscribe(second.url, "STUDENT", item.userId));
  const teacherSocket = subscribe(first.url, "TEACHER", teacherUserId);
  await waitFor(() => receivers.every(item => item.messages.some(message => message.type === "challenge_window")) && teacherSocket.messages.some(message => message.type === "frequency"), "WebSocket fanout failed");
  assert.ok(receivers.every(item => item.messages.every(message => !("frequency" in message))));
  const reconnect = subscribe(second.url, "TEACHER", teacherUserId);
  await once(reconnect.ws, "open");
  const failoverStart = performance.now();
  first.child.kill();
  await waitFor(() => reconnect.messages.some(message => message.type === "frequency"), "Room signal did not recover on the second node");
  const failoverMs = Math.round(performance.now() - failoverStart);
  for (const socket of sockets) socket.close();
  // Cross-driver roundtrip: custom server writes via pg; Prisma reads UTC timestamps.
  const commitments = await db.attendanceAuditEvent.findMany({ where: { sessionId: acoustic.id }, orderBy: { sequence: "asc" } });
  assert.ok(commitments.length > 0);
  let previousHash = AUDIT_GENESIS_HASH;
  for (const [index, event] of commitments.entries()) {
    assert.equal(event.sequence, index + 1);
    assert.equal(event.previousHash, previousHash);
    assert.equal(event.eventHash, computeAuditEventHash({ ...event, createdAt: event.createdAt.toISOString() }), "Custom server audit timestamps must roundtrip in UTC");
    previousHash = event.eventHash;
  }
  console.log("Role isolation passed; room signal recovered on the second node in " + failoverMs + " ms.");

  let cursor = 0;
  const latencies: number[] = [];
  const failures: Array<{ index: number; status: number }> = [];
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < identities.length) {
      const index = cursor++;
      const item = identities[index];
      const then = performance.now();
      const response = await fetch(second.url + "/api/attendance/mark", { method: "POST", redirect: "manual", headers: { "content-type": "application/json", cookie: cookies[index] }, body: JSON.stringify({ sessionId: sessions[item.room].id, latitude: 30, longitude: 75, accuracy: 5 }), signal: AbortSignal.timeout(30000) });
      await response.arrayBuffer();
      latencies.push(performance.now() - then);
      if (response.status !== 201) failures.push({ index, status: response.status });
    }
  }));
  const elapsedMs = performance.now() - started;
  latencies.sort((a, b) => a - b);
  const records = await db.attendanceRecord.count({ where: { sessionId: { in: sessions.map(session => session.id) } } });
  const report = {
    generatedAt: new Date().toISOString(), scenario: "Synthetic geolocation check-ins; pre-issued test auth cookies; local PostgreSQL + Redis; no physical sensor accuracy claim",
    students: count, classrooms: rooms.length, concurrentRequests: concurrency, records,
    elapsedMs: Math.round(elapsedMs), throughputPerSecond: Number((count / (elapsedMs / 1000)).toFixed(1)),
    p50Ms: Math.round(latencies[Math.floor(latencies.length * .5)]), p95Ms: Math.round(latencies[Math.floor(latencies.length * .95)]), p99Ms: Math.round(latencies[Math.floor(latencies.length * .99)]), failures,
    websocket: { nodes: 2, studentReceivers: receivers.length, expectedFrequencyDisclosure: false, teacherNodeFailoverMs: failoverMs, auditChainVerified: true },
    runtime: process.version, platform: process.platform,
  };
  await writeFile(".test-runtime/benchmark-latest.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.equal(failures.length, 0, "Every synthetic check-in must succeed");
  assert.equal(records, count, "Every student must have exactly one record");
  assert.ok(report.p95Ms < Number(process.env.BENCHMARK_P95_MS ?? 2000), "p95 latency exceeded the configured threshold");
} catch (error) {
  console.error(logs.slice(-10).join(""));
  throw error;
} finally {
  for (const socket of sockets) socket.terminate();
  for (const child of processes) if (child.exitCode === null) { child.kill(); await Promise.race([once(child, "exit"), sleep(5000)]); }
  await db.$disconnect();
}
