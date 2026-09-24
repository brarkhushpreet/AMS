import { createHmac } from "node:crypto";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateAuthenticationOptionsOpts,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorDevice,
} from "@simplewebauthn/types";
import type { PasskeyCredential } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export function normalizeRecoveryCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function recoveryCodeHash(value: string) {
  const secret =
    process.env.ATTENDANCE_SIGNING_SECRET ??
    process.env.AUTH_SECRET ??
    "development-only-change-me";
  return createHmac("sha256", secret)
    .update(
      `classpulse:passkey-recovery:${normalizeRecoveryCode(value)}`,
    )
    .digest("hex");
}

export function webAuthnConfig(request: Request) {
  const url = new URL(request.url);
  const rpID = process.env.WEBAUTHN_RP_ID ?? url.hostname;
  const origin =
    process.env.WEBAUTHN_ORIGIN ??
    `${url.protocol}//${url.host}`;
  return {
    rpID,
    origin,
    rpName: "ClassPulse",
  };
}

export function authenticationOptions(
  request: Request,
  passkeys: PasskeyCredential[],
) {
  const { rpID } = webAuthnConfig(request);
  const options: GenerateAuthenticationOptionsOpts = {
    rpID,
    timeout: 60_000,
    userVerification: "required",
    allowCredentials: passkeys.map((passkey) => ({
      id: Buffer.from(passkey.id, "base64url"),
      type: "public-key",
      transports: passkey.transports as AuthenticatorTransport[],
    })),
  };
  return generateAuthenticationOptions(options);
}

export async function verifyUserPasskey({
  request,
  userId,
  expectedChallenge,
  response,
}: {
  request: Request;
  userId: string;
  expectedChallenge: string;
  response: AuthenticationResponseJSON;
}) {
  const passkey = await db.passkeyCredential.findFirst({
    where: { id: response.id, userId },
  });
  if (!passkey) {
    throw new Error("This passkey is not registered to your account.");
  }
  const { origin, rpID } = webAuthnConfig(request);
  const authenticator: AuthenticatorDevice = {
    credentialID: Buffer.from(passkey.id, "base64url"),
    credentialPublicKey: new Uint8Array(passkey.publicKey),
    counter: Number(passkey.counter),
    transports:
      passkey.transports as AuthenticatorTransport[],
  };
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    authenticator,
    requireUserVerification: true,
  });
  if (!verification.verified) {
    throw new Error("The passkey signature could not be verified.");
  }
  return { passkey, verification };
}
