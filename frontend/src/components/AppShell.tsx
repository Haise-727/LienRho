"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoleSwitcher } from "./navigation/RoleSwitcher";
import { useUser } from "@/context/UserContext";
import { Radio, ShieldCheck, Sparkles, User, Layers, ArrowUpRight } from "lucide-react";
import { ElevenLabsVoiceCockpit } from "./voice/ElevenLabsVoiceCockpit";
import { ChatLauncher } from "./voice/ChatLauncher";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, user } = useUser();
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  // If login screen, render without global chrome
  if (pathname === "/login") {
    return <div className="min-h-screen bg-[#F8FAFC]">{children}</div>;
  }

  const supplierNavItems = [
    { href: "/dashboard/supplier", label: "Invoices Command Center" },
    { href: "/forecast", label: "Cash Forecast" },
    { href: "/approvals", label: "Approvals" },
  ];

  const lenderNavItems = [
    { href: "/dashboard/lender", label: "Portfolio Command Center" },
    { href: "/dashboard/lender/rules", label: "Rule Configurator" },
    { href: "/dashboard/lender/live", label: "Live Deal Stream" },
  ];

  const currentNavItems = role === "supplier" ? supplierNavItems : lenderNavItems;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900">
      {/* Global Apple Light-Mode Frosted Glass Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-xl transition-all shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 gap-4">
          {/* Brand Logo & Origin Tag */}
          <Link href={role === "supplier" ? "/dashboard/supplier" : "/dashboard/lender"} className="flex items-center gap-3 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-xs shadow-xs tracking-tighter">
              LR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900">
                  LienRho
                </span>
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                  CSI ORIGIN 2026 PS-5
                </span>
              </div>
              <span className="text-[10.5px] text-slate-500 font-medium block leading-none">
                B2B Supply-Chain Clearinghouse
              </span>
            </div>
          </Link>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-1 rounded-lg bg-slate-100/80 p-1 border border-slate-200/70">
            {currentNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard/supplier" && item.href !== "/dashboard/lender" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Stack: RoleSwitcher, Voice Trigger & User Info */}
          <div className="flex items-center gap-3">
            {/* Unified Segmented Role Switcher */}
            <RoleSwitcher />

            {/* ElevenLabs CFO Voice Trigger */}
            <button
              type="button"
              onClick={() => setIsVoiceOpen(true)}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition"
            >
              <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              <span>Ask CFO AI</span>
            </button>

            {/* User Profile Pill */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 text-xs">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200">
                {user.name.substring(0, 1)}
              </div>
              <div className="text-left leading-tight hidden xl:block">
                <span className="font-semibold text-slate-900 block text-xs truncate max-w-[130px]">{user.name}</span>
                <span className="text-[10px] text-slate-500 font-medium block truncate max-w-[130px]">{user.orgName}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">{children}</main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/80 bg-white/50 py-6 px-6 text-center text-xs text-slate-400">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>LienRho B2B Supply-Chain Financing Marketplace · CSI ORIGIN 2026</span>
          <span className="text-[11px]">Powered by Next.js 16, Tailwind CSS & Stitch Double-Entry Ledger</span>
        </div>
      </footer>

      {/* Global ElevenLabs Voice Modal */}
      <ElevenLabsVoiceCockpit
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        dealContext={`Active Account: ${user.orgName} (${role})`}
      />

      {/* Floating launcher: bottom-right bot icon */}
      <ChatLauncher open={isVoiceOpen} onToggle={() => setIsVoiceOpen((v) => !v)} />
    </div>
  );
}
