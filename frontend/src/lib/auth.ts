// Who is asking, and which organization do they act for? (#25)
//
// The one place that answers both questions. Everything that needs to scope a
// query by tenant should call `getCurrentUser()` rather than reading cookies
// itself — otherwise "which org is this request for" gets answered in several
// places and they eventually disagree.

import { prisma } from "@/lib/db";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: "OWNER" | "MEMBER";
  org: { id: string; slug: string; name: string; type: "SUPPLIER" | "PROVIDER" | "PLATFORM" };
}

/**
 * The signed-in user, or null.
 *
 * Two gates, and both have to pass:
 *
 *   1. Supabase verifies the identity — `getUser()`, which validates against
 *      the Auth server rather than trusting the cookie.
 *   2. That email is on the allowlist — a row in `User`. Authenticating with
 *      Google proves who you are; it does not entitle you to act for an
 *      organization on a capital marketplace.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email) return null;

  const row = await prisma.user.findUnique({
    where: { email: user.email.toLowerCase() },
    include: { org: { select: { id: true, slug: true, name: true, type: true } } },
  });
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    role: row.role,
    org: row.org,
  };
}

/**
 * For route handlers that CHANGE something: the user, or a response to return.
 *
 * Anyone signing in with Google is admitted as a read-only MEMBER of the
 * platform org (see the auth callback), so "is there a session" is no longer
 * the same question as "may this person act". Every mutating route has to ask
 * the second one, or open sign-in quietly becomes open write access.
 *
 * 403 rather than 401: they are authenticated, just not permitted — and a 401
 * would send the client off to re-authenticate, which changes nothing.
 */
export async function requireOwner(): Promise<
  { user: SessionUser; response?: never } | { user?: never; response: Response }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: Response.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if (user.role !== "OWNER") {
    return {
      response: Response.json(
        {
          error: "read_only",
          message:
            "You are signed in as a viewer. Viewers can read the marketplace and the ledger, " +
            "but only a member of the owning organisation can change anything.",
        },
        { status: 403 },
      ),
    };
  }
  return { user };
}

/** For route handlers: the user, or a 401 to return. */
export async function requireUser(): Promise<
  { user: SessionUser; response?: never } | { user?: never; response: Response }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: Response.json(
        { error: "Not authenticated" },
        { status: 401 },
      ),
    };
  }
  return { user };
}
