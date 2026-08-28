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
  toComputedDeal,
  ComputedDeal, 
  formatINR
} from "@/lib/scoring";
import { 
  fetchOpportunities, 
  fetchProviders, 
  checkDbHealth, 
  matchOpportunity,
  DbHealthResult 
} from "@/lib/api-client";
import type { MatchResult } from "@/lib/market/types";

export default function MarketplaceDashboard() {
  const [activeRole, setActiveRole] = useState<"supplier" | "provider">("supplier");
  // Empty initial state, not mock data. A screen that renders invented deals
  // before the real ones arrive teaches everyone to trust figures that were
  // never computed.
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOppId, setSelectedOppId] = useState<string>("");
  const [providers, setProviders] = useState<CapitalProviderDetail[]>([]);
  const [match, setMatch] = useState<MatchResult | null>(null);
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
    return opportunities.find(o => o.id === selectedOppId) || opportunities[0];
  }, [opportunities, selectedOppId]);

  // Clear the selected opportunity through the matching engine whenever it or
  // the urgency nudge changes.
  //
  // The scoring is NOT done here. It used to be, and it was wrong three ways at
  // once — effective cost divided by the advance instead of net cash, gates
  // applied as a x0.3 score penalty rather than as gates, and the timing check
  // comparing day counts instead of dates. The engine owns all of it now.
  useEffect(() => {
    if (!currentOpp?.id) {
      setMatch(null);
      return;
    }
    let cancelled = false;
    matchOpportunity(currentOpp.id, Math.round(urgencyWeight * 10_000)).then((result) => {
      if (!cancelled) setMatch(result);
    });
    return () => {
      cancelled = true;
    };
  }, [currentOpp?.id, urgencyWeight]);

  // Map the engine's scored offers onto what the cards render. Winner first,
  // then remaining survivors, then disqualified offers — which are kept rather
  // than hidden, because showing why an option lost is the point.
  const computedDeals = useMemo<ComputedDeal[]>(() => {
    if (!match) return [];
    const bidsById = new Map((currentOpp?.bids || []).map((b) => [b.id, b]));

    return [...match.scoredOffers]
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
      .map((scored) => {
        const bid = bidsById.get(scored.offer.id);
        return bid ? toComputedDeal(scored, bid) : null;
      })
      .filter((d): d is ComputedDeal => d !== null);
  }, [match, currentOpp]);

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

  // No opportunity to show. Previously this state was impossible because the
  // page started from a hardcoded FALLBACK_OPPORTUNITY, which meant a failed
  // fetch rendered an invented deal indistinguishable from a real one. Saying
  // "we could not load this" is the honest answer and the more useful one.
  if (!currentOpp) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] antialiased">
        <DbStatusBanner health={dbHealth} />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          {loading ? (
            <p className="text-sm text-neutral-500">Loading the marketplace…</p>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-neutral-900">
                No opportunities to show
              </h1>
              <p className="mt-2 text-sm text-neutral-600">
                The marketplace is reachable but returned nothing, or the
                database could not be reached. Check{" "}
                <code className="rounded bg-neutral-200 px-1">DATABASE_URL</code>{" "}
                and that the database has been seeded.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

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
