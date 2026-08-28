import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";

const ALLOWED = new Set(["approve", "reject"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string; decision: string }> },
) {
  const { invoiceId, decision } = await params;

  if (!ALLOWED.has(decision)) {
    return NextResponse.json({ error: "Unknown decision" }, { status: 404 });
  }

  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    invoiceId,
    approvalState: decision === "approve" ? "APPROVED" : "REJECTED",
    recommendedAction: "FINANCE",
    artifact: decision === "approve" ? {
      kind: "TREDS_SUBMISSION",
      title: "TReDS Submission",
      contentMarkdown: "# Submitted",
      payload: { invoiceId }
    } : null,
    auditTrail: [{
      timestamp: new Date().toISOString(),
      decidedBy: "HUMAN",
      what: decision === "approve" ? "Approved" : "Rejected",
      why: "User decision"
    }]
  });
}
