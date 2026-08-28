import { NextResponse } from "next/server";
export async function GET(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return NextResponse.json({
    kind: "TREDS_SUBMISSION",
    title: "TReDS",
    contentMarkdown: "# Submission\nData",
    payload: { invoiceId, buyerId: "B-1", amount: 100 }
  });
}
