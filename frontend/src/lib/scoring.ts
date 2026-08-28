// Domain Types matching Prisma Schema & Track 1/2 contracts

export type VerificationTier = "BUYER_ACCEPTED" | "LEDGER_VERIFIED" | "SUPPLIER_ASSERTED";
export type OpportunityStatus = 
  | "RECEIVED" 
  | "VERIFIED" 
  | "AUCTION_LIVE" 
  | "MATCHED" 
  | "DISBURSING" 
  | "DISBURSED" 
  | "AWAITING_BUYER" 
  | "BUYER_PAID" 
  | "RESERVE_RELEASED" 
  | "CLOSED" 
  | "NO_ACCEPTABLE_OFFER" 
  | "DEFAULTED" 
  | "DISPUTED";

export type ProviderArchetype = "BANK" | "NBFC" | "FINTECH" | "CREDIT_FUND" | "SECTOR_SPECIALIST";

export interface Customer {
  id: string;
  slug: string;
  name: string;
  taxId?: string | null;
  industry?: string | null;
  averageDelayDays?: number | null;
  relationshipDurationDays?: number | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  faceValue: string | number;
  currency: string;
  invoiceDate: string;
  dueDate: string;
  acceptanceDate?: string | null;
  verificationTier: VerificationTier;
  threeWayMatched: boolean;
  fingerprint: string;
  customer: Customer;
}

export interface CashObligation {
  id: string;
  label: string;
  amountPaise: number;
  dueDate: string;
}

export interface CashPosition {
  id: string;
  asOfDate: string;
  currentCashPaise: number;
  cashThresholdPaise: number;
  obligations: CashObligation[];
}

export interface ProviderSummary {
  id: string;
  name: string;
  archetype: ProviderArchetype;
  settlementDays: number;
  reliabilityScore: string | number;
}

export interface Bid {
  id: string;
  opportunityId: string;
  providerId: string;
  annualRate: string | number; // APR e.g. 0.11
  advanceRate: string | number; // e.g. 0.80 (80%)
  flatFee: string | number; // e.g. 2500
  tenorDays: number;
  settlementDays: number; // e.g. 3
  recourse: boolean;
  repaymentStructure: "BULLET" | "AMORTISING" | "REVOLVING";
  status: "ACTIVE" | "WITHDRAWN" | "EXPIRED" | "WON" | "LOST";
  netCashToSupplier?: string | number | null;
  effectiveAnnualCost?: string | number | null;
  utilityScore?: string | number | null;
  rank?: number | null;
  gateFailures?: string[];
  provider: ProviderSummary;
}

export interface Match {
  id: string;
  allocatedAmount: string | number;
  advanceAmount: string | number;
  discountCharge: string | number;
  feeAmount: string | number;
  netDisbursed: string | number;
  reserveAmount: string | number;
  quotedSettlementDays: number;
  quotedDisbursalDate: string;
  actualDisbursalDate?: string | null;
  expectedBuyerPayment: string;
  actualBuyerPayment?: string | null;
  provider?: ProviderSummary;
}

export interface Opportunity {
  id: string;
  orgId: string;
  status: OpportunityStatus;
  requestedAmount: string | number;
  tenorDays: number;
  riskGrade?: string | null;
  probabilityOfDefault?: string | number | null;
  expectedDilutionPct?: string | number | null;
  sufficiencyFloor?: string | number | null;
  timingDeadline?: string | null;
  drivingObligation?: string | null;
  urgencyWeight?: string | number | null;
  createdAt: string;
  invoice: Invoice;
  cashPosition?: CashPosition | null;
  bids: Bid[];
  match?: Match | null;
}

export interface CapitalProviderDetail {
  id: string;
  orgId: string;
  name: string;
  archetype: ProviderArchetype;
  costOfFunds: string | number;
  hurdleRate: string | number;
  totalLiquidity: string | number;
  availableLiquidity: string | number;
  minTicket: string | number;
  maxTicket: string | number;
  minTenorDays: number;
  maxTenorDays: number;
  riskAppetiteFloor: string;
  concentrationLimitPct: string | number;
  settlementDays: number;
  sectorFocus: string[];
  reliabilityScore: string | number;
  bids?: Array<{
    id: string;
    opportunityId: string;
    annualRate: string | number;
    advanceRate: string | number;
    status: string;
    opportunity?: {
      id: string;
      status: string;
      requestedAmount: string | number;
    };
  }>;
}

// ------------------------------------------------------------- Formatters
// --------------------------------------------------------------- formatting
//
// Thin wrappers over `lib/market/money.ts` so there is one implementation of
// each format in the codebase. The engine works in integer paise; these types
// carry rupee strings off the wire, so the conversion happens here rather than
// being repeated at every call site.

import { formatPaise, formatBps } from "@/lib/market/money";
import { decimalToPaise } from "@/lib/market/prisma-adapter";
import type { ScoredOffer } from "@/lib/market/types";

/** `₹9,34,188.36` from a rupee string, number, or null. */
export function formatINR(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return formatPaise(decimalToPaise(String(value)));
}

/** Alias kept for existing call sites. */
export const formatINRDecimal = formatINR;

/** `13.73%` from a fraction (0.1373) or a rupee-style string. */
export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return formatBps(Number(value) * 10_000);
}

// ------------------------------------------------------------- deal display
//
// What the deal cards render.
//
// Every figure here is COPIED from the clearing engine's `ScoredOffer`, never
// recomputed. This file previously carried its own arithmetic and it was wrong
// in three separate ways — it divided effective cost by the advance instead of
// net cash received (understating true cost by ~23bp), it scored offers with a
// weighted sum whose gate "penalty" was a x0.3 multiplier rather than a gate,
// and it re-derived the timing gate by comparing day counts instead of dates.
//
// The weighted sum is worth calling out specifically: with a multiplier rather
// than a gate, a disqualified offer could still outrank a qualified one on a
// high enough raw score. That is precisely the failure PS-5 exists to describe,
// rebuilt inside the product meant to fix it.

export interface ComputedDeal {
  bid: Bid;
  faceValue: number;
  /** What actually reaches the supplier's account. */
  netCashToday: number;
  discountCharge: number;
  flatFee: number;
  totalCost: number;
  /** True cost: charges over NET CASH RECEIVED, annualised. */
  effectiveApr: number;
  reserveAmount: number;
  speedBadge: string;
  /** Plain-English gate failures, written by the engine to be displayed. */
  gateFailures: string[];
  isDisqualified: boolean;
  /** 1-based rank among offers that cleared both gates. Null if disqualified. */
  rank: number | null;
  /** True when some other offer beats this one on cash, cost and speed at once. */
  isDominated: boolean;
}

function speedBadgeFor(settlementDays: number): string {
  if (settlementDays <= 0) return "⚡ Instant (T+0)";
  if (settlementDays === 1) return "⚡ 24 Hours (T+1)";
  if (settlementDays === 2) return "⏳ 48 Hours (T+2)";
  return `⏳ ${settlementDays} Days (T+${settlementDays})`;
}

/**
 * Map one engine-scored offer into what the cards render.
 *
 * A pure rename, deliberately: no arithmetic, no thresholds, no scoring. If a
 * figure is needed that the engine does not return, add it to `ScoredOffer`
 * rather than deriving it here — two implementations of the same finance is how
 * the screen and the audit trail end up disagreeing.
 *
 * Paise are divided by 100 only because these display types speak rupees. That
 * is the last step before rendering, never an input to a further calculation.
 */
export function toComputedDeal(scored: ScoredOffer, bid: Bid): ComputedDeal {
  const faceValueRupees =
    scored.offer.advanceRateBps > 0
      ? scored.advancePaise / (scored.offer.advanceRateBps / 10_000) / 100
      : 0;

  const gateFailures: string[] = [];
  if (!scored.gates.sufficiency.passed) gateFailures.push(scored.gates.sufficiency.reason);
  if (!scored.gates.timing.passed) gateFailures.push(scored.gates.timing.reason);

  return {
    bid,
    faceValue: faceValueRupees,
    netCashToday: scored.netCashPaise / 100,
    discountCharge: scored.discountChargePaise / 100,
    flatFee: scored.offer.feesPaise / 100,
    totalCost: (scored.discountChargePaise + scored.offer.feesPaise) / 100,
    // Fraction, because formatPercent multiplies back up. The engine's value is
    // basis points and keeps its fractional part so ranking cannot tie.
    effectiveApr: scored.effectiveCostBps / 10_000,
    reserveAmount: faceValueRupees - scored.advancePaise / 100,
    speedBadge: speedBadgeFor(scored.offer.settlementDays),
    gateFailures,
    isDisqualified: scored.disqualified,
    rank: scored.rank,
    isDominated: scored.dominatedBy !== null,
  };
}
