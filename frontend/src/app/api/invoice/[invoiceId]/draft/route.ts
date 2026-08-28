import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { prisma } from "@/lib/db";
import { generateText } from "ai";
import { siliconFlow } from "@/lib/ai/siliconflow";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true }
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const dueDate = invoice.dueDate.toISOString().split('T')[0];
  const amount = Number(invoice.faceValue);
  
  const prompt = `You are a professional financial assistant drafting a polite but firm payment reminder for an overdue invoice.
  
Invoice Details:
- Invoice ID: ${invoice.id}
- Customer Name: ${invoice.customer.name}
- Amount Due: $${amount}
- Due Date: ${dueDate}

Write a short, professional email reminder asking for payment. Use markdown formatting.`;

  try {
    const { text } = await generateText({
      model: siliconFlow("deepseek-ai/DeepSeek-V3"),
      prompt,
    });

    return NextResponse.json({
      kind: "REMINDER",
      title: `Reminder — ${invoiceId}`,
      contentMarkdown: text,
      editable: true
    });
  } catch (error) {
    console.error("AI Generation failed:", error);
    return NextResponse.json({ error: "Failed to generate draft" }, { status: 500 });
  }
}
