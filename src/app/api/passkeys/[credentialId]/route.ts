import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/current-profile";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ credentialId: string }> },
) {
  const profile = await requireProfile();
  const { credentialId } = await context.params;
  const managementToken = request.headers.get(
    "x-passkey-management-token",
  );
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
          "Confirm an existing passkey before changing trusted devices.",
        requiresManagementAuthorization: true,
      },
      { status: 403 },
    );
  }
  const passkeyCount = await db.passkeyCredential.count({
    where: { userId: profile.id },
  });
  if (
    profile.attendancePasskeyRequired &&
    passkeyCount <= 1
  ) {
    return NextResponse.json(
      {
        error:
          "Register a replacement before removing your final attendance passkey.",
      },
      { status: 409 },
    );
  }
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${profile.id} FOR UPDATE`;
    if (await tx.passkeyCredential.count({ where: { userId: profile.id } }) <= 1) {
      throw new Error("Register a replacement before removing your final passkey.");
    }
    const deleted = await tx.passkeyCredential.deleteMany({
      where: { id: credentialId, userId: profile.id },
    });
    await tx.webAuthnCeremony.delete({
      where: { id: authorization.id },
    });
    return deleted;
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Passkey not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
