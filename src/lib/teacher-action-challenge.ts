import { randomBytes, timingSafeEqual } from "node:crypto";
import { canonicalJson, sha256Hex } from "@/lib/audit-core.js";

export function makeTeacherActionChallenge(payload: unknown) {
  const digest = Buffer.from(sha256Hex(canonicalJson(payload)), "hex");
  return Buffer.concat([randomBytes(32), digest]);
}

export function matchesTeacherActionChallenge(challenge: string, payload: unknown) {
  const bytes = Buffer.from(challenge, "base64url");
  if (bytes.length !== 64) return false;
  const digest = Buffer.from(sha256Hex(canonicalJson(payload)), "hex");
  return timingSafeEqual(bytes.subarray(32), digest);
}
