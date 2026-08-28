// Shared clearing helpers for the agent's treasury tools.
//
// These wrap the SAME deterministic clearing loader the screens use
// (clearById) — the agent never re-derives a rupee figure. The only new logic
// here is choosing which auction to talk about when the caller named none, which
// is copied verbatim from the former /api/voice/answer router so behaviour is
// unchanged and deterministic.

import { prisma } from "@/lib/db";
import type { MatchResult, ScoredOffer } from "@/lib/market/types";
import { rupees, percent, settlement } from "./format";

/**
 * Pick a subject when the caller did not name one. Deterministic on purpose:
 * the worked-example invoice first, then the oldest live auction that actually
 * has bids.
 */
export async function resolveOpportunityId(
  opportunityId?: string,
): Promise<string | undefined> {
  if (opportunityId) return opportunityId;

  const preferred = await prisma.financingOpportunity.findFirst({
    where: { status: "AUCTION_LIVE", invoice: { invoiceNumber: "INV-2026-0801" } },
    select: { id: true },
  });
  const fallback =
    preferred ??
    (await prisma.financingOpportunity.findFirst({
      where: { status: "AUCTION_LIVE", bids: { some: {} } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }));

  return fallback?.id;
}

/** The winning (rank 1, not disqualified) offer, or null. */
export function winnerOf(result: MatchResult): ScoredOffer | null {
  if (result.status === "NO_ACCEPTABLE_OFFER") return null;
  return (
    result.scoredOffers.find((o) => o.rank === 1 && !o.disqualified) ?? null
  );
}

/** The offer with the lowest true cost, regardless of gates. */
export function cheapestOf(result: MatchResult): ScoredOffer | null {
  if (result.scoredOffers.length === 0) return null;
  return [...result.scoredOffers].sort(
    (a, b) => a.effectiveCostBps - b.effectiveCostBps,
  )[0];
}

/** One-line explanation of an offer, in the same voice as the scripts. */
export function offerSummary(o: ScoredOffer): string {
  const parts: string[] = [];
  parts.push(
    `${o.providerName} puts ${rupees(o.netCashPaise)} rupees in the account, ` +
      `landing ${settlement(o.offer.settlementDays)}.`,
  );
  parts.push(
    `Headline rate ${percent(o.offer.annualRateBps)}, true cost ` +
      `${percent(o.effectiveCostBps)} once the advance rate and fees are counted.`,
  );
  if (o.disqualified) {
    parts.push("Disqualified.");
    if (!o.gates.sufficiency.passed) parts.push(o.gates.sufficiency.reason + ".");
    if (!o.gates.timing.passed) parts.push(o.gates.timing.reason + ".");
  } else if (o.rank === 1) {
    parts.push("This is the best available offer: clears both gates and has the lowest true cost of the survivors.");
  } else {
    parts.push(`Clears both gates, ranks ${o.rank} on true cost among survivors.`);
  }
  return parts.join(" ");
}
