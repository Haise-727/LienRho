import { NextResponse } from "next/server";
export async function GET(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return NextResponse.json({
    invoice: { invoiceId, customerId: "C-1", customerName: "Acme", invoiceAmount: 100000, invoiceDate: new Date().toISOString(), dueDate: new Date().toISOString(), paymentStatus: "PENDING", daysOverdue: 0 },
    prediction: { bucket_0_15: 0.1, bucket_16_30: 0.2, bucket_31_45: 0.3, bucket_over_45: 0.4 },
    factors: [{ label: "Past Due", detail: "Customer pays late", direction: "increases_risk" }],
    rules: { statutoryFlag: false, statutoryInterest: null, tredsEligible: true, tredsIneligibleReason: null },
    findings: { paymentPromise: false, promisedDate: null, disputeDetected: false, confidence: 0.8, evidence: ["No issue"] },
    recommendedAction: "FINANCE",
    reason: "Cash needed",
    approvalState: "PENDING_APPROVAL",
    auditTrail: [{ timestamp: new Date().toISOString(), decidedBy: "ML", what: "Prediction", why: "Late payment history" }]
  });
}
