/**
 * POST /api/auth/login — select an allowlisted identity.
 *
 * ⚠️ THIS IS NOT AUTHENTICATION YET. It verifies that an email is on the
 * allowlist and issues a session for that organisation. It does not verify that
 * the caller *is* that person, because there is nothing to verify against:
 * `model User` deliberately stores no password. The schema is built for
 * Supabase + Google OAuth (11-hardcoded-debts.md §2), where the identity
 * provider is the only thing that ever sees a credential.
 *
 * What this replaces is worse, not better: the previous handler POSTed
 * credentials to FastAPI on localhost:8000, a service retired in
 * 05-decisions-needed.md §2. It could never succeed, so every page redirected
 * to a login that could not complete and the entire app was unreachable.
 *
 * The allowlist property still holds and is worth keeping: you cannot sign in
 * as an organisation that was not seeded. Nobody self-declares as a bank on a
 * capital marketplace. What is missing is proof of identity, and that arrives
 * with OAuth.
 */

import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let email: string | undefined;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Malformed request' }, { status: 400 });
  }

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { org: { select: { id: true, name: true, type: true, slug: true } } },
  });

  if (!user) {
    // Same message whether the address is unknown or simply not allowlisted.
    // Distinguishing them would let anyone enumerate which organisations exist
    // on the platform, and that is a list worth not publishing.
    return NextResponse.json({ error: 'That address is not on the allowlist' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });

  const response = NextResponse.json({
    orgId: user.orgId,
    orgName: user.org.name,
    orgType: user.org.type,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  });

  // The cookie carries the org id, not a token — there is no token to carry
  // until OAuth lands. httpOnly regardless, so client script cannot read or
  // forge it from the browser.
  response.cookies.set(SESSION_COOKIE, user.orgId, sessionCookieOptions);
  return response;
}
