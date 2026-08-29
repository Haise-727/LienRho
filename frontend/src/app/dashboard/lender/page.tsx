"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { MetricsRow } from "@/components/lender/MetricsRow";
import { SectorExposureGauges } from "@/components/lender/SectorExposureGauges";
import { fetchProviders, CapitalProviderDetail } from "@/lib/api-client";
import { Landmark, Sliders, ArrowRight, Activity } from "lucide-react";

export default function LenderCommandCenterPage() {
  const [provider, setProvider] = useState<CapitalProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchProviders();
        setProvider(res.providers?.[0] ?? null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse max-w-6xl mx-auto">
        <div className="h-24 bg-slate-100 border border-slate-200"></div>
        <div className="h-32 bg-slate-100 border border-slate-200"></div>
        <div className="h-64 bg-slate-100 border border-slate-200"></div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="py-24 text-center border border-slate-200 bg-slate-50 max-w-4xl mx-auto">
        <p className="text-sm font-semibold text-slate-900 uppercase tracking-widest">No capital provider found</p>
        <p className="mt-2 text-xs text-slate-500">
          The provider registry is empty or unreachable.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      {/* Header with Title and Action CTA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4">
            <Landmark className="h-3.5 w-3.5" />
            Portfolio Command Center
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {provider.name}
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl leading-relaxed">
            Monitor institutional liquidity deployment, sector exposure concentration, and manage autonomous underwriting agents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/lender/live"
            className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 px-5 py-2.5 text-xs font-semibold text-slate-900 transition-colors"
          >
            <Activity className="h-3.5 w-3.5 text-[#0047FF]" />
            <span>Live Deal Stream</span>
          </Link>

          <Link
            href="/dashboard/lender/rules"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 text-xs font-semibold transition-colors"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Configure Rules</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <MetricsRow
        totalLiquidity={provider.totalLiquidity || "120000000.00"}
        availableLiquidity={provider.availableLiquidity || "107500000.00"}
        deployedCapital="12500000.00"
        hurdleRate={`${(Number(provider.hurdleRate || 0.13) * 100).toFixed(1)}%`}
      />

      <SectorExposureGauges />
    </div>
  );
}
