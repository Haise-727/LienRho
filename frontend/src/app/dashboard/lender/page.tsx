"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { MetricsRow } from "@/components/lender/MetricsRow";
import { SectorExposureGauges } from "@/components/lender/SectorExposureGauges";
import { fetchProviders, CapitalProviderDetail, FALLBACK_PROVIDER_DETAIL } from "@/lib/api-client";
import { Landmark, Sliders, Radio, ArrowRight, Activity, ShieldCheck, PieChart } from "lucide-react";

export default function LenderCommandCenterPage() {
  const [provider, setProvider] = useState<CapitalProviderDetail>(FALLBACK_PROVIDER_DETAIL);

  useEffect(() => {
    async function load() {
      const res = await fetchProviders();
      if (res.providers && res.providers.length > 0) {
        setProvider(res.providers[0]);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header with Title and Action CTA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-800 uppercase tracking-wider mb-1.5">
            <Landmark className="h-3.5 w-3.5 text-blue-600" />
            Capital Provider Command Center · Portfolio View
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {provider.name || "Kaveri Capital (NBFC)"}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Monitor institutional liquidity deployment, sector exposure concentration, and manage autonomous underwriting agents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/lender/live"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-2xs transition"
          >
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            <span>Live Deal Stream</span>
          </Link>

          {/* Primary Step 2 CTA: Configure Rules */}
          <Link
            href="/dashboard/lender/rules"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 text-xs font-bold shadow-xs transition"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Configure Rules</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <MetricsRow
        totalLiquidity={provider.totalLiquidity || "120000000.00"}
        availableLiquidity={provider.availableLiquidity || "107500000.00"}
        deployedCapital="12500000.00"
        hurdleRate={`${(Number(provider.hurdleRate || 0.13) * 100).toFixed(1)}%`}
      />

      {/* Sector Exposure Gauges */}
      <SectorExposureGauges />
    </div>
  );
}
