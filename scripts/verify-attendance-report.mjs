import { readFile } from "node:fs/promises";
import { createPublicKey, verify } from "node:crypto";
import {
  AUDIT_GENESIS_HASH,
  canonicalJson,
  computeAuditEventHash,
  sha256Hex,
} from "../src/lib/audit-core.js";

const path = process.argv[2];
if (!path) {
  console.error(
    "Usage: npm run report:verify -- <classpulse-report.json> [--trusted-key=<base64url-public-key>]",
  );
  process.exit(2);
}

const artifact = JSON.parse(await readFile(path, "utf8"));
if (artifact.schema !== "classpulse.attendance-report.v1") {
  console.error("Unsupported ClassPulse report schema.");
  process.exit(2);
}

let previousHash = AUDIT_GENESIS_HASH;
let chainValid =
  artifact.auditEvents.length === artifact.payload.eventCount;
for (const event of artifact.auditEvents) {
  const expected = computeAuditEventHash({
    sessionId: artifact.payload.sessionId,
    sequence: event.sequence,
    type: event.type,
    actorId: event.actorId,
    payload: event.payload,
    previousHash,
    createdAt: event.createdAt,
  });
  if (
    event.previousHash !== previousHash ||
    event.eventHash !== expected
  ) {
    chainValid = false;
    break;
  }
  previousHash = event.eventHash;
}
chainValid =
  chainValid && previousHash === artifact.payload.headHash;

const canonicalPayload = canonicalJson(artifact.payload);
const payloadHashValid =
  sha256Hex(canonicalPayload) === artifact.payloadHash;
let signatureValid = false;
try {
  const publicKey = createPublicKey({
    key: Buffer.from(artifact.publicKey, "base64url"),
    format: "der",
    type: "spki",
  });
  signatureValid = verify(
    null,
    Buffer.from(canonicalPayload),
    publicKey,
    Buffer.from(artifact.signature, "base64url"),
  );
} catch {
  signatureValid = false;
}
const trustedKeyArgument = process.argv.find((argument) =>
  argument.startsWith("--trusted-key="),
);
const trustedKey =
  trustedKeyArgument?.slice("--trusted-key=".length) ??
  process.env.ATTENDANCE_PUBLIC_KEY;
const signingIdentityTrusted = trustedKey
  ? trustedKey === artifact.publicKey
  : null;

const valid =
  chainValid &&
  payloadHashValid &&
  signatureValid &&
  signingIdentityTrusted !== false;
console.log(`Report: ${artifact.reportId}`);
console.log(`Hash chain: ${chainValid ? "VALID" : "INVALID"}`);
console.log(
  `Payload digest: ${payloadHashValid ? "VALID" : "INVALID"}`,
);
console.log(
  `Ed25519 signature: ${signatureValid ? "VALID" : "INVALID"}`,
);
console.log(
  `Signing identity: ${
    signingIdentityTrusted === null
      ? "UNPINNED"
      : signingIdentityTrusted
        ? "TRUSTED"
        : "UNTRUSTED"
  }`,
);
console.log(
  `Overall: ${
    valid
      ? signingIdentityTrusted === null
        ? "VALID CRYPTOGRAPHY (UNPINNED IDENTITY)"
        : "VALID"
      : "INVALID"
  }`,
);
process.exit(valid ? 0 : 1);
