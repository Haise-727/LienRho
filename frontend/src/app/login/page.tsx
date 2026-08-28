"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ShieldCheck, Lock, Building2, Store, Landmark, Zap } from "lucide-react";
import { motion } from "framer-motion";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("ops@vertexcomponents.example");
  const [password, setPassword] = useState("password123");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(overrideEmail?: string) {
    setSubmitting(true);
    const targetEmail = overrideEmail || email;

    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password }),
      });

      router.replace(searchParams.get("next") ?? "/");
      router.refresh();
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md rounded-3xl border border-black/5 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
    >
      {/* Brand Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white shadow-sm font-black text-lg mb-3">
          LR
        </div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">
          LienRho Marketplace
        </h1>
        <p className="mt-1 text-xs text-neutral-500 font-medium">
          CSI ORIGIN 2026 • Supply-Chain Working Capital Platform
        </p>
      </div>

      {/* Quick 1-Click Demo Personas */}
      <div className="mb-6 space-y-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block text-center">
          1-Click Seeded Personas
        </span>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleLogin("ops@vertexcomponents.example")}
            disabled={submitting}
            className="flex flex-col items-start rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-3 text-left hover:border-black hover:bg-white transition-all shadow-sm group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Store className="h-4 w-4 text-neutral-800 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold text-neutral-900 leading-tight">Supplier</span>
            </div>
            <span className="text-[10px] text-neutral-500 font-medium">Vertex Components</span>
            <span className="text-[9px] text-emerald-600 font-semibold mt-0.5">₹10L Invoice Live</span>
          </button>

          <button
            type="button"
            onClick={() => handleLogin("desk@rapidfin.example")}
            disabled={submitting}
            className="flex flex-col items-start rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-3 text-left hover:border-black hover:bg-white transition-all shadow-sm group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-amber-600 fill-amber-600 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold text-neutral-900 leading-tight">FinTech</span>
            </div>
            <span className="text-[10px] text-neutral-500 font-medium">Rapidfin (T+0)</span>
            <span className="text-[9px] text-neutral-400 font-semibold mt-0.5">Instant Disbursal</span>
          </button>

          <button
            type="button"
            onClick={() => handleLogin("desk@kavericapital.example")}
            disabled={submitting}
            className="flex flex-col items-start rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-3 text-left hover:border-black hover:bg-white transition-all shadow-sm group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-neutral-800 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold text-neutral-900 leading-tight">NBFC Fund</span>
            </div>
            <span className="text-[10px] text-neutral-500 font-medium">Kaveri Capital</span>
            <span className="text-[9px] text-neutral-400 font-semibold mt-0.5">₹12 Cr Liquidity</span>
          </button>

          <button
            type="button"
            onClick={() => handleLogin("desk@meridianbank.example")}
            disabled={submitting}
            className="flex flex-col items-start rounded-2xl border border-neutral-200/80 bg-neutral-50/60 p-3 text-left hover:border-black hover:bg-white transition-all shadow-sm group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="h-4 w-4 text-neutral-800 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold text-neutral-900 leading-tight">Bank</span>
            </div>
            <span className="text-[10px] text-neutral-500 font-medium">Meridian Bank</span>
            <span className="text-[9px] text-neutral-400 font-semibold mt-0.5">11.0% Low APR</span>
          </button>
        </div>
      </div>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200/60" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-[10px] text-neutral-400 font-medium">Or enter credentials</span>
        </div>
      </div>

      {/* Manual Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1" htmlFor="email">
            Business Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3.5 py-2.5 text-xs text-neutral-900 outline-none focus:border-black focus:bg-white transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3.5 py-2.5 text-xs text-neutral-900 outline-none focus:border-black focus:bg-white transition"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 rounded-full bg-black py-3 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 transition disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Lock className="h-3.5 w-3.5 animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              Sign In to Marketplace
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 font-medium">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        Stitch KYB & Tenancy-Isolated Accounts
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-6 py-12">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
