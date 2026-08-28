import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    kind: "REMINDER",
    title: `Reminder — ${invoiceId}`,
    contentMarkdown: "Dear Customer,\n\nThis is a reminder for your invoice.",
    editable: true
  });
}
