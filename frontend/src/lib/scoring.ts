// Domain Types matching Prisma Schema & Track 1/2 contracts
// Note: All financial math and matching calculations are computed exclusively
// on the server (POST /api/match). This file contains strictly domain interfaces,
// presentation formatters, and seed mock types.

import { formatPaise, formatBps } from "@/lib/market/money";
import { decimalToPaise } from "@/lib/market/prisma-adapter";
import type { ScoredOffer } from "@/lib/market/types";

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

// ------------------------------------------------------------- Pure Presentation Formatters

export function formatINR(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return formatPaise(decimalToPaise(String(value)));
}

export const formatINRDecimal = formatINR;

export function formatPaiseToINR(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || isNaN(paise)) return "₹0.00";
  return formatPaise(paise);
}

export function formatPaiseToLakhs(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || isNaN(paise)) return "₹0.00L";
  const lakhs = paise / 10000000;
  return `₹${lakhs.toFixed(2)}L`;
}

export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return formatBps(Number(value) * 10_000);
}

export { formatBps };

// ------------------------------------------------------------- Deal Display Mapper

export interface ComputedDeal {
  bid: Bid;
  faceValue: number;
  netCashToday: number;
  discountCharge: number;
  flatFee: number;
  totalCost: number;
  effectiveApr: number;
  reserveAmount: number;
  speedBadge: string;
  gateFailures: string[];
  isDisqualified: boolean;
  rank: number | null;
  isDominated?: boolean;
}

function speedBadgeFor(settlementDays: number): string {
  if (settlementDays <= 0) return "⚡ Instant (T+0)";
  if (settlementDays === 1) return "⚡ 24 Hours (T+1)";
  if (settlementDays === 2) return "⏳ 48 Hours (T+2)";
  return `⏳ ${settlementDays} Days (T+${settlementDays})`;
}

export function toComputedDeal(scored: ScoredOffer, bid: Bid): ComputedDeal {
  const gateFailures: string[] = [];
  if (!scored.gates.sufficiency.passed) gateFailures.push(scored.gates.sufficiency.reason);
  if (!scored.gates.timing.passed) gateFailures.push(scored.gates.timing.reason);

  const faceValue = scored.advancePaise + (scored.netCashPaise - scored.advancePaise);
  const reserveAmount = Math.max(0, (faceValue - scored.advancePaise) / 100);

  return {
    bid,
    faceValue: faceValue / 100,
    netCashToday: scored.netCashPaise / 100,
    discountCharge: scored.discountChargePaise / 100,
    flatFee: scored.offer.feesPaise / 100,
    totalCost: (scored.discountChargePaise + scored.offer.feesPaise) / 100,
    effectiveApr: scored.effectiveCostBps / 10_000,
    reserveAmount,
    speedBadge: speedBadgeFor(scored.offer.settlementDays),
    gateFailures,
    isDisqualified: scored.disqualified,
    rank: scored.rank,
  };
}

// ------------------------------------------------------------- Fallback Seed Mock Data (INR)
export const FALLBACK_OPPORTUNITY: Opportunity = {
  id: "opp-seed-001",
  orgId: "org-vertex",
  status: "AUCTION_LIVE",
  requestedAmount: "1000000.00",
  tenorDays: 45,
  riskGrade: "A",
  probabilityOfDefault: "0.021000",
  expectedDilutionPct: "0.005000",
  sufficiencyFloor: "900000.00",
  timingDeadline: "2026-08-30T00:00:00.000Z",
  drivingObligation: "September payroll",
  urgencyWeight: "0",
  createdAt: new Date().toISOString(),
  invoice: {
    id: "inv-seed-001",
    invoiceNumber: "INV-2026-0801",
    faceValue: "1000000.00",
    currency: "INR",
    invoiceDate: "2026-08-23T00:00:00.000Z",
    dueDate: "2026-10-07T00:00:00.000Z",
    acceptanceDate: "2026-08-25T00:00:00.000Z",
    verificationTier: "BUYER_ACCEPTED",
    threeWayMatched: true,
    fingerprint: "0x7a8b9c...e102",
    customer: {
      id: "cust-001",
      slug: "bharat-auto",
      name: "Bharat Auto Ltd",
      taxId: "27AAACB1111B1Z6",
      industry: "auto-components",
      averageDelayDays: 4.2,
      relationshipDurationDays: 1460
    }
  },
  cashPosition: {
    id: "cp-001",
    asOfDate: new Date().toISOString(),
    currentCashPaise: 0,
    cashThresholdPaise: 10000000,
    obligations: [
      {
        id: "ob-1",
        label: "September payroll",
        amountPaise: 90000000,
        dueDate: "2026-08-30T00:00:00.000Z"
      },
      {
        id: "ob-2",
        label: "Kalyani Steel invoice payable",
        amountPaise: 4607284,
        dueDate: "2026-08-31T00:00:00.000Z"
      }
    ]
  },
  bids: [
    {
      id: "bid-rapidfin",
      opportunityId: "opp-seed-001",
      providerId: "prov-rapidfin",
      annualRate: "0.135000",
      advanceRate: "0.950000",
      flatFee: "0.00",
      tenorDays: 45,
      settlementDays: 0,
      recourse: false,
      repaymentStructure: "BULLET",
      status: "ACTIVE",
      netCashToSupplier: "934188.36",
      effectiveAnnualCost: "0.137300",
      utilityScore: "1.000000",
      rank: 1,
      gateFailures: [],
      provider: {
        id: "prov-rapidfin",
        name: "Rapidfin",
        archetype: "FINTECH",
        settlementDays: 0,
        reliabilityScore: "1.000000"
      }
    },
    {
      id: "bid-kaveri",
      opportunityId: "opp-seed-001",
      providerId: "prov-kaveri",
      annualRate: "0.122000",
      advanceRate: "0.880000",
      flatFee: "1000.00",
      tenorDays: 45,
      settlementDays: 1,
      recourse: true,
      repaymentStructure: "BULLET",
      status: "ACTIVE",
      netCashToSupplier: "865763.84",
      effectiveAnnualCost: "0.133400",
      utilityScore: "0.000000",
      rank: 2,
      gateFailures: ["Fails Sufficiency Floor (₹8.66L < ₹9.00L)", "Misses Timing Deadline (31 Aug > 30 Aug)"],
      provider: {
        id: "prov-kaveri",
        name: "Kaveri Capital (NBFC)",
        archetype: "NBFC",
        settlementDays: 1,
        reliabilityScore: "1.000000"
      }
    },
    {
      id: "bid-meridian",
      opportunityId: "opp-seed-001",
      providerId: "prov-meridian",
      annualRate: "0.110000",
      advanceRate: "0.800000",
      flatFee: "2500.00",
      tenorDays: 45,
      settlementDays: 3,
      recourse: true,
      repaymentStructure: "BULLET",
      status: "ACTIVE",
      netCashToSupplier: "786650.68",
      effectiveAnnualCost: "0.137600",
      utilityScore: "0.000000",
      rank: 3,
      gateFailures: ["short ₹1.13L", "three days late"],
      provider: {
        id: "prov-meridian",
        name: "Meridian Bank",
        archetype: "BANK",
        settlementDays: 3,
        reliabilityScore: "1.000000"
      }
    }
  ]
};

export const FALLBACK_PROVIDER_DETAIL: CapitalProviderDetail = {
  id: "prov-kaveri",
  orgId: "org-kaveri",
  name: "Kaveri Capital (NBFC)",
  archetype: "NBFC",
  costOfFunds: "0.105000",
  hurdleRate: "0.130000",
  totalLiquidity: "120000000.00",
  availableLiquidity: "119120000.00",
  minTicket: "200000.00",
  maxTicket: "15000000.00",
  minTenorDays: 15,
  maxTenorDays: 90,
  riskAppetiteFloor: "C",
  concentrationLimitPct: "0.250000",
  settlementDays: 1,
  sectorFocus: ["auto-components", "textiles", "engineering"],
  reliabilityScore: "1.000000",
  bids: [
    {
      id: "bid-k1",
      opportunityId: "opp-seed-001",
      annualRate: "0.122000",
      advanceRate: "0.880000",
      status: "ACTIVE",
      opportunity: {
        id: "opp-seed-001",
        status: "AUCTION_LIVE",
        requestedAmount: "1000000.00"
      }
    }
  ]
};
