import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalJson } from "./audit-core.js";

/**
 * @param {string} sessionId
 * @param {number} slot
 * @param {number} minHz
 * @param {number} maxHz
 * @param {string} secret
 */
export function frequencyForSlot(
  sessionId,
  slot,
  minHz,
  maxHz,
  secret,
) {
  const count = Math.floor((maxHz - minHz) / 100) + 1;
  if (!Number.isSafeInteger(slot) || count < 3 || count > 81) {
    throw new Error("Frequency hopping requires an integer slot and 3–81 frequency bins.");
  }
  // Independently reproducible shuffled banks, with a boundary swap that never
  // changes the final symbol. This guarantees no adjacent repeats, including
  // across banks, without sharing mutable sequence state between server nodes.
  const permutation = (block) => {
    const bins = Array.from({ length: count }, (_, index) => index);
    for (let index = count - 1; index > 0; index -= 1) {
      const digest = createHmac("sha256", secret)
        .update(`${sessionId}:${block}:${index}:frequency-bank:v3`)
        .digest();
      const swap = digest.readUInt32BE(0) % (index + 1);
      [bins[index], bins[swap]] = [bins[swap], bins[index]];
    }
    return bins;
  };
  const block = Math.floor(slot / count);
  const bins = permutation(block);
  if (bins[0] === permutation(block - 1).at(-1)) {
    [bins[0], bins[1]] = [bins[1], bins[0]];
  }
  return minHz + bins[((slot % count) + count) % count] * 100;
}

/**
 * @param {{
 *   id: string;
 *   frequency: number;
 *   emittedAt: number;
 *   durationMs: number;
 * }} challenge
 * @param {string} secret
 */
export function computeChallengeCommitment(challenge, secret) {
  return createHmac("sha256", secret)
    .update(canonicalJson(challenge))
    .digest("base64url");
}

/**
 * @param {{
 *   sessionId: string;
 *   emittedAt: number;
 *   minHz: number;
 *   maxHz: number;
 *   intervalMs: number;
 *   secret: string;
 * }} input
 */
export function buildAcousticChallenge(input) {
  const slot = Math.floor(input.emittedAt / input.intervalMs);
  const frequency = frequencyForSlot(
    input.sessionId,
    slot,
    input.minHz,
    input.maxHz,
    input.secret,
  );
  const id = createHmac("sha256", input.secret)
    .update(`${input.sessionId}:${slot}:challenge-id`)
    .digest("base64url")
    .slice(0, 24);
  const durationMs = Math.min(760, input.intervalMs - 260);
  const unsigned = {
    id,
    frequency,
    emittedAt: input.emittedAt,
    durationMs,
  };
  return {
    ...unsigned,
    commitment: computeChallengeCommitment(unsigned, input.secret),
  };
}

/**
 * @param {{
 *   id: string;
 *   frequency: number;
 *   emittedAt: number;
 *   durationMs: number;
 *   commitment: string;
 * }} challenge
 * @param {string} secret
 */
export function verifyAcousticChallenge(challenge, secret) {
  const unsigned = {
    id: challenge.id,
    frequency: challenge.frequency,
    emittedAt: challenge.emittedAt,
    durationMs: challenge.durationMs,
  };
  const expected = Buffer.from(
    computeChallengeCommitment(unsigned, secret),
    "base64url",
  );
  const supplied = Buffer.from(challenge.commitment, "base64url");
  return (
    expected.length === supplied.length &&
    timingSafeEqual(expected, supplied)
  );
}
