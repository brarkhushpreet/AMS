import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { recoveryCodeHash } from "@/lib/webauthn";

const schema = z.object({
  recoveryCode: z.string().trim().min(8).max(32),
});

export async function POST(request: Request) {
  const profile = await requireProfile();
  const rate = await consumeRateLimit({
    key: `passkey-recovery:${profile.id}`,
    limit: 5,
    windowSeconds: 3_600,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many recovery attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid recovery code." },
      { status: 400 },
    );
  }

  const codeHash = recoveryCodeHash(parsed.data.recoveryCode);
  const code = await db.passkeyRecoveryCode.findFirst({
    where: {
      userId: profile.id,
      codeHash,
      usedAt: null,
    },
  });
  if (!code) {
    return NextResponse.json(
      { error: "The recovery code is invalid or already used." },
      { status: 403 },
    );
  }

  const ceremony = await db.$transaction(async (tx) => {
    const consumed = await tx.passkeyRecoveryCode.updateMany({
      where: { id: code.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new Error("The recovery code has already been consumed.");
    }
    await tx.webAuthnCeremony.deleteMany({
      where: { userId: profile.id, type: "MANAGEMENT" },
    });
    return tx.webAuthnCeremony.create({
      data: {
        userId: profile.id,
        type: "MANAGEMENT",
        challenge: randomUUID(),
        authorizedAt: new Date(),
        expiresAt: new Date(Date.now() + 120_000),
      },
    });
  });

  return NextResponse.json({
    managementToken: ceremony.id,
    expiresInSeconds: 120,
  });
}
