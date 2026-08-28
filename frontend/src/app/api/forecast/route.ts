import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    cashThreshold: 500000,
    shortfallDate: new Date().toISOString(),
    shortfallAmount: 10000,
    points: [{ date: new Date().toISOString(), projectedCash: 400000 }],
    contributingInvoices: [{ invoiceId: "INV-001", customerName: "Acme Corp", amount: 100000, contribution: 50000 }]
  });
}
