import { createHmac, timingSafeEqual } from "node:crypto";

export type RealtimeTicket = {
  userId: string;
  sessionId: string;
  classroomId: string;
  role: "STUDENT" | "TEACHER";
  sessionEndsAt: number;
  frequencyMinHz: number;
  frequencyMaxHz: number;
  frequencyIntervalMs: number;
  minFrequencyMatches: number;
  protocolVersion: 2;
  exp: number;
};

function secret() {
  return process.env.AUTH_SECRET ?? "development-only-change-me";
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createRealtimeTicket(
  ticket: Omit<RealtimeTicket, "exp">,
  lifetimeSeconds = 120,
) {
  const payload = Buffer.from(
    JSON.stringify({
      ...ticket,
      exp: Math.floor(Date.now() / 1000) + lifetimeSeconds,
    }),
  ).toString("base64url");

  return `${payload}.${signature(payload)}`;
}

export function verifyRealtimeTicket(value: string): RealtimeTicket | null {
  const [payload, suppliedSignature] = value.split(".");
  if (!payload || !suppliedSignature) return null;

  const expected = Buffer.from(signature(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null;
  }

  try {
    const ticket = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as RealtimeTicket;
    if (ticket.exp <= Math.floor(Date.now() / 1000)) return null;
    return ticket;
  } catch {
    return null;
  }
}
