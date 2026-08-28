// Server-side Supabase client (#25).
//
// Supabase Auth owns the credential and the session cookies; this project owns
// the mapping from a verified identity to an Organization (the `User` table).
// Nothing here stores or sees a password.
//
// Two rules worth stating because getting either wrong is a security bug
// rather than a bug:
//
//   1. Read identity with `getUser()`, never `getSession()`. getSession()
//      returns whatever is in the cookie without verifying it, so a forged
//      cookie passes. getUser() validates against the Auth server.
//   2. Never expose the service-role key to the browser. Only the anon
//      (publishable) key is NEXT_PUBLIC_.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False when the project has not been configured yet — see .env.example. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env — see .env.example.",
    );
  }
}

/**
 * A client bound to the current request's cookies.
 *
 * `setAll` is wrapped in try/catch because Server Components cannot write
 * cookies. That is expected, not an error: the proxy refreshes the session on
 * every navigation, so a refresh dropped here has already happened there.
 */
export async function createClient() {
  assertSupabaseConfigured();
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component render — the proxy owns cookie writes.
        }
      },
    },
  });
}
