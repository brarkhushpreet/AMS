import { NextResponse } from "next/server";
import { attendanceSigningIdentity } from "@/lib/audit";

export async function GET() {
  return NextResponse.json(
    {
      schema: "classpulse.signing-identity.v1",
      ...attendanceSigningIdentity(),
    },
    {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
