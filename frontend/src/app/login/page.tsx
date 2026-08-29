"use client";

// Sign-in (#25).
//
// One button. The persona switcher that used to live here faked a session by
// string-matching an email and setting a base64 cookie — no verification of
// any kind. It is gone; so is /api/auth/login.
//
// Keeps Track 4's Apple-style card so the visual language is unchanged.

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

/** Messages are deliberately vague about *why* — see below. */
const ERRORS: Record<string, string> = {
  unauthorized: "Please sign in to continue.",
  // Only reachable now when the database has no platform organisation to
  // attach a viewer to, i.e. an unseeded deployment.
  not_authorized:
    "This deployment isn't set up yet. Ask an administrator to seed it.",
  oauth_failed: "Google sign-in was cancelled or failed. Please try again.",
  missing_code: "Sign-in didn't complete. Please try again.",
  exchange_failed: "Sign-in didn't complete. Please try again.",
  config: "Sign-in isn't configured on this deployment yet.",
};

function GoogleMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
      />
    </svg>
  );
}

function LoginCard() {
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const paramError = searchParams.get("error");
  const message = failure ?? (paramError ? (ERRORS[paramError] ?? ERRORS.oauth_failed) : null);

  async function signIn() {
    setSubmitting(true);
    setFailure(null);
    try {
      const supabase = createClient();
      const next = searchParams.get("next") ?? "/";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        setFailure(ERRORS.oauth_failed);
        setSubmitting(false);
      }
      // On success the browser is navigating to Google — leave the button
      // disabled rather than resetting it, so a second click cannot fire
      // mid-redirect.
    } catch {
      setFailure(ERRORS.config);
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md rounded-3xl border border-black/5 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
    >
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-lg font-black text-white shadow-sm">
          L
        </div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">LienRho</h1>
        <p className="mt-1 text-xs font-medium text-neutral-500">
          Agentic capital marketplace for supply-chain working capital
        </p>
      </div>

      {message && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900"
        >
          {message}
        </div>
      )}

      <button
        type="button"
        onClick={signIn}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleMark />
        {submitting ? "Redirecting…" : "Continue with Google"}
      </button>

      <div className="mt-6 flex items-start gap-2 text-[11px] leading-relaxed text-neutral-500">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          Anyone may sign in to look around. Signing in with Google proves who you
          are; only an administrator can decide which organisation you may act
          for — so new accounts start read-only.
        </span>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </main>
  );
}
