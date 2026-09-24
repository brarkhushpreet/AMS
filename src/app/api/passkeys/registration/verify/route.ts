import {
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { randomBytes } from "node:crypto";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  recoveryCodeHash,
  webAuthnConfig,
} from "@/lib/webauthn";

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  response: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const profile = await requireProfile();
  const rate = await consumeRateLimit({
    key: `passkey-register-verify:${profile.id}`,
    limit: 8,
    windowSeconds: 300,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many verification attempts." },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "The passkey response is incomplete." },
      { status: 400 },
    );
  }

  const ceremony = await db.webAuthnCeremony.findFirst({
    where: {
      userId: profile.id,
      type: "REGISTRATION",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!ceremony) {
    return NextResponse.json(
      { error: "The registration request expired. Start again." },
      { status: 410 },
    );
  }

  try {
    const { rpID, origin } = webAuthnConfig(request);
    const verification = await verifyRegistrationResponse({
      response: parsed.data
        .response as unknown as RegistrationResponseJSON,
      expectedChallenge: ceremony.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("The authenticator response could not be verified.");
    }

    const {
      credentialID,
      credentialPublicKey,
      counter,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;
    const id = Buffer.from(credentialID).toString("base64url");
    const response = parsed.data
      .response as unknown as RegistrationResponseJSON;
    const transports = response.response.transports ?? [];
    const owner = await db.passkeyCredential.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (owner && owner.userId !== profile.id) {
      return NextResponse.json(
        {
          error:
            "This authenticator is already registered to another account.",
        },
        { status: 409 },
      );
    }
    const existingPasskeyCount =
      await db.passkeyCredential.count({
        where: { userId: profile.id },
      });
    const recoveryCodes =
      existingPasskeyCount === 0
        ? Array.from({ length: 8 }, () => {
            const value = randomBytes(5)
              .toString("hex")
              .toUpperCase();
            return `CP-${value.slice(0, 4)}-${value.slice(4)}`;
          })
        : [];

    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${profile.id} FOR UPDATE`;
      const currentUser = await tx.user.findUnique({ where: { id: profile.id } });
      if (currentUser?.attendancePasskeyRequired && !ceremony.authorizedAt) {
        throw new Error("Account security changed. Authorize registration with an existing passkey.");
      }
      const consumed = await tx.webAuthnCeremony.deleteMany({
        where: {
          id: ceremony.id,
          userId: profile.id,
          type: "REGISTRATION",
          challenge: ceremony.challenge,
          expiresAt: { gt: new Date() },
        },
      });
      if (consumed.count !== 1) {
        throw new Error(
          "The registration response was already used or expired.",
        );
      }
      await tx.passkeyCredential.create({
        data: {
          id,
          userId: profile.id,
          name: parsed.data.name ?? "My passkey",
          publicKey: Buffer.from(credentialPublicKey),
          counter: BigInt(counter),
          transports,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
        },
      });
      await tx.user.update({
        where: { id: profile.id },
        data: { attendancePasskeyRequired: true },
      });
      if (recoveryCodes.length > 0) {
        await tx.passkeyRecoveryCode.deleteMany({
          where: { userId: profile.id },
        });
        await tx.passkeyRecoveryCode.createMany({
          data: recoveryCodes.map((code) => ({
            userId: profile.id,
            codeHash: recoveryCodeHash(code),
          })),
        });
      }
    });
    return NextResponse.json({
      verified: true,
      credentialId: id,
      recoveryCodes,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Passkey verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
