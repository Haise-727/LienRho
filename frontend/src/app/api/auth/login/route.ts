import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || "supplier@vertex.corp").toLowerCase();
  
  let orgType = "SUPPLIER";
  let orgSlug = "vertex-components";
  let displayName = "Vertex Components Pvt Ltd";

  if (email.includes("meridian") || email.includes("bank")) {
    orgType = "PROVIDER";
    orgSlug = "meridian-bank";
    displayName = "Meridian Bank";
  } else if (email.includes("rapidfin") || email.includes("fintech")) {
    orgType = "PROVIDER";
    orgSlug = "rapidfin";
    displayName = "Rapidfin";
  } else if (email.includes("kaveri") || email.includes("nbfc") || email.includes("lender")) {
    orgType = "PROVIDER";
    orgSlug = "kaveri-capital";
    displayName = "Kaveri Capital (NBFC)";
  }

  const mockToken = "lienrho_jwt_" + Buffer.from(`${email}:${orgType}:${orgSlug}`).toString("base64");
  
  const response = NextResponse.json({
    ok: true,
    orgType,
    orgSlug,
    email,
    displayName
  });

  response.cookies.set(SESSION_COOKIE, mockToken, sessionCookieOptions);
  return response;
}
