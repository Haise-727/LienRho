"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  PhoneCall, 
  Radio,
  Store,
  Landmark,
  Building2,
  FileText
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { UrgencySlider } from "@/components/auction/UrgencySlider";
import { BidTicker } from "@/components/auction/BidTicker";
import { DittoDealCard } from "@/components/cards/DittoDealCard";
import { StitchLedgerTimeline } from "@/components/ledger/StitchLedgerTimeline";
import { ElevenLabsVoiceCockpit } from "@/components/voice/ElevenLabsVoiceCockpit";
import { VoiceVerificationModal } from "@/components/verification/VoiceVerificationModal";
import { PortfolioGauge } from "@/components/provider/PortfolioGauge";
import { AgentActivityLog } from "@/components/audit/AgentActivityLog";
import { DbStatusBanner } from "@/components/ui/DbStatusBanner";
import { 
  Opportunity, 
  CapitalProviderDetail, 
  computeDealMetrics, 
  ComputedDeal, 
  formatINR,
  FALLBACK_OPPORTUNITY,
  FALLBACK_PROVIDER_DETAIL 
} from "@/lib/scoring";
import { 
  fetchOpportunities, 
  fetchProviders, 
  checkDbHealth, 
  DbHealthResult 
} from "@/lib/api-client";

export default function MarketplaceDashboard() {
  const [activeRole, setActiveRole] = useState<"supplier" | "provider">("supplier");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([FALLBACK_OPPORTUNITY]);
  const [selectedOppId, setSelectedOppId] = useState<string>(FALLBACK_OPPORTUNITY.id);
  const [providers, setProviders] = useState<CapitalProviderDetail[]>([FALLBACK_PROVIDER_DETAIL]);
  const [dbHealth, setDbHealth] = useState<DbHealthResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Derived or user-overridden slider weight
  const [urgencyWeight, setUrgencyWeight] = useState<number>(0.45);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isDisbursed, setIsDisbursed] = useState(false);
  const [audioFeedback, setAudioFeedback] = useState<string | null>(null);

  // Fetch live market data on mount
  useEffect(() => {
    async function initMarketplace() {
      setLoading(true);
      const [health, oppsRes, provsRes] = await Promise.all([
        checkDbHealth(),
        fetchOpportunities(),
        fetchProviders()
      ]);

      setDbHealth(health);
      if (oppsRes.opportunities.length > 0) {
        setOpportunities(oppsRes.opportunities);
        setSelectedOppId(oppsRes.opportunities[0].id);
        const derived = oppsRes.opportunities[0].urgencyWeight;
        if (derived !== undefined && derived !== null) {
          setUrgencyWeight(Number(derived));
        }
      }
      if (provsRes.providers.length > 0) {
        setProviders(provsRes.providers);
      }
      setLoading(false);
    }

    initMarketplace();
  }, []);

  // Active Opportunity
  const currentOpp = useMemo(() => {
    return opportunities.find(o => o.id === selectedOppId) || opportunities[0] || FALLBACK_OPPORTUNITY;
  }, [opportunities, selectedOppId]);

  // Compute Pareto Utility Rank dynamically whenever slider or opportunity changes
  const computedDeals = useMemo(() => {
    const faceVal = typeof currentOpp.invoice?.faceValue === "string" 
      ? parseFloat(currentOpp.invoice.faceValue) 
      : Number(currentOpp.invoice?.faceValue || 1000000);

    const floor = currentOpp.sufficiencyFloor 
      ? Number(currentOpp.sufficiencyFloor) 
      : undefined;

    return (currentOpp.bids || []).map(b => 
      computeDealMetrics(b, faceVal, urgencyWeight, floor, 2)
    ).sort((a, b) => b.score - a.score);
  }, [currentOpp, urgencyWeight]);

  const handleAcceptDeal = (deal: ComputedDeal) => {
    setIsDisbursed(true);
    setAudioFeedback(`Disbursal confirmed! ${formatINR(deal.netCashToday)} locked with Redis and posted to Stitch ledger.`);
    setTimeout(() => setAudioFeedback(null), 5000);
  };

  const handlePlayDealAudio = (deal: ComputedDeal) => {
    const providerName = deal.bid.provider?.name || "Provider";
    setAudioFeedback(`ElevenLabs Voice Breakdown for ${providerName}: Net advance of ${formatINR(deal.netCashToday)} upfront at ${(Number(deal.bid.annualRate) * 100).toFixed(1)}% APR with total fee of ${formatINR(deal.totalCost)}.`);
    setTimeout(() => setAudioFeedback(null), 6000);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] antialiased selection:bg-black selection:text-white">
      {/* DB Status Offline/Demo Banner */}
      <DbStatusBanner health={dbHealth} />

      {/* 1. Global Navigation & Apple-Style Frosted Header */}
      <header className="sticky top-0 z-30 w-full border-b border-black/5 bg-white/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          {/* Brand Logo & Engine Badge */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-black text-white shadow-sm font-black text-sm">
              LR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-neutral-900 text-sm">LienRho</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                  CSI ORIGIN 2026
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Multi-Attribute Clearinghouse (INR ₹)
              </div>
            </div>
          </div>

          {/* Unified 2-Way Role Switcher (Supplier | Capital Provider) */}
          <div className="flex items-center rounded-full bg-neutral-100 p-1 border border-neutral-200/60 shadow-inner">
            <button
              onClick={() => setActiveRole("supplier")}
              className={`flex items-center gap-1.5 relative rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                activeRole === "supplier"
                  ? "bg-white text-black shadow-sm"
                  : "text-neutral-500 hover:text-black"
              }`}
            >
              <Store className="h-3.5 w-3.5" />
              Supplier Cockpit
            </button>
            <button
              onClick={() => setActiveRole("provider")}
              className={`flex items-center gap-1.5 relative rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                activeRole === "provider"
                  ? "bg-white text-black shadow-sm"
                  : "text-neutral-500 hover:text-black"
              }`}
            >
              <Landmark className="h-3.5 w-3.5" />
              Capital Provider
            </button>
          </div>

          {/* ElevenLabs CFO Voice Trigger */}
          <button
            onClick={() => setIsVoiceOpen(true)}
            className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 hover:shadow transition"
          >
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            Ask CFO Voice AI
          </button>
        </div>
      </header>

      {/* Audio Feedback Toast */}
      <AnimatePresence>
        {audioFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-black text-white px-5 py-3 text-xs shadow-2xl flex items-center gap-3 border border-white/20"
          >
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span>{audioFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Disbursed Banner Alert */}
        {isDisbursed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl bg-emerald-500 text-white p-6 shadow-xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-base">Capital Disbursed Successfully (Day 0)</h4>
                <p className="text-xs text-white/90">
                  Stitch Double-Entry Journal Posted. Redis Lock Released. Net liquidity credited to Vertex Components.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDisbursed(false)}
              className="rounded-full bg-white/20 px-4 py-2 text-xs font-semibold hover:bg-white/30 transition"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* ----------------- 1. SUPPLIER VIEW ----------------- */}
        {activeRole === "supplier" && (
          <div className="space-y-8">
            {/* Opportunities Selector if multiple */}
            {opportunities.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {opportunities.map((opp) => (
                  <button
                    key={opp.id}
                    onClick={() => {
                      setSelectedOppId(opp.id);
                      if (opp.urgencyWeight !== undefined && opp.urgencyWeight !== null) {
                        setUrgencyWeight(Number(opp.urgencyWeight));
                      }
                    }}
                    className={`rounded-2xl px-4 py-2 text-xs font-semibold border transition ${
                      selectedOppId === opp.id
                        ? "bg-black text-white border-black shadow-sm"
                        : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    {opp.invoice?.invoiceNumber || "Invoice"} • {formatINR(opp.invoice?.faceValue)} ({opp.status})
                  </button>
                ))}
              </div>
            )}

            {/* Hero Overview Card */}
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                    {currentOpp.invoice?.invoiceNumber || "INV-2026-0801"}
                  </h1>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                    {currentOpp.status}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  Buyer Obligor: <strong className="text-neutral-900">{currentOpp.invoice?.customer?.name || "Bharat Auto Ltd"}</strong> ({currentOpp.invoice?.customer?.industry || "auto-components"}) • Face Value: <strong className="text-neutral-900">{formatINR(currentOpp.invoice?.faceValue)}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setIsVerificationModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 px-3.5 py-2 text-xs font-semibold text-neutral-800 border border-neutral-200/80 transition"
                >
                  <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
                  Verify Buyer Call
                </button>

                <div className="rounded-2xl bg-neutral-50 px-4 py-2 border border-neutral-200/60">
                  <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">Verification Tier</span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> {currentOpp.invoice?.verificationTier || "BUYER_ACCEPTED"}
                  </span>
                </div>

                <div className="rounded-2xl bg-neutral-50 px-4 py-2 border border-neutral-200/60">
                  <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">Tenor</span>
                  <span className="text-xs font-bold text-neutral-800">{currentOpp.tenorDays || 45} Days</span>
                </div>
              </div>
            </div>

            {/* Live Bidding Ticker */}
            <BidTicker bids={currentOpp.bids || []} />

            {/* Interactive Urgency vs Cost Slider */}
            <UrgencySlider 
              urgency={urgencyWeight} 
              onChange={setUrgencyWeight}
              derivedWeight={currentOpp.urgencyWeight ? Number(currentOpp.urgencyWeight) : null}
              drivingObligation={currentOpp.drivingObligation}
              sufficiencyFloor={currentOpp.sufficiencyFloor}
            />

            {/* Ditto Deal Breakdown Cards */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-neutral-900 text-base tracking-tight">
                    Ranked Institutional Offers (CodeCrafters Pareto Matching)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Transparent, plain-English breakdown with zero hidden haircuts.
                  </p>
                </div>
                <span className="text-xs font-semibold text-neutral-500">
                  {computedDeals.length} Offers Scored
                </span>
              </div>

              <div className="space-y-4">
                {computedDeals.map((deal, idx) => (
                  <DittoDealCard
                    key={deal.bid.id}
                    deal={deal}
                    isBestMatch={idx === 0 && !deal.isDisqualified}
                    onAccept={handleAcceptDeal}
                    onPlayAudio={handlePlayDealAudio}
                  />
                ))}
              </div>
            </div>

            {/* Stitch Double-Entry Ledger Timeline */}
            <StitchLedgerTimeline opportunityId={currentOpp.id} />
          </div>
        )}

        {/* ----------------- 2. CAPITAL PROVIDER VIEW ----------------- */}
        {activeRole === "provider" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                Capital Provider Liquidity & Risk Cockpit
              </h1>
              <p className="text-xs text-neutral-500 mt-1">
                Configure autonomous NexusX bidding parameters, monitor sector exposure caps, and view live clearinghouse matches.
              </p>
            </div>

            {/* Portfolio Gauges and Autonomous Rules */}
            <PortfolioGauge providerDetail={providers[0]} />

            {/* Stitch Double-Entry Ledger Timeline */}
            <StitchLedgerTimeline />
          </div>
        )}
      </main>

      {/* Floating Autonomous Multi-Agent Stream */}
      <AgentActivityLog />

      {/* ElevenLabs Voice Modals */}
      <ElevenLabsVoiceCockpit
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        dealContext={`Invoice ${currentOpp.invoice?.invoiceNumber} (${formatINR(currentOpp.invoice?.faceValue)}) for ${currentOpp.invoice?.customer?.name}`}
      />

      <VoiceVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        onVerified={() => {
          setAudioFeedback("Outbound call verified: Voice signature registered on Stitch ledger.");
          setTimeout(() => setAudioFeedback(null), 5000);
        }}
      />
    </div>
  );
}
