// Gates every screen behind a session (#20).
//
// Next 16 renamed the `middleware` convention to `proxy`; the behaviour is the
// same. This is a redirect for unauthenticated *navigation* — it is not the
// security boundary. The backend rejects any request without a valid token, so
// a user who skips this check still gets nothing; what this avoids is a screen
// that renders and then fails to fetch.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "lienrho_session";

export function proxy(request: NextRequest) {
  const isLoggedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    const login = new URL("/login", request.url);
    // Remember where they were headed so login can return them to it.
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Page navigation only.
  //
  // `/api/*` is excluded deliberately: those handlers are called by fetch, and
  // each already returns its own 401. Redirecting them would answer a JSON
  // request with a 307 to an HTML login page, which the caller would follow
  // and then fail to parse — turning "your session expired" into a parse
  // error. The negative match on _next and favicon keeps this from gating CSS
  // and JS, which would render the login page unstyled.
  //
  // `/market` is also excluded, and that deserves an explicit note rather than
  // a quiet regex edit.
  //
  // The login handler exchanges credentials by calling FastAPI on
  // localhost:8000. That service is retired (05-decisions-needed.md §2), so
  // login cannot succeed and every page redirects to a form that can never
  // complete — the app is currently unreachable, not merely gated.
  //
  // Excluding /market adds no exposure that does not already exist: it renders
  // exactly what `/api/opportunities` and `/api/match` already serve without
  // any auth check of their own. The gate is doing nothing for that data today.
  //
  // This is a stopgap, not a decision. When real auth lands (11-hardcoded-debts
  // .md §2 proposes Supabase Auth), /market goes back behind it along with
  // everything else, and the API routes gain the check they currently lack.
  matcher: ["/((?!api|market|_next/static|_next/image|favicon.ico).*)"],
};
