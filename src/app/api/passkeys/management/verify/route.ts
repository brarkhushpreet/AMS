import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import { verifyUserPasskey } from "@/lib/webauthn";

const schema = z.object({
  ceremonyId: z.uuid(),
  response: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const profile = await requireProfile();
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "The management assertion is incomplete." },
      { status: 400 },
    );
  }
  const ceremony = await db.webAuthnCeremony.findFirst({
    where: {
      id: parsed.data.ceremonyId,
      userId: profile.id,
      type: "MANAGEMENT",
      authorizedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!ceremony) {
    return NextResponse.json(
      { error: "The authorization request expired." },
      { status: 410 },
    );
  }

  try {
    const { passkey, verification } = await verifyUserPasskey({
      request,
      userId: profile.id,
      expectedChallenge: ceremony.challenge,
      response: parsed.data
        .response as unknown as AuthenticationResponseJSON,
    });
    await db.$transaction(async (tx) => {
      const authorized = await tx.webAuthnCeremony.updateMany({
        where: {
          id: ceremony.id,
          userId: profile.id,
          type: "MANAGEMENT",
          authorizedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          authorizedAt: new Date(),
          expiresAt: new Date(Date.now() + 120_000),
        },
      });
      if (authorized.count !== 1) {
        throw new Error(
          "The passkey authorization was already used or expired.",
        );
      }
      await tx.passkeyCredential.update({
        where: { id: passkey.id },
        data: {
          counter: BigInt(
            verification.authenticationInfo.newCounter,
          ),
          backedUp:
            verification.authenticationInfo.credentialBackedUp,
          deviceType:
            verification.authenticationInfo.credentialDeviceType,
          lastUsedAt: new Date(),
        },
      });
    });
    return NextResponse.json({
      managementToken: ceremony.id,
      expiresInSeconds: 120,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Passkey authorization failed.",
      },
      { status: 400 },
    );
  }
}
