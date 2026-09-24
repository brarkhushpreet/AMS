import { createHash } from "node:crypto";

export const AUDIT_GENESIS_HASH = "0".repeat(64);

/**
 * Serialize JSON with stable object-key ordering so hashes are reproducible
 * across processes and independent of insertion order.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const record = /** @type {Record<string, unknown>} */ (value);
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
  return `{${entries.join(",")}}`;
}

/**
 * @param {string | Uint8Array} value
 */
export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * @param {{
 *   sessionId: string;
 *   sequence: number;
 *   type: string;
 *   actorId?: string | null;
 *   payload: unknown;
 *   previousHash: string;
 *   createdAt: string;
 * }} event
 */
export function computeAuditEventHash(event) {
  return sha256Hex(
    canonicalJson({
      sessionId: event.sessionId,
      sequence: event.sequence,
      type: event.type,
      actorId: event.actorId ?? null,
      payload: event.payload,
      previousHash: event.previousHash,
      createdAt: event.createdAt,
    }),
  );
}
