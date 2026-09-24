import "dotenv/config";
import { createServer } from "node:http";
import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import next from "next";
import { Pool } from "pg";
import { createClient } from "redis";
import { WebSocket, WebSocketServer } from "ws";
import {
  AUDIT_GENESIS_HASH,
  computeAuditEventHash,
} from "./src/lib/audit-core.js";
import {
  buildAcousticChallenge,
} from "./src/lib/presence-core.js";
import { RENEW_OR_ACQUIRE_LEASE, PUBLISH_CHALLENGE } from "./src/lib/redis-protocol.js";

const production = process.argv.includes("--production");
const realtimeOnly = process.argv.includes("--realtime-only");
if (production) process.env.NODE_ENV = "production";

const hostname = process.env.APP_HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const instanceId = randomUUID();
const app = realtimeOnly ? null : next({ dev: !production, hostname, port });
const channels = new Map();
const auditPool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/classpulse",
});

globalThis.__classpulseChallenges ??= new Map();

let redis = null;
let redisSubscriber = null;
if (process.env.REDIS_URL) {
  const client = createClient({
    url: process.env.REDIS_URL,
    disableOfflineQueue: true,
    socket: { connectTimeout: 1_500, reconnectStrategy: (retries) => Math.min(250 * (retries + 1), 3_000) },
  });
  client.on("error", () => undefined);
  const subscriber = client.duplicate();
  subscriber.on("error", () => undefined);
  redis = client;
  redisSubscriber = subscriber;
  try {
    // Bound startup but keep reconnecting. Never fall back to split-brain local emission.
    await Promise.race([Promise.all([client.connect(), subscriber.connect()]), new Promise((_, reject) => setTimeout(() => reject(new Error("Redis startup timeout")), 2_000).unref())]);
  } catch {
    console.warn("Redis unavailable: acoustic sessions paused; reconnecting in the background.");
  }
}

function ticketSecret() {
  return process.env.AUTH_SECRET ?? "development-only-change-me";
}

function presenceSecret() {
  return (
    process.env.PRESENCE_PROOF_SECRET ??
    process.env.AUTH_SECRET ??
    "development-only-change-me"
  );
}

function verifyTicket(value) {
  const [payload, suppliedSignature] = String(value ?? "").split(".");
  if (!payload || !suppliedSignature) return null;
  const expectedSignature = createHmac("sha256", ticketSecret())
    .update(payload)
    .digest("base64url");
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    return null;
  }
  try {
    const ticket = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    const validRole =
      ticket.role === "TEACHER" || ticket.role === "STUDENT";
    const validProtocol =
      ticket.protocolVersion === 2 &&
      Number.isFinite(ticket.frequencyMinHz) &&
      Number.isFinite(ticket.frequencyMaxHz) &&
      Number.isFinite(ticket.frequencyIntervalMs);
    return ticket.exp > Math.floor(Date.now() / 1000) &&
      validRole &&
      validProtocol
      ? ticket
      : null;
  } catch {
    return null;
  }
}

function buildChallenge(sessionId, channel, emittedAt) {
  return buildAcousticChallenge({
    sessionId,
    emittedAt,
    minHz: channel.minHz,
    maxHz: channel.maxHz,
    intervalMs: channel.intervalMs,
    secret: presenceSecret(),
  });
}

function rememberChallenge(sessionId, challenge) {
  const recent = [
    ...(globalThis.__classpulseChallenges
      .get(sessionId)
      ?.filter((item) => item.id !== challenge.id) ?? []),
    challenge,
  ].slice(-18);
  globalThis.__classpulseChallenges.set(sessionId, recent);
}

async function insertAuditEventWithClient(client, {
  sessionId,
  type,
  actorId = null,
  payload,
  createdAt = new Date(),
}) {
  await client.query(
    'SELECT "id" FROM "AttendanceSession" WHERE "id" = $1 FOR UPDATE',
    [sessionId],
  );
  const previousResult = await client.query(
    'SELECT "sequence", "eventHash" FROM "AttendanceAuditEvent" WHERE "sessionId" = $1 ORDER BY "sequence" DESC LIMIT 1',
    [sessionId],
  );
  const previous = previousResult.rows[0];
  const sequence = (previous?.sequence ?? 0) + 1;
  const previousHash = previous?.eventHash ?? AUDIT_GENESIS_HASH;
  const createdAtIso = createdAt.toISOString();
  const eventHash = computeAuditEventHash({
    sessionId,
    sequence,
    type,
    actorId,
    payload,
    previousHash,
    createdAt: createdAtIso,
  });
  await client.query(
    `INSERT INTO "AttendanceAuditEvent"
      ("id", "sessionId", "sequence", "type", "actorId", "payload", "previousHash", "eventHash", "createdAt")
     VALUES ($1, $2, $3, $4::"AttendanceAuditEventType", $5, $6::jsonb, $7, $8, $9)`,
    [
      randomUUID(),
      sessionId,
      sequence,
      type,
      actorId,
      JSON.stringify(payload),
      previousHash,
      eventHash,
      createdAtIso,
    ],
  );
}

async function appendAuditEventPg(input) {
  const client = await auditPool.connect();
  try {
    await client.query("BEGIN");
    const state = await client.query(
      'SELECT "status", "endsAt" AT TIME ZONE \'UTC\' AS "endsAt" FROM "AttendanceSession" WHERE "id" = $1 FOR UPDATE',
      [input.sessionId],
    );
    if (state.rows[0]?.status !== "ACTIVE" || new Date(state.rows[0].endsAt).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      return false;
    }
    await insertAuditEventWithClient(client, input);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (process.env.NODE_ENV !== "production") {
      console.warn("ClassPulse audit event could not be persisted:", error.message);
    }
    return false;
  } finally {
    client.release();
  }
}

async function closeExpiredSession(sessionId) {
  const client = await auditPool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE "AttendanceSession"
       SET "status" = 'CLOSED', "updatedAt" = timezone('UTC', CURRENT_TIMESTAMP)
       WHERE "id" = $1 AND "status" = 'ACTIVE' AND "endsAt" <= timezone('UTC', CURRENT_TIMESTAMP)
       RETURNING "id"`,
      [sessionId],
    );
    if (result.rowCount) {
      await insertAuditEventWithClient(client, {
        sessionId,
        type: "SESSION_CLOSED",
        payload: { reason: "AUTO_EXPIRED" },
      });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (process.env.NODE_ENV !== "production") {
      console.warn("ClassPulse session close could not be persisted:", error.message);
    }
  } finally {
    client.release();
  }
}

function sendJson(socket, message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcastChallenge(sessionId, challenge) {
  const channel = channels.get(sessionId);
  if (!channel) return;
  rememberChallenge(sessionId, challenge);

  for (const [socket, client] of channel.clients) {
    if (client.role === "TEACHER") {
      sendJson(socket, {
        type: "frequency",
        protocolVersion: 2,
        id: challenge.id,
        frequency: challenge.frequency,
        emittedAt: challenge.emittedAt,
        durationMs: challenge.durationMs,
      });
    } else {
      sendJson(socket, {
        type: "challenge_window",
        protocolVersion: 2,
        id: challenge.id,
        emittedAt: challenge.emittedAt,
        durationMs: challenge.durationMs,
        minHz: channel.minHz,
        maxHz: channel.maxHz,
        stepHz: 100,
      });
    }
  }
}

async function ensureRedisSubscription(sessionId) {
  const channel = channels.get(sessionId);
  if (!channel || !redisSubscriber?.isReady || channel.subscribed) return;
  await redisSubscriber.subscribe(
    `attendance:live:${sessionId}`,
    (message) => {
      try {
        broadcastChallenge(sessionId, JSON.parse(message));
      } catch {
        // Ignore malformed broker messages.
      }
    },
  );
  channel.subscribed = true;
}

async function ownsSessionLeadership(sessionId) {
  if (!process.env.REDIS_URL) return true;
  if (!redis?.isReady || !redisSubscriber?.isReady) return false;
  return await redis.eval(RENEW_OR_ACQUIRE_LEASE, {
    keys: [`attendance:leader:${sessionId}`],
    arguments: [instanceId, "3500"],
  }) === 1;
}

async function emitChallenge(sessionId) {
  const channel = channels.get(sessionId);
  if (!channel) return;
  const available = !process.env.REDIS_URL || Boolean(redis?.isReady && redisSubscriber?.isReady);
  if (channel.available !== available) {
    channel.available = available;
    for (const socket of channel.clients.keys()) sendJson(socket, { type: "coordinator", available });
  }
  if (!available) return;
  if (Date.now() >= channel.endsAt) {
    await closeExpiredSession(sessionId);
    for (const client of channel.clients.keys()) {
      client.close(4408, "Session ended");
    }
    return;
  }
  if (redis && !channel.subscribed) await ensureRedisSubscription(sessionId);
  if (!channel.hasLocalTeacher) return;
  if (!(await ownsSessionLeadership(sessionId))) return;

  const emittedAt =
    Math.ceil((Date.now() + 240) / channel.intervalMs) *
    channel.intervalMs;
  const slot = Math.floor(emittedAt / channel.intervalMs);
  if (slot === channel.lastSlot) return;

  channel.lastSlot = slot;
  const challenge = buildChallenge(sessionId, channel, emittedAt);
  const committed = await appendAuditEventPg({
    sessionId,
    type: "CHALLENGE_COMMITTED",
    payload: {
      challengeId: challenge.id,
      commitment: challenge.commitment,
      emittedAt: challenge.emittedAt,
      durationMs: challenge.durationMs,
    },
  });
  if (!committed || emittedAt <= Date.now()) return;
  if (redis) {
    await redis.eval(PUBLISH_CHALLENGE, {
      keys: [
        `attendance:leader:${sessionId}`,
        `attendance:slot:${sessionId}:${slot}`,
        `attendance:challenge:${sessionId}:${challenge.id}`,
      ],
      arguments: [instanceId, "90000", JSON.stringify(challenge), `attendance:live:${sessionId}`],
    });
  } else if (!process.env.REDIS_URL) {
    broadcastChallenge(sessionId, challenge);
  }
}

function ensureChannel(ticket) {
  let channel = channels.get(ticket.sessionId);
  if (!channel) {
    channel = {
      clients: new Map(),
      timer: null,
      emitting: false,
      subscribed: false,
      hasLocalTeacher: false,
      lastSlot: null,
      endsAt: ticket.sessionEndsAt,
      minHz: ticket.frequencyMinHz,
      maxHz: ticket.frequencyMaxHz,
      intervalMs: ticket.frequencyIntervalMs,
      matchesRequired: ticket.minFrequencyMatches,
    };
    channels.set(ticket.sessionId, channel);
  }
  return channel;
}

function joinChannel(ticket, socket) {
  const channel = ensureChannel(ticket);
  channel.clients.set(socket, {
    role: ticket.role,
    userId: ticket.userId,
  });
  channel.hasLocalTeacher = [...channel.clients.values()].some(
    (client) => client.role === "TEACHER",
  );
  if (redis) {
    void ensureRedisSubscription(ticket.sessionId).catch(() => undefined);
  }
  if (!channel.timer) {
    channel.timer = setInterval(
      () => {
        if (channel.emitting) return;
        channel.emitting = true;
        void emitChallenge(ticket.sessionId).catch((error) => {
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "ClassPulse challenge coordinator recovered from an error:",
              error.message,
            );
          }
        }).finally(() => { channel.emitting = false; });
      },
      180,
    );
  }
}

async function releaseLeadership(sessionId) {
  if (!redis) return;
  await redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then
       return redis.call("del", KEYS[1])
     end
     return 0`,
    {
      keys: [`attendance:leader:${sessionId}`],
      arguments: [instanceId],
    },
  );
}

function leaveChannel(sessionId, socket) {
  const channel = channels.get(sessionId);
  if (!channel) return;
  const hadLocalTeacher = channel.hasLocalTeacher;
  channel.clients.delete(socket);
  channel.hasLocalTeacher = [...channel.clients.values()].some(
    (client) => client.role === "TEACHER",
  );
  if (hadLocalTeacher && !channel.hasLocalTeacher) {
    void releaseLeadership(sessionId).catch(() => undefined);
  }
  if (channel.clients.size > 0) return;

  clearInterval(channel.timer);
  channels.delete(sessionId);
  void releaseLeadership(sessionId).catch(() => undefined);
  if (redisSubscriber && channel.subscribed) {
    void redisSubscriber.unsubscribe(`attendance:live:${sessionId}`).catch(() => undefined);
  }
  setTimeout(() => {
    if (!channels.has(sessionId)) {
      globalThis.__classpulseChallenges.delete(sessionId);
    }
  }, 90_000).unref();
}

if (app) await app.prepare();

const server = createServer((request, response) => {
  if (app) return app.getRequestHandler()(request, response);
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "classpulse-realtime" }));
    return;
  }
  response.writeHead(404).end();
});
const webSocketServer = new WebSocketServer({
  noServer: true,
  maxPayload: 16 * 1024,
  perMessageDeflate: false,
});

server.on("upgrade", (request, socket, head) => {
  let pathname;
  try {
    pathname = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    ).pathname;
  } catch {
    socket.destroy();
    return;
  }
  if (pathname !== "/ws/attendance") {
    if (app && pathname.startsWith("/_next/")) {
      void app.getUpgradeHandler()(request, socket, head);
    } else socket.destroy();
    return;
  }
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (
    production &&
    (allowedOrigins.length === 0 || !allowedOrigins.includes(request.headers.origin ?? ""))
  ) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit("connection", webSocket, request);
  });
});

webSocketServer.on("connection", (socket) => {
  let ticket = null;
  const authenticationTimeout = setTimeout(
    () => socket.close(4401, "Authentication required"),
    5_000,
  );

  socket.on("message", (rawMessage) => {
    try {
      const message = JSON.parse(rawMessage.toString());
      if (message.type !== "subscribe" || ticket) return;
      const verifiedTicket = verifyTicket(message.ticket);
      if (
        !verifiedTicket ||
        verifiedTicket.sessionId !== message.sessionId
      ) {
        socket.close(4403, "Invalid ticket");
        return;
      }
      clearTimeout(authenticationTimeout);
      ticket = verifiedTicket;
      joinChannel(ticket, socket);
      sendJson(socket, {
        type: "ready",
        sessionId: ticket.sessionId,
        intervalMs: ticket.frequencyIntervalMs,
        matchesRequired: ticket.minFrequencyMatches,
        role: ticket.role,
        serverTime: Date.now(),
        protocolVersion: 2,
        expectedFrequencyDisclosure: ticket.role === "TEACHER",
        distributedCoordinator: Boolean(redis?.isReady && redisSubscriber?.isReady),
        coordinatorUnavailable: Boolean(process.env.REDIS_URL && (!redis?.isReady || !redisSubscriber?.isReady)),
      });
    } catch {
      sendJson(socket, { type: "error", message: "Invalid message" });
    }
  });

  socket.on("close", () => {
    clearTimeout(authenticationTimeout);
    if (ticket) leaveChannel(ticket.sessionId, socket);
  });
});

server.listen(port, hostname, () => {
  const shownHost = hostname === "0.0.0.0" ? "localhost" : hostname;
  console.log(`${realtimeOnly ? "ClassPulse realtime" : "ClassPulse"} ready at http://${shownHost}:${port}`);
});

async function shutdown() {
  for (const channel of channels.values()) clearInterval(channel.timer);
  webSocketServer.close();
  server.close();
  await Promise.all([
    redisSubscriber?.isOpen
      ? redisSubscriber.quit()
      : Promise.resolve(),
    redis?.isOpen ? redis.quit() : Promise.resolve(),
    auditPool.end(),
  ]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
