import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const invoices = await prisma.invoice.findMany();
  const totalReceivables = invoices.reduce((sum, inv) => sum + Number(inv.faceValue), 0);
  
  return NextResponse.json({
    totalReceivables,
    atRisk: 0,
    openInvoices: invoices.length,
    shortfallAmount: 50000,
    shortfallDate: new Date().toISOString()
  });
}
