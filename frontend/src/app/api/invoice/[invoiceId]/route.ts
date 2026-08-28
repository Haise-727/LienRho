import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateObject } from "ai";
import { siliconFlow } from "@/lib/ai/siliconflow";
import { z } from "zod";

export async function GET(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true }
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const daysOverdue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 3600 * 24)));
  
  const prompt = `Analyze this invoice and generate an investigation report.
Customer: ${invoice.customer.name}
Amount: ${Number(invoice.faceValue)}
Days Overdue: ${daysOverdue}
Historical Avg Delay: ${invoice.customer.averageDelayDays || 0} days

Provide:
1. Two to three prediction factors explaining the risk.
2. The recommended action (must be exactly 'FOLLOW_UP', 'FINANCE', or 'ESCALATE').
3. A short reason for the recommendation.`;

  try {
    const { object } = await generateObject({
      model: siliconFlow("deepseek-ai/DeepSeek-V3"),
      schema: z.object({
        factors: z.array(z.object({
          label: z.string(),
          detail: z.string(),
          direction: z.enum(["increases_risk", "decreases_risk"])
        })),
        recommendedAction: z.enum(["FOLLOW_UP", "FINANCE", "ESCALATE"]),
        reason: z.string()
      }),
      prompt,
    });

    return NextResponse.json({
      invoice: { 
        invoiceId: invoice.id, 
        customerId: invoice.customerId, 
        customerName: invoice.customer.name, 
        invoiceAmount: Number(invoice.faceValue), 
        invoiceDate: invoice.invoiceDate.toISOString(), 
        dueDate: invoice.dueDate.toISOString(), 
        paymentStatus: "PENDING", 
        daysOverdue 
      },
      prediction: { bucket_0_15: 0.1, bucket_16_30: 0.2, bucket_31_45: 0.3, bucket_over_45: 0.4 },
      factors: object.factors,
      rules: { statutoryFlag: false, statutoryInterest: null, tredsEligible: true, tredsIneligibleReason: null },
      findings: { paymentPromise: false, promisedDate: null, disputeDetected: false, confidence: 0.8, evidence: ["Analyzed by AI"] },
      recommendedAction: object.recommendedAction,
      reason: object.reason,
      approvalState: "PENDING_APPROVAL",
      auditTrail: [{ timestamp: new Date().toISOString(), decidedBy: "AGENT", what: "AI Analysis", why: "Automated investigation" }]
    });
  } catch (error) {
    console.error("AI Investigation failed:", error);
    return NextResponse.json({ error: "Failed to generate investigation" }, { status: 500 });
  }
}
