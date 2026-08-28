// Browser-side Supabase client (#25).
//
// Only ever used to *start* the OAuth redirect. Every decision about who this
// person is and which org they belong to is made on the server, in the
// callback route — a browser client can be tampered with, so it must not be
// the thing that decides access.

"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env — see .env.example.",
    );
  }
  return createBrowserClient(url, key);
}
