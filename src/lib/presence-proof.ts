import { canonicalJson, sha256Hex } from "@/lib/audit-core.js";
import { getRedis } from "@/lib/redis";
import { db } from "@/lib/db";
import {
  buildAcousticChallenge,
  computeChallengeCommitment,
  verifyAcousticChallenge,
} from "@/lib/presence-core.js";

export type AcousticChallenge = {
  id: string;
  frequency: number;
  emittedAt: number;
  durationMs: number;
  commitment: string;
};

export type AcousticProof = {
  challengeId: string;
  observedHz: number;
  detectedAt: number;
  signalToNoiseDb: number;
  amplitude: number;
};

declare global {
  var __classpulseChallenges:
    | Map<string, AcousticChallenge[]>
    | undefined;
}

function proofSecret() {
  return (
    process.env.PRESENCE_PROOF_SECRET ??
    process.env.AUTH_SECRET ??
    "development-only-change-me"
  );
}

export function challengeCommitment(
  challenge: Omit<AcousticChallenge, "commitment">,
) {
  return computeChallengeCommitment(challenge, proofSecret());
}

export function verifyChallengeCommitment(challenge: AcousticChallenge) {
  return verifyAcousticChallenge(challenge, proofSecret());
}

export async function loadAcousticChallenge(
  session: {
    id: string;
    frequencyMinHz: number | null;
    frequencyMaxHz: number | null;
    frequencyIntervalMs: number | null;
  },
  challengeId: string,
) {
  const redis = await getRedis();
  let cached: string | null = null;
  if (redis?.isReady) {
    try {
      cached = await redis.get(
        `attendance:challenge:${session.id}:${challengeId}`,
      );
    } catch {
      // The custom server also keeps a bounded same-process fallback.
    }
  }
  const challenge = cached
    ? (JSON.parse(cached) as AcousticChallenge)
    : globalThis.__classpulseChallenges
        ?.get(session.id)
        ?.find((item) => item.id === challengeId) ?? null;
  if (challenge && verifyChallengeCommitment(challenge)) return challenge;

  // Cloudflare and the standalone WebSocket service do not share memory. The
  // committed audit event is the durable fallback when Redis is not configured.
  const committed = await db.attendanceAuditEvent.findFirst({
    where: {
      sessionId: session.id,
      type: "CHALLENGE_COMMITTED",
      createdAt: { gte: new Date(Date.now() - 90_000) },
      payload: { path: ["challengeId"], equals: challengeId },
    },
    select: { payload: true },
  });
  const payload = committed?.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const { emittedAt, durationMs, commitment } = payload;
  if (typeof emittedAt !== "number" || typeof durationMs !== "number" || typeof commitment !== "string") return null;
  const reconstructed = buildAcousticChallenge({
    sessionId: session.id,
    emittedAt,
    minHz: session.frequencyMinHz ?? 17_200,
    maxHz: session.frequencyMaxHz ?? 18_800,
    intervalMs: session.frequencyIntervalMs ?? 1_100,
    secret: proofSecret(),
  });
  if (reconstructed.id !== challengeId || reconstructed.durationMs !== durationMs || reconstructed.commitment !== commitment) {
    console.warn("[presence:acoustic] committed challenge could not be verified; check proof-secret parity between services");
    return null;
  }
  return reconstructed;
}

export function scoreAcousticProofs(
  matches: Array<{
    proof: AcousticProof;
    challenge: AcousticChallenge;
  }>,
) {
  if (matches.length === 0) return 0;
  const values = matches.map(({ proof, challenge }) => {
    const frequencyScore = Math.max(
      0,
      1 - Math.abs(proof.observedHz - challenge.frequency) / 95,
    );
    const timingScore = Math.max(
      0,
      1 - Math.abs(proof.detectedAt - challenge.emittedAt) / 2_200,
    );
    const signalScore = Math.max(
      0,
      Math.min(1, (proof.signalToNoiseDb - 3) / 18),
    );
    return frequencyScore * 0.55 + timingScore * 0.2 + signalScore * 0.25;
  });
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function hashPresenceProof(value: unknown) {
  return sha256Hex(canonicalJson(value));
}
