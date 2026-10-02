import { readFile } from "node:fs/promises";
import { createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
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

let teacherAttestationValid = null;
if (artifact.teacherAttestation) {
  teacherAttestationValid = false;
  try {
    const approval = artifact.teacherAttestation;
    const challenge = Buffer.from(approval.challenge, "base64url");
    const signedAction = { action: "SIGN_REPORT", reportId: artifact.reportId, reportHash: artifact.payloadHash };
    const expectedDigest = Buffer.from(sha256Hex(canonicalJson(signedAction)), "hex");
    const certificate = {
      schema: "classpulse.teacher-approval.v1",
      reportId: artifact.reportId,
      reportHash: approval.reportHash,
      teacherUserId: approval.teacherUserId,
      credentialId: approval.credentialId,
      publicKeyHash: sha256Hex(Buffer.from(approval.publicKey, "base64url")),
      challenge: approval.challenge,
      origin: approval.origin,
      rpId: approval.rpId,
      counterBefore: String(approval.counterBefore),
      signedAt: approval.signedAt,
    };
    const certificateValid = verify(
      null,
      Buffer.from(canonicalJson(certificate)),
      createPublicKey({ key: Buffer.from(artifact.publicKey, "base64url"), format: "der", type: "spki" }),
      Buffer.from(approval.serverSignature, "base64url"),
    );
    if (certificateValid && challenge.length === 64 && timingSafeEqual(challenge.subarray(32), expectedDigest) && approval.reportHash === artifact.payloadHash) {
      const result = await verifyAuthenticationResponse({
        response: approval.assertion,
        expectedChallenge: approval.challenge,
        expectedOrigin: approval.origin,
        expectedRPID: approval.rpId,
        authenticator: {
          credentialID: Buffer.from(approval.credentialId, "base64url"),
          credentialPublicKey: Buffer.from(approval.publicKey, "base64url"),
          counter: Number(approval.counterBefore),
          transports: [],
        },
        requireUserVerification: true,
      });
      teacherAttestationValid = result.verified;
    }
  } catch {
    teacherAttestationValid = false;
  }
}

const valid =
  chainValid &&
  payloadHashValid &&
  signatureValid &&
  signingIdentityTrusted !== false &&
  teacherAttestationValid !== false;
console.log(`Report: ${artifact.reportId}`);
console.log(`Hash chain: ${chainValid ? "VALID" : "INVALID"}`);
console.log(
  `Payload digest: ${payloadHashValid ? "VALID" : "INVALID"}`,
);
console.log(
  `Ed25519 signature: ${signatureValid ? "VALID" : "INVALID"}`,
);
console.log(`Teacher passkey: ${teacherAttestationValid === null ? "NOT SIGNED" : teacherAttestationValid ? "VALID" : "INVALID"}`);
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
