import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";
import { consumeRateLimit } from "@/lib/rate-limit";
import { authenticationOptions } from "@/lib/webauthn";

export async function POST(request: Request) {
  const profile = await requireProfile();
  const rate = await consumeRateLimit({
    key: `passkey-management:${profile.id}`,
    limit: 6,
    windowSeconds: 300,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many passkey management attempts." },
      { status: 429 },
    );
  }

  const passkeys = await db.passkeyCredential.findMany({
    where: { userId: profile.id },
  });
  if (passkeys.length === 0) {
    return NextResponse.json(
      { error: "No existing passkey can authorize this change." },
      { status: 409 },
    );
  }
  const options = await authenticationOptions(request, passkeys);
  const ceremony = await db.$transaction(async (tx) => {
    await tx.webAuthnCeremony.deleteMany({
      where: { userId: profile.id, type: "MANAGEMENT" },
    });
    return tx.webAuthnCeremony.create({
      data: {
        userId: profile.id,
        type: "MANAGEMENT",
        challenge: options.challenge,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
  });
  return NextResponse.json({
    ceremonyId: ceremony.id,
    authenticationOptions: options,
  });
}
