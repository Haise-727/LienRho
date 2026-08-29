"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { RiskParameterForm } from "@/components/lender/RiskParameterForm";
import { LiquidityPoolManager } from "@/components/lender/LiquidityPoolManager";
import { ArrowLeft, Sliders, Activity } from "lucide-react";
import { fetchProviders, CapitalProviderDetail } from "@/lib/api-client";

export default function LenderRuleConfiguratorPage() {
  const [provider, setProvider] = useState<CapitalProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetchProviders();
      setProvider(res.providers?.[0] ?? null);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading rules…</p>;
  }

  if (!provider) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-semibold text-slate-900">No capital provider found</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-2">
      <div>
        <Link
          href="/dashboard/lender"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Portfolio Command Center
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-800 uppercase tracking-wider mb-1.5">
            <Sliders className="h-3.5 w-3.5 text-blue-600" />
            Autonomous Rule Configurator · Step 2
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Underwriting & Risk Parameters
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Configure yield hurdles, advance ceilings, and obligor risk floors. Your LiteLLM underwriting agent operates strictly within these quantitative boundaries.
          </p>
        </div>

        <Link
          href="/dashboard/lender/live"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 shadow-2xs transition self-start sm:self-center"
        >
          <Activity className="h-3.5 w-3.5 text-emerald-600" />
          <span>Watch Live Agent</span>
        </Link>
      </div>

      <RiskParameterForm provider={provider} />
      <LiquidityPoolManager provider={provider} />
    </div>
  );
}
