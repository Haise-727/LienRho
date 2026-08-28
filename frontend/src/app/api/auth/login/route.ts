import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = body.email || "supplier@acme.corp";
  
  // Mock login fallback: works immediately without needing a database connection
  const mockToken = "mock_jwt_token_" + Buffer.from(email).toString("base64");
  
  const response = NextResponse.json({
    ok: true,
    orgId: "org-demo-001",
    email: email,
    displayName: email.includes("alpha") 
      ? "Alpha Bank Capital" 
      : email.includes("metro") 
      ? "Metro Retail Enterprise" 
      : "Acme Industrial Supplier",
    role: email.includes("alpha") 
      ? "provider" 
      : email.includes("metro") 
      ? "buyer" 
      : "supplier"
  });

  response.cookies.set(SESSION_COOKIE, mockToken, sessionCookieOptions);
  return response;
}
