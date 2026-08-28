"use client";

import React, { useState, useMemo } from "react";
import { 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  PhoneCall, 
  Radio 
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
import { Bid, rankBids, ComputedDeal } from "@/lib/scoring";

// Mock Institutional Bids (CSI ORIGIN 2026 PS-5 Multi-Attribute Pool)
const initialBids: Bid[] = [
  {
    id: "bid-alpha",
    providerId: "prov-1",
    providerName: "Alpha Bank Global",
    rating: "AAA",
    advanceRate: 0.88,
    apr: 0.112,
    speedDays: 0.08, // 2 hours
    processingFeeRate: 0.005,
    tenorDays: 90,
    availableLiquidity: 2500000
  },
  {
    id: "bid-horizon",
    providerId: "prov-2",
    providerName: "Horizon Credit Fund",
    rating: "AA+",
    advanceRate: 0.85,
    apr: 0.098,
    speedDays: 2.0, // 2 days
    processingFeeRate: 0.003,
    tenorDays: 90,
    availableLiquidity: 1800000
  },
  {
    id: "bid-apex",
    providerId: "prov-3",
    providerName: "Apex Trade NBFC",
    rating: "A-",
    advanceRate: 0.92,
    apr: 0.138,
    speedDays: 0.25, // 6 hours
    processingFeeRate: 0.008,
    tenorDays: 90,
    availableLiquidity: 950000
  }
];

export default function MarketplaceDashboard() {
  const [activeRole, setActiveRole] = useState<"supplier" | "buyer" | "provider">("supplier");
  const [urgencyWeight, setUrgencyWeight] = useState<number>(0.6); // Default 60% speed bias
  const [invoiceAmount] = useState<number>(100000); // $100k test invoice
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isDisbursed, setIsDisbursed] = useState(false);
  const [audioFeedback, setAudioFeedback] = useState<string | null>(null);

  // Compute Pareto Utility Rank dynamically whenever slider or bids change
  const computedDeals = useMemo(() => {
    return rankBids(initialBids, invoiceAmount, urgencyWeight);
  }, [urgencyWeight, invoiceAmount]);

  const handleAcceptDeal = (deal: ComputedDeal) => {
    setIsDisbursed(true);
    setAudioFeedback(`Disbursal confirmed! $${deal.netCashToday.toLocaleString()} locked and posted via Stitch ledger.`);
    setTimeout(() => setAudioFeedback(null), 5000);
  };

  const handlePlayDealAudio = (deal: ComputedDeal) => {
    setAudioFeedback(`Speaking breakdown for ${deal.bid.providerName}: You receive $${deal.netCashToday.toLocaleString()} immediately at ${(deal.bid.apr * 100).toFixed(1)}% APR with total fees of $${deal.totalCost.toFixed(0)}.`);
    setTimeout(() => setAudioFeedback(null), 6000);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] antialiased selection:bg-black selection:text-white">
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
                Multi-Attribute Clearinghouse Active
              </div>
            </div>
          </div>

          {/* Unified Role Switcher (Single Universal Account) */}
          <div className="flex items-center rounded-full bg-neutral-100 p-1 border border-neutral-200/60 shadow-inner">
            <button
              onClick={() => setActiveRole("supplier")}
              className={`relative rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                activeRole === "supplier"
                  ? "bg-white text-black shadow-sm"
                  : "text-neutral-500 hover:text-black"
              }`}
            >
              Supplier Cockpit
            </button>
            <button
              onClick={() => setActiveRole("buyer")}
              className={`relative rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                activeRole === "buyer"
                  ? "bg-white text-black shadow-sm"
                  : "text-neutral-500 hover:text-black"
              }`}
            >
              Enterprise Buyer
            </button>
            <button
              onClick={() => setActiveRole("provider")}
              className={`relative rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                activeRole === "provider"
                  ? "bg-white text-black shadow-sm"
                  : "text-neutral-500 hover:text-black"
              }`}
            >
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
                  Stitch Double-Entry Ledger updated. Redis lock released. $88,000 transferred to Supplier Primary Wallet.
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
            {/* Hero Overview */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                  Invoice Auction Cockpit
                </h1>
                <p className="text-xs text-neutral-500 mt-1">
                  Verified Receivable #INV-8042 • Obligor: <strong className="text-neutral-800">Metro Retail Corp</strong> • Face Value: <strong className="text-neutral-800">$100,000.00</strong>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white px-4 py-2.5 shadow-sm border border-neutral-200/80">
                  <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">Verification Tier</span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Buyer-Accepted (Tier 1)
                  </span>
                </div>
                <div className="rounded-2xl bg-white px-4 py-2.5 shadow-sm border border-neutral-200/80">
                  <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">Maturity Window</span>
                  <span className="text-xs font-bold text-neutral-800">90 Days (Nov 25)</span>
                </div>
              </div>
            </div>

            {/* Live Bidding Ticker */}
            <BidTicker bids={initialBids} />

            {/* Interactive Urgency vs Cost Slider */}
            <UrgencySlider urgency={urgencyWeight} onChange={setUrgencyWeight} />

            {/* Ditto Deal Breakdown Cards */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-neutral-900 text-base tracking-tight">
                    Ranked Institutional Offers (CodeCrafters Pareto Sort)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Transparent, plain-English breakdown with zero hidden haircuts.
                  </p>
                </div>
                <span className="text-xs font-semibold text-neutral-500">
                  3 Bids Cleared
                </span>
              </div>

              <div className="space-y-4">
                {computedDeals.map((deal, idx) => (
                  <DittoDealCard
                    key={deal.bid.id}
                    deal={deal}
                    isBestMatch={idx === 0}
                    onAccept={handleAcceptDeal}
                    onPlayAudio={handlePlayDealAudio}
                  />
                ))}
              </div>
            </div>

            {/* Stitch Double-Entry Ledger Timeline */}
            <StitchLedgerTimeline />
          </div>
        )}

        {/* ----------------- 2. BUYER VIEW ----------------- */}
        {activeRole === "buyer" && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                  Enterprise Buyer Approval & Outbound Desk
                </h1>
                <p className="text-xs text-neutral-500 mt-1">
                  Manage incoming supplier financing notices, review 3-way match validation, and simulate outbound confirmation.
                </p>
              </div>
              <button
                onClick={() => setIsVerificationModalOpen(true)}
                className="flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 transition"
              >
                <PhoneCall className="h-4 w-4 text-emerald-400" />
                Launch Outbound Call Simulator
              </button>
            </div>

            {/* 3-Way Match Enterprise Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200/80">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Incoming Invoices</span>
                <span className="text-3xl font-bold text-neutral-900 block mt-2">12 Active</span>
                <span className="text-xs text-emerald-600 mt-1 block font-medium">100% 3-Way Match Rate</span>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200/80">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Pending Voice Approvals</span>
                <span className="text-3xl font-bold text-amber-600 block mt-2">1 Immediate</span>
                <span className="text-xs text-neutral-500 mt-1 block">Metro Retail Batch #4092</span>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200/80">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Total Payable Escrow</span>
                <span className="text-3xl font-bold text-neutral-900 block mt-2">$1,240,000</span>
                <span className="text-xs text-neutral-500 mt-1 block">Due across 30-90 days</span>
              </div>
            </div>

            {/* Stitch Double-Entry Ledger Timeline */}
            <StitchLedgerTimeline />
          </div>
        )}

        {/* ----------------- 3. CAPITAL PROVIDER VIEW ----------------- */}
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
            <PortfolioGauge />

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
        dealContext="Invoice #8042 ($100k) from Metro Retail"
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
