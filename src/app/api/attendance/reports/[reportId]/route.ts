import { NextResponse } from "next/server";
import { verifyAttendanceReport } from "@/lib/audit";

export async function GET(
  _request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await context.params;
  const verification = await verifyAttendanceReport(reportId);
  if (!verification) {
    return NextResponse.json(
      { error: "Attendance report not found." },
      { status: 404 },
    );
  }

  const artifact = {
    schema: "classpulse.attendance-report.v1",
    reportId,
    algorithm: verification.report.algorithm,
    payload: verification.payload,
    payloadHash: verification.report.payloadHash,
    signature: verification.report.signature,
    publicKey: verification.report.publicKey,
    publicKeyFingerprint: verification.keyFingerprint,
    verification: {
      valid: verification.valid,
      hashChainValid: verification.chainValid,
      payloadHashValid: verification.payloadValid,
      signatureValid: verification.signatureValid,
      signingKeyTrusted: verification.keyTrusted,
    },
    auditEvents: verification.report.session.auditEvents
      .slice(0, verification.report.eventCount)
      .map((event) => ({
        sequence: event.sequence,
        type: event.type,
        actorId: event.actorId,
        payload: event.payload,
        previousHash: event.previousHash,
        eventHash: event.eventHash,
        createdAt: event.createdAt.toISOString(),
      })),
  };

  return new NextResponse(JSON.stringify(artifact, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="classpulse-report-${reportId}.json"`,
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
