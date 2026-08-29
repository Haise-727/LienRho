// OAuth callback (#25).
//
// Google has verified who this person is. This route decides whether they may
// act for an organization here — a separate question, and the one that
// matters on a capital marketplace. You do not get to self-declare as a bank
// because you own a Gmail account.
//
// The allowlist lives in the `User` table. No row, no access, and the person
// is signed straight back out so a half-authenticated session cannot linger.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  // Supabase reports provider-side failures (user cancelled, consent denied)
  // as query params rather than an absent code.
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", url.origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) {
    return NextResponse.redirect(new URL("/login?error=exchange_failed", url.origin));
  }

  const email = data.user.email.toLowerCase();
  const allowed = await prisma.user.findUnique({ where: { email } });

  // Not on the allowlist? Admit them as a read-only viewer rather than
  // turning them away.
  //
  // The tension this resolves: Google answers "who are you", but the
  // marketplace also needs "what may you trade as" — and nobody should be able
  // to self-declare as a bank. Attaching a stranger to an existing provider
  // would hand them that provider's private mandate and its rivals' bids.
  //
  // So they join the platform organisation with the MEMBER role, which the
  // schema already defines as read-only. They can see the market clear, read
  // the ledger and follow the reasoning; they cannot act for anyone. Every
  // route that mutates state checks for OWNER (see requireOwner in lib/auth).
  let account = allowed;
  if (!account) {
    const platform = await prisma.organization.findFirst({
      where: { type: "PLATFORM" },
      select: { id: true },
    });
    if (!platform) {
      // No platform org means an unseeded database. Refuse rather than guess
      // at which organisation a stranger belongs to.
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=not_authorized", url.origin));
    }
    account = await prisma.user.create({
      data: {
        email,
        displayName: (data.user.user_metadata?.full_name as string | undefined) ?? null,
        avatarUrl: (data.user.user_metadata?.avatar_url as string | undefined) ?? null,
        orgId: platform.id,
        role: "MEMBER",
      },
    });
  }

  // Bind the Supabase identity to the allowlist row on first sign-in. Later
  // sessions match on this UUID rather than the email, so a Google account
  // that changes its primary address keeps working.
  await prisma.user.update({
    where: { id: account.id },
    data: {
      supabaseUserId: data.user.id,
      lastSeenAt: new Date(),
      displayName:
        account.displayName ??
        (data.user.user_metadata?.full_name as string | undefined) ??
        null,
      avatarUrl:
        account.avatarUrl ??
        (data.user.user_metadata?.avatar_url as string | undefined) ??
        null,
    },
  });

  // Only same-origin relative paths, so `?next=` cannot be used as an open
  // redirect to somewhere else.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(new URL(target, url.origin));
}
