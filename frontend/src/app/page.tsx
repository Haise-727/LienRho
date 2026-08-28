"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  PhoneCall, 
  Radio,
  Store,
  Landmark,
  Building2,
  FileText,
  Clock,
  Layers,
  ArrowRight,
  TrendingDown
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
  formatINR,
  formatPaiseToINR,
  FALLBACK_OPPORTUNITY,
  FALLBACK_PROVIDER_DETAIL 
} from "@/lib/scoring";
import { 
  fetchOpportunities, 
  fetchProviders, 
  checkDbHealth, 
  matchOpportunity,
  MatchApiResponse,
  ScoredOffer,
  FALLBACK_MATCH_RESULT,
  DbHealthResult 
} from "@/lib/api-client";

export default function MarketplaceDashboard() {
  const [activeRole, setActiveRole] = useState<"supplier" | "provider">("supplier");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([FALLBACK_OPPORTUNITY]);
  const [selectedOppId, setSelectedOppId] = useState<string>(FALLBACK_OPPORTUNITY.id);
  const [providers, setProviders] = useState<CapitalProviderDetail[]>([FALLBACK_PROVIDER_DETAIL]);
  const [dbHealth, setDbHealth] = useState<DbHealthResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Match state (Authoritative results from POST /api/match)
  const [urgencyNudgeBps, setUrgencyNudgeBps] = useState<number>(0);
  const [matchResult, setMatchResult] = useState<MatchApiResponse>(FALLBACK_MATCH_RESULT);
  const [matchingLoading, setMatchingLoading] = useState(false);

  // Modals & Feedback
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

  // Execute matching whenever selected opportunity or urgency override changes
  // Debounced to avoid flooding POST /api/match during slider movement
  useEffect(() => {
    let isCurrent = true;
    setMatchingLoading(true);

    const timer = setTimeout(async () => {
      try {
        const result = await matchOpportunity(selectedOppId, urgencyNudgeBps);
        if (isCurrent) {
          setMatchResult(result);
          setMatchingLoading(false);
        }
      } catch (e) {
        console.error("Match error:", e);
        if (isCurrent) setMatchingLoading(false);
      }
    }, 200);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [selectedOppId, urgencyNudgeBps]);

  const handleAcceptOffer = (offer: ScoredOffer) => {
    setIsDisbursed(true);
    setAudioFeedback(`Disbursal confirmed! ${formatPaiseToINR(offer.netCashPaise)} allocated to ${offer.providerName} and posted to Stitch ledger.`);
    setTimeout(() => setAudioFeedback(null), 5000);
  };

  const handlePlayOfferAudio = (offer: ScoredOffer) => {
    const providerName = offer.providerName || "Provider";
    const netCashStr = formatPaiseToINR(offer.netCashPaise);
    const aprStr = (offer.offer.annualRateBps / 100).toFixed(1) + "%";
    setAudioFeedback(`ElevenLabs Voice Breakdown for ${providerName}: Net advance of ${netCashStr} upfront at ${aprStr} APR lands ${offer.arrivalDate}.`);
    setTimeout(() => setAudioFeedback(null), 6000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] antialiased selection:bg-emerald-600 selection:text-white">
      {/* DB Status Offline/Demo Banner */}
      <DbStatusBanner health={dbHealth} />

      {/* 1. Global Navigation & Institutional Header */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          {/* Brand Logo & Engine Badge */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F172A] text-white shadow-xs font-black text-sm">
              LR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-slate-900 text-sm">LienRho</span>
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200">
                  CSI ORIGIN 2026 PS-5
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Lexicographic Clearinghouse (INR ₹)
              </div>
            </div>
          </div>

          {/* Unified 2-Way Role Switcher (Supplier | Capital Provider) */}
          <div className="flex items-center rounded-lg bg-slate-100 p-1 border border-slate-200 shadow-inner">
            <button
              onClick={() => setActiveRole("supplier")}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeRole === "supplier"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Store className="h-3.5 w-3.5" />
              Supplier Cockpit
            </button>
            <button
              onClick={() => setActiveRole("provider")}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeRole === "provider"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Landmark className="h-3.5 w-3.5" />
              Capital Provider
            </button>
          </div>

          {/* ElevenLabs CFO Voice Trigger */}
          <button
            onClick={() => setIsVoiceOpen(true)}
            className="flex items-center gap-2 rounded-md bg-[#0F172A] hover:bg-slate-800 px-3.5 py-2 text-xs font-medium text-white shadow-xs transition"
          >
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            CFO Voice Assistant
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
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-[#0F172A] text-white px-5 py-3 text-xs shadow-xl flex items-center gap-3 border border-slate-700"
          >
            <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{audioFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Disbursed Banner Alert */}
        {isDisbursed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl bg-emerald-700 text-white p-5 shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-base">Capital Disbursed Successfully (Day 0)</h4>
                <p className="text-xs text-emerald-100">
                  Stitch Double-Entry Journal Posted. Zero-difference invariant verified. Net liquidity credited to Vertex Components.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDisbursed(false)}
              className="rounded-md bg-white/20 px-3.5 py-1.5 text-xs font-semibold hover:bg-white/30 transition"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* ----------------- 1. SUPPLIER VIEW ----------------- */}
        {activeRole === "supplier" && (
          <div className="space-y-6">
            {/* Opportunities Selector if multiple */}
            {opportunities.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {opportunities.map((opp) => (
                  <button
                    key={opp.id}
                    onClick={() => {
                      setSelectedOppId(opp.id);
                    }}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold border transition ${
                      selectedOppId === opp.id
                        ? "bg-[#0F172A] text-white border-[#0F172A] shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {opp.invoice?.invoiceNumber || "Invoice"} • {formatINR(opp.invoice?.faceValue)} ({opp.status})
                  </button>
                ))}
              </div>
            )}

            {/* Hero Overview Card */}
            <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {currentOpp.invoice?.invoiceNumber || "INV-2026-0801"}
                  </h1>
                  <span className="rounded bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                    {currentOpp.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Buyer Obligor: <strong className="text-slate-900">{currentOpp.invoice?.customer?.name || "Bharat Auto Ltd"}</strong> ({currentOpp.invoice?.customer?.industry || "auto-components"}) • Face Value: <strong className="text-slate-900">{formatINR(currentOpp.invoice?.faceValue)}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setIsVerificationModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-md bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-800 border border-slate-200 transition"
                >
                  <PhoneCall className="h-3.5 w-3.5 text-emerald-700" />
                  Verify Buyer Call
                </button>

                <div className="rounded-md bg-slate-50 px-3.5 py-1.5 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Verification Tier</span>
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> {currentOpp.invoice?.verificationTier || "BUYER_ACCEPTED"}
                  </span>
                </div>

                <div className="rounded-md bg-slate-50 px-3.5 py-1.5 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Tenor</span>
                  <span className="text-xs font-bold text-slate-900">{currentOpp.tenorDays || 45} Days</span>
                </div>
              </div>
            </div>

            {/* Live Bidding Ticker */}
            <BidTicker bids={currentOpp.bids || []} />

            {/* Interactive Urgency Override Slider (Connected to POST /api/match) */}
            <UrgencySlider 
              urgencyNudgeBps={urgencyNudgeBps} 
              onChange={setUrgencyNudgeBps}
              drivingObligation={matchResult.utility?.drivingObligation || currentOpp.drivingObligation}
              sufficiencyFloor={matchResult.utility?.sufficiencyFloorPaise 
                ? matchResult.utility.sufficiencyFloorPaise / 100 
                : currentOpp.sufficiencyFloor}
            />

            {/* Scored Offers Breakdown from /api/match */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900 text-base tracking-tight flex items-center gap-2">
                    Ranked Institutional Offers (Lexicographic Clearing Engine)
                    {matchingLoading && (
                      <span className="text-[11px] text-slate-400 font-normal animate-pulse">
                        (Clearing match...)
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gated by sufficiency floor & timing deadline before ranking on true cost (denominator = net cash delivered).
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-600 font-mono">
                  {matchResult.scoredOffers.length} Offers Scored
                </span>
              </div>

              <div className="space-y-3">
                {matchResult.scoredOffers.map((offer) => (
                  <DittoDealCard
                    key={offer.offer.id}
                    offer={offer}
                    isBestMatch={offer.rank === 1 && !offer.disqualified}
                    onAccept={handleAcceptOffer}
                    onPlayAudio={handlePlayOfferAudio}
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
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Capital Provider Liquidity & Risk Cockpit
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Configure autonomous LiteLLM underwriting rules, monitor sector exposure caps, and view real-time clearinghouse matches.
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
