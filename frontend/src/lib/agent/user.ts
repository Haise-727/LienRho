// Resolve the current user id for CFO cockpit thread scoping (multi-tenancy).
//
// This repo has a `User` table + Supabase Auth configured, but no request-time
// auth wiring in the frontend yet. Until that is plumbed, we resolve a stable
// per-browser id from the `x-user-id` header (the client persists a UUID in
// localStorage and sends it), falling back to the `cfo-user-id` cookie, then to
// an "anonymous" shared bucket. Swap the first branch for Supabase
// `getUser()` once an auth middleware exists — the rest of the agent code only
// depends on this one function returning a stable string per user.

export const ANONYMOUS_USER = "anonymous";

export function resolveUserId(request: Request): string {
  const header = request.headers.get("x-user-id");
  if (header && header.trim()) return header.trim();

  const cookie = request.headers.get("cookie");
  if (cookie) {
    const match = cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("cfo-user-id="));
    if (match) {
      const value = decodeURIComponent(match.slice("cfo-user-id=".length));
      if (value) return value;
    }
  }

  return ANONYMOUS_USER;
}
