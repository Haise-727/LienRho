import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const dataToUpdate: any = {};
    if (body.hurdleRate !== undefined) dataToUpdate.hurdleRate = body.hurdleRate;
    if (body.riskAppetiteFloor !== undefined) dataToUpdate.riskAppetiteFloor = body.riskAppetiteFloor;
    if (body.minTicket !== undefined) dataToUpdate.minTicket = body.minTicket;
    if (body.maxTicket !== undefined) dataToUpdate.maxTicket = body.maxTicket;
    if (body.concentrationLimitPct !== undefined) dataToUpdate.concentrationLimitPct = body.concentrationLimitPct;

    const updated = await prisma.capitalProvider.update({
      where: { id },
      data: dataToUpdate
    });
    
    return NextResponse.json({ success: true, provider: updated });
  } catch (error) {
    console.error("Failed to update rules:", error);
    return NextResponse.json({ error: "Failed to update rules" }, { status: 500 });
  }
}
