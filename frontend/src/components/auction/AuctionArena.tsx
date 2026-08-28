"use client";

import React, { useState, useEffect } from "react";
import { UrgencySlider } from "./UrgencySlider";
import { WinningBidCard } from "./WinningBidCard";
import { CollapsibleDisqualifiedBids } from "./CollapsibleDisqualifiedBids";
import { VoiceAgentWidget } from "@/components/voice/VoiceAgentWidget";
import { matchOpportunity, MatchApiResponse, ScoredOffer } from "@/lib/api-client";
import { Sparkles, Activity, ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface AuctionArenaProps {
  invoiceId: string;
  opportunityId: string;
  initialUrgencyBps?: number;
  drivingObligation?: string | null;
  sufficiencyFloor?: string | number | null;
}

export function AuctionArena({
  invoiceId,
  opportunityId,
  initialUrgencyBps = 0,
  drivingObligation = "September payroll",
  sufficiencyFloor = "900000.00",
}: AuctionArenaProps) {
  const [urgencyNudgeBps, setUrgencyNudgeBps] = useState<number>(initialUrgencyBps);
  // Null until the engine answers. Seeding this with FALLBACK_MATCH_RESULT
  // meant an unreachable engine still rendered a finished auction with a winner
  // and figures (#41).
  const [matchResult, setMatchResult] = useState<MatchApiResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioFeedback, setAudioFeedback] = useState<string | null>(null);

  // Trigger POST /api/match whenever urgency override changes
  useEffect(() => {
    let isCurrent = true;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await matchOpportunity(opportunityId, urgencyNudgeBps);
        if (isCurrent) {
          setMatchResult(res);
          setFailed(res === null);
          setLoading(false);
        }
      } catch (err) {
        console.error("Match error in arena:", err);
        if (isCurrent) setLoading(false);
      }
    }, 150);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [opportunityId, urgencyNudgeBps]);

  // Nothing to show until the engine answers. Rendering the arena around an
  // empty result would put zeros where money belongs, which reads as a priced
  // deal worth nothing rather than as an absent one.
  if (!matchResult) {
    return (
      <div className="py-16 text-center">
        {failed ? (
          <>
            <p className="text-sm font-semibold text-slate-900">
              Could not clear this auction
            </p>
            <p className="mt-1 text-xs text-slate-500">
              The matching engine did not respond. No offer has been evaluated —
              nothing shown here would be a real result.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Clearing the auction…</p>
        )}
      </div>
    );
  }

  // Separate winning rank #1 offer from disqualified offers
  const winningOffer = matchResult.scoredOffers.find(
    (o) => o.rank === 1 && !o.disqualified
  ) || matchResult.scoredOffers[0];

  const disqualifiedOffers = matchResult.scoredOffers.filter((o) => o.disqualified);

  const handlePlayAudio = (offer: ScoredOffer) => {
    setAudioFeedback(`CFO Voice Breakdown: ${offer.providerName} delivers net cash of ₹${(offer.netCashPaise / 100).toLocaleString('en-IN')} upfront with 0 days settlement.`);
    setTimeout(() => setAudioFeedback(null), 5000);
  };

  return (
    <div className="relative space-y-6">
      {/* Breadcrumb / Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard/supplier/invoice/${invoiceId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Cash Forecast
        </Link>

        {/* Floating / Top Pill Voice Widget */}
        <VoiceAgentWidget
          opportunityId={opportunityId}
          dealContext={`Invoice ${invoiceId} · Cleared for ${winningOffer?.providerName || 'Rapidfin'}`}
        />
      </div>

      {/* Arena Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Clearinghouse Auction Arena
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-attribute clearing under two-sided constraints. Gated on sufficiency and timing before cost ranking.
          </p>
        </div>

        {loading && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-200 animate-pulse">
            <Activity className="h-3.5 w-3.5 animate-spin" />
            Recalculating Pareto frontier...
          </div>
        )}
      </div>

      {/* TOP: Urgency Slider */}
      <UrgencySlider
        urgencyNudgeBps={urgencyNudgeBps}
        onChange={setUrgencyNudgeBps}
        drivingObligation={matchResult.utility?.drivingObligation || drivingObligation}
        sufficiencyFloor={
          matchResult.utility?.sufficiencyFloorPaise
            ? matchResult.utility.sufficiencyFloorPaise / 100
            : sufficiencyFloor
        }
      />

      {/* CENTER: Massive Winning Bid Card (Rank #1 Pareto Optimum) */}
      {winningOffer && (
        <div className="space-y-2">
          <WinningBidCard
            offer={winningOffer}
            invoiceId={invoiceId}
            onPlayAudio={handlePlayAudio}
          />
        </div>
      )}

      {/* BOTTOM: Hidden/Enclosed Collapsible Disqualified Bids */}
      <CollapsibleDisqualifiedBids disqualifiedOffers={disqualifiedOffers} />
    </div>
  );
}
