// Sign out (#25).
//
// Clears the Supabase session server-side rather than only deleting a cookie,
// so the refresh token is revoked and cannot be replayed.
//
// Answers with a 303 redirect because the caller is a plain form POST
// (AppShell.tsx) navigating the page — JSON here would leave the user looking
// at `{"ok":true}`. 303 rather than 302 so the browser follows with GET
// instead of replaying the POST.

import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    // Writes the session-cookie deletions through the request's cookie store.
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
