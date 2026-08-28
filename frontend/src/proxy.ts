// Route protection and session refresh (#25).
//
// Next 16 deprecated the `middleware` convention and renamed it to `proxy`;
// behaviour is identical. Issue #25 names `src/middleware.ts` — writing that
// file here would create a deprecated convention, so this is the same logic in
// the supported place.
//
// Two jobs:
//
//   1. Refresh the Supabase session on every navigation. Server Components
//      cannot write cookies, so if this does not run, tokens expire mid-session
//      and the user is bounced to /login while still legitimately signed in.
//   2. Redirect unauthenticated navigation to /login?error=unauthorized.
//
// This is not the security boundary — a redirect only stops a screen
// rendering. Route handlers must still check for themselves; `requireUser()`
// in src/lib/auth.ts is how.
//
// `/market` is back behind the gate. It was excluded on dev (4a4151d) because
// login called a retired FastAPI service and could never complete, leaving the
// app unreachable rather than gated. That commit said the exclusion was a
// stopgap and that /market returns behind the gate once real auth lands. It
// has, so it does.

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Unconfigured: let navigation through rather than locking everyone out of
  // a dev machine that has no Supabase project yet. The route handlers still
  // refuse, so this opens a screen, never data.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser(), not getSession(): the latter trusts the cookie without
  // verifying it, so a forged cookie would walk straight past this.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "unauthorized");
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  // Page navigation only.
  //
  // `/api/*` is excluded deliberately: those handlers are called by fetch and
  // return their own 401. Redirecting them would answer a JSON request with a
  // 307 to an HTML page, turning "your session expired" into a parse error.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
