import "dotenv/config";
import { createServer } from "node:http";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import next from "next";
import { createClient } from "redis";
import { WebSocket, WebSocketServer } from "ws";

const production = process.argv.includes("--production");
if (production) process.env.NODE_ENV = "production";

// `HOSTNAME` is set automatically to the computer name on Windows and in many
// containers. Using it here binds the server to one network interface and can
// make localhost refuse the connection, so only honor our explicit app setting.
const hostname = process.env.APP_HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev: !production, hostname, port });
const handle = app.getRequestHandler();
const channels = new Map();

globalThis.__classpulseChallenges ??= new Map();

let redis = null;
if (process.env.REDIS_URL) {
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 750, reconnectStrategy: false },
  });
  client.on("error", () => undefined);
  try {
    await client.connect();
    redis = client;
  } catch {
    await client.disconnect().catch(() => undefined);
  }
}

function verifyTicket(value) {
  const [payload, suppliedSignature] = String(value ?? "").split(".");
  if (!payload || !suppliedSignature) return null;
  const expectedSignature = createHmac(
    "sha256",
    process.env.AUTH_SECRET ?? "development-only-change-me",
  )
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
    return ticket.exp > Math.floor(Date.now() / 1000) ? ticket : null;
  } catch {
    return null;
  }
}

function nextFrequency(previous) {
  const options = Array.from({ length: 17 }, (_, index) => 17_200 + index * 100)
    .filter((frequency) => Math.abs(frequency - (previous ?? 0)) >= 300);
  return options[randomInt(0, options.length)];
}

async function emitChallenge(sessionId) {
  const channel = channels.get(sessionId);
  if (!channel || channel.clients.size === 0) return;
  if (Date.now() >= channel.endsAt) {
    for (const client of channel.clients) {
      client.close(4408, "Session ended");
    }
    return;
  }

  const frequency = nextFrequency(channel.lastFrequency);
  channel.lastFrequency = frequency;
  const challenge = {
    id: randomUUID(),
    frequency,
    emittedAt: Date.now() + 180,
    durationMs: 720,
  };
  const recent = [
    ...(globalThis.__classpulseChallenges.get(sessionId) ?? []),
    challenge,
  ].slice(-12);
  globalThis.__classpulseChallenges.set(sessionId, recent);

  if (redis?.isReady) {
    await redis.set(`attendance:challenges:${sessionId}`, JSON.stringify(recent), {
      EX: 75,
    });
    await redis.publish(
      `attendance:live:${sessionId}`,
      JSON.stringify(challenge),
    );
  }

  const message = JSON.stringify({ type: "frequency", ...challenge });
  for (const client of channel.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}

function joinChannel(sessionId, socket, endsAt) {
  let channel = channels.get(sessionId);
  if (!channel) {
    channel = {
      clients: new Set(),
      lastFrequency: null,
      timer: null,
      endsAt,
    };
    channels.set(sessionId, channel);
  }

  channel.clients.add(socket);
  if (!channel.timer) {
    void emitChallenge(sessionId);
    channel.timer = setInterval(() => void emitChallenge(sessionId), 1_100);
  }
}

function leaveChannel(sessionId, socket) {
  const channel = channels.get(sessionId);
  if (!channel) return;
  channel.clients.delete(socket);
  if (channel.clients.size === 0) {
    clearInterval(channel.timer);
    channels.delete(sessionId);
    setTimeout(() => {
      if (!channels.has(sessionId)) {
        globalThis.__classpulseChallenges.delete(sessionId);
      }
    }, 75_000).unref();
  }
}

await app.prepare();

const server = createServer((request, response) => handle(request, response));
const webSocketServer = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url ?? "/", `http://${request.headers.host}`).pathname;
  if (pathname !== "/ws/attendance") return;

  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit("connection", webSocket, request);
  });
});

webSocketServer.on("connection", (socket) => {
  let sessionId = null;
  const authenticationTimeout = setTimeout(() => socket.close(4401, "Authentication required"), 5_000);

  socket.on("message", (rawMessage) => {
    try {
      const message = JSON.parse(rawMessage.toString());
      if (message.type !== "subscribe" || sessionId) return;
      const ticket = verifyTicket(message.ticket);
      if (!ticket || ticket.sessionId !== message.sessionId) {
        socket.close(4403, "Invalid ticket");
        return;
      }
      clearTimeout(authenticationTimeout);
      sessionId = ticket.sessionId;
      joinChannel(sessionId, socket, ticket.sessionEndsAt);
      socket.send(
        JSON.stringify({
          type: "ready",
          sessionId,
          intervalMs: 1_100,
          role: ticket.role,
        }),
      );
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "Invalid message" }));
    }
  });

  socket.on("close", () => {
    clearTimeout(authenticationTimeout);
    if (sessionId) leaveChannel(sessionId, socket);
  });
});

server.listen(port, hostname, () => {
  const shownHost = hostname === "0.0.0.0" ? "localhost" : hostname;
  console.log(`ClassPulse ready at http://${shownHost}:${port}`);
});

async function shutdown() {
  webSocketServer.close();
  server.close();
  if (redis?.isOpen) await redis.quit();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
