import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const invoices = await prisma.invoice.findMany({
    include: { customer: true }
  });
  
  const queue = invoices.map(inv => ({
    id: `AQ-${inv.id}`,
    invoice: {
      invoiceId: inv.id,
      customerId: inv.customerId,
      customerName: inv.customer.name,
      invoiceAmount: Number(inv.faceValue),
      invoiceDate: inv.invoiceDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      paymentStatus: "PENDING",
      daysOverdue: Math.max(0, Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 3600 * 24)))
    },
    priority: "HIGH",
    recommendedAction: "FINANCE",
    reason: "Cash needed for upcoming obligations",
    approvalState: "PENDING_APPROVAL",
    prediction: { bucket_0_15: 0.1, bucket_16_30: 0.2, bucket_31_45: 0.3, bucket_over_45: 0.4 }
  }));
  
  return NextResponse.json(queue);
}
