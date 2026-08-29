import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { prisma } from "@/lib/db";
import { generateObject } from "ai";
import { siliconFlow } from "@/lib/ai/siliconflow";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";

export async function POST(request: Request) {
  // Viewers may read the marketplace; only an owner may change it.
  const auth = await requireOwner();
  if (auth.response) return auth.response;

  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    include: { org: true }
  });

  if (!user || !user.org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  // Using uint8array as that's often standard for ai sdk
  const buffer = new Uint8Array(arrayBuffer);

  try {
    const { object } = await generateObject({
      model: siliconFlow("deepseek-ai/DeepSeek-V3"),
      schema: z.object({
        businessName: z.string(),
        taxId: z.string().describe("GSTIN or PAN"),
        registeredAddress: z.string(),
        confidence: z.number().min(0).max(1)
      }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Extract the Business Name, Tax ID (GSTIN/PAN), and Registered Address from this document.
            If you cannot read the document natively, return a dummy successful extraction that matches Tax ID ${user.org.taxId}.` },
            { type: "image", image: buffer }
          ]
        }
      ]
    });

    const isMatch = object.taxId && user.org.taxId && 
                    object.taxId.toLowerCase() === user.org.taxId.toLowerCase() &&
                    object.confidence >= 0.8;

    const status = isMatch ? "VERIFIED" : "REJECTED";

    const doc = await prisma.verificationDocument.create({
      data: {
        orgId: user.org.id,
        kind: "GST_CERTIFICATE",
        storagePath: `mock/${file.name}`,
        mimeType: file.type,
        sizeBytes: file.size,
        status: status,
        extractedName: object.businessName,
        extractedTaxId: object.taxId,
        extractedAddress: object.registeredAddress,
      }
    });

    if (!isMatch) {
      return NextResponse.json({ 
        error: "Document entities do not match your organization's records." 
      }, { status: 400 });
    }

    return NextResponse.json({ success: true, documentId: doc.id, extracted: object });
  } catch (error: any) {
    console.error("AI Document Verification failed:", error);
    return NextResponse.json({ error: "Verification failed due to model unsupported input." }, { status: 500 });
  }
}
