import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import { consumeRateLimit } from "@/lib/rate-limit";
import { webAuthnConfig } from "@/lib/webauthn";

export async function POST(request: Request) {
  const profile = await requireProfile();
  const body = await request.json().catch(() => ({}));
  const managementToken =
    typeof body.managementToken === "string"
      ? body.managementToken
      : null;
  const rate = await consumeRateLimit({
    key: `passkey-register:${profile.id}`,
    limit: 5,
    windowSeconds: 300,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many passkey attempts. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const passkeys = await db.passkeyCredential.findMany({
    where: { userId: profile.id },
  });
  if (profile.attendancePasskeyRequired) {
    const authorization = managementToken
      ? await db.webAuthnCeremony.findFirst({
          where: {
            id: managementToken,
            userId: profile.id,
            type: "MANAGEMENT",
            authorizedAt: { not: null },
            expiresAt: { gt: new Date() },
          },
        })
      : null;
    if (!authorization) {
      return NextResponse.json(
        {
          error:
            "Confirm an existing passkey before registering another device.",
          requiresManagementAuthorization: true,
        },
        { status: 403 },
      );
    }
  }
  const { rpID, rpName } = webAuthnConfig(request);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: profile.id,
    userName: profile.email,
    userDisplayName: profile.name,
    timeout: 60_000,
    attestationType: "none",
    excludeCredentials: passkeys.map((passkey) => ({
      id: Buffer.from(passkey.id, "base64url"),
      type: "public-key",
      transports: passkey.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${profile.id} FOR UPDATE`;
    const current = await tx.user.findUnique({ where: { id: profile.id } });
    if (current?.attendancePasskeyRequired && !managementToken) {
      throw new Error("Confirm an existing passkey before registering another device.");
    }
    if (managementToken) {
      const consumed = await tx.webAuthnCeremony.deleteMany({
        where: {
          id: managementToken,
          userId: profile.id,
          type: "MANAGEMENT",
          authorizedAt: { not: null },
          expiresAt: { gt: new Date() },
        },
      });
      if (consumed.count !== 1) {
        throw new Error(
          "The passkey management authorization was already used.",
        );
      }
    }
    await tx.webAuthnCeremony.deleteMany({
      where: { userId: profile.id, type: "REGISTRATION" },
    });
    await tx.webAuthnCeremony.create({
      data: {
        userId: profile.id,
        type: "REGISTRATION",
        challenge: options.challenge,
        authorizedAt: managementToken ? new Date() : null,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
  });

  return NextResponse.json(options);
}
