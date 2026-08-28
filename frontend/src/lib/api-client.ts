import { 
  Opportunity, 
  CapitalProviderDetail, 
  FALLBACK_OPPORTUNITY, 
  FALLBACK_PROVIDER_DETAIL 
} from "./scoring";
import type { MatchResult, ScoredOffer, Allocation, SupplierUtility } from "./market/types";

export type { ScoredOffer, Allocation, SupplierUtility, MatchResult };

export interface DbHealthResult {
  status: "ok" | "degraded" | "unreachable";
  seeded: boolean;
  ledgerBalanced: boolean;
  counts?: {
    providers: number;
    opportunities: number;
    bids: number;
    journalEntries: number;
  };
  hint?: string;
}

export interface OpportunitiesResponse {
  count: number;
  opportunities: Opportunity[];
  isFallback?: boolean;
}

export interface ProvidersResponse {
  count: number;
  providers: CapitalProviderDetail[];
  isFallback?: boolean;
}

export interface LedgerEntryItem {
  id: string;
  reference: string;
  eventType: string;
  description: string;
  opportunityId?: string | null;
  occurredAt: string;
  metadata?: Record<string, unknown> | null;
  postings: Array<{
    id: string;
    direction: "DEBIT" | "CREDIT";
    amount: string | number;
    currency: string;
    account: {
      code: string;
      name: string;
      type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
    };
  }>;
  totals: {
    debits: string;
    credits: string;
    balanced: boolean;
  };
}

export interface LedgerEntriesResponse {
  count: number;
  entries: LedgerEntryItem[];
  isFallback?: boolean;
}

export interface MatchApiResponse {
  status: "MATCHED" | "NO_ACCEPTABLE_OFFER";
  opportunityId: string;
  allocations?: Allocation[];
  scoredOffers: ScoredOffer[];
  utility: SupplierUtility;
  reason?: string;
  matchId?: string;
  matched?: boolean;
  matchedBidRef?: string | null;
  score?: number;
  notes?: string;
  simulated?: boolean;
  isFallback?: boolean;
}

export const FALLBACK_MATCH_RESULT: MatchApiResponse = {
  status: "MATCHED",
  opportunityId: "opp-seed-001",
  allocations: [
    {
      offerId: "bid-rapidfin",
      providerId: "prov-rapidfin",
      providerName: "Rapidfin",
      fundedPaise: 95000000,
      providerLiquidityAfterPaise: -1,
    }
  ],
  scoredOffers: [
    {
      offer: {
        id: "bid-rapidfin",
        opportunityId: "opp-seed-001",
        providerId: "prov-rapidfin",
        advanceRateBps: 9500,
        annualRateBps: 1350,
        feesPaise: 0,
        tenorDays: 45,
        settlementDays: 0,
        recourse: "NON_RECOURSE",
        expiresAt: "2026-09-30"
      },
      providerName: "Rapidfin",
      advancePaise: 95000000,
      discountChargePaise: 1581164,
      netCashPaise: 93418836,
      effectiveCostBps: 1373,
      arrivalDate: "2026-08-28",
      gates: {
        sufficiency: { passed: true, reason: "delivers ₹9.34L (floor ₹9.00L)" },
        timing: { passed: true, reason: "lands 28 Aug (deadline 30 Aug)" }
      },
      disqualified: false,
      rank: 1,
      dominatedBy: null
    },
    {
      offer: {
        id: "bid-meridian",
        opportunityId: "opp-seed-001",
        providerId: "prov-meridian",
        advanceRateBps: 8000,
        annualRateBps: 1100,
        feesPaise: 250000,
        tenorDays: 45,
        settlementDays: 3,
        recourse: "WITH_RECOURSE",
        expiresAt: "2026-09-30"
      },
      providerName: "Meridian Bank",
      advancePaise: 80000000,
      discountChargePaise: 1084932,
      netCashPaise: 78665068,
      effectiveCostBps: 1376,
      arrivalDate: "2026-09-02",
      gates: {
        sufficiency: { passed: false, reason: "short ₹1.13L" },
        timing: { passed: false, reason: "three days late" }
      },
      disqualified: true,
      rank: null,
      dominatedBy: null
    },
    {
      offer: {
        id: "bid-kaveri",
        opportunityId: "opp-seed-001",
        providerId: "prov-kaveri",
        advanceRateBps: 8800,
        annualRateBps: 1220,
        feesPaise: 100000,
        tenorDays: 45,
        settlementDays: 1,
        recourse: "WITH_RECOURSE",
        expiresAt: "2026-09-30"
      },
      providerName: "Kaveri Capital (NBFC)",
      advancePaise: 88000000,
      discountChargePaise: 1323616,
      netCashPaise: 86576384,
      effectiveCostBps: 1334,
      arrivalDate: "2026-08-31",
      gates: {
        sufficiency: { passed: false, reason: "short ₹0.34L" },
        timing: { passed: false, reason: "one day late" }
      },
      disqualified: true,
      rank: null,
      dominatedBy: null
    }
  ],
  utility: {
    sufficiencyFloorPaise: 90000000,
    timingDeadline: "2026-08-30",
    drivingObligation: "September payroll",
    unconstrained: false
  },
  isFallback: true
};

// ---------------------------------------------------------------- API Calls

export async function checkDbHealth(): Promise<DbHealthResult> {
  try {
    const res = await fetch("/api/db-health", { cache: "no-store" });
    if (!res.ok) {
      return { status: "degraded", seeded: false, ledgerBalanced: false };
    }
    const data = await res.json();
    return data;
  } catch {
    return { status: "unreachable", seeded: false, ledgerBalanced: false };
  }
}

export async function fetchOpportunities(status?: string): Promise<OpportunitiesResponse> {
  try {
    const url = status ? `/api/opportunities?status=${status}` : "/api/opportunities";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch opportunities");
    const data = await res.json();
    if (!data.opportunities || data.opportunities.length === 0) {
      return { count: 1, opportunities: [FALLBACK_OPPORTUNITY], isFallback: true };
    }
    return { count: data.count, opportunities: data.opportunities, isFallback: false };
  } catch {
    return { count: 1, opportunities: [FALLBACK_OPPORTUNITY], isFallback: true };
  }
}

export async function fetchProviders(): Promise<ProvidersResponse> {
  try {
    const res = await fetch("/api/providers", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch providers");
    const data = await res.json();
    if (!data.providers || data.providers.length === 0) {
      return { count: 1, providers: [FALLBACK_PROVIDER_DETAIL], isFallback: true };
    }
    return { count: data.count, providers: data.providers, isFallback: false };
  } catch {
    return { count: 1, providers: [FALLBACK_PROVIDER_DETAIL], isFallback: true };
  }
}

export async function fetchProviderSelf(
  providerId: string,
): Promise<CapitalProviderDetail | null> {
  try {
    const res = await fetch(`/api/providers?self=${providerId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch provider self");
    return await res.json();
  } catch {
    return null;
  }
}

export async function matchOpportunity(
  opportunityId: string,
  urgencyNudgeBps: number = 0,
): Promise<MatchApiResponse> {
  try {
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId, urgencyNudgeBps }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Match endpoint failed: ${res.status}`);
    }
    const data: MatchApiResponse = await res.json();
    return { ...data, isFallback: false };
  } catch (err) {
    console.warn("Falling back to pre-cleared matching engine result due to network/DB condition:", err);
    return {
      ...FALLBACK_MATCH_RESULT,
      opportunityId,
    };
  }
}

export async function fetchLedgerEntries(opts?: {
  opportunityId?: string;
  eventType?: string;
}): Promise<LedgerEntriesResponse> {
  try {
    const params = new URLSearchParams();
    if (opts?.opportunityId) params.append("opportunityId", opts.opportunityId);
    if (opts?.eventType) params.append("eventType", opts.eventType);
    
    const res = await fetch(`/api/ledger/entries?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch ledger entries");
    const data = await res.json();
    return { count: data.count, entries: data.entries || [], isFallback: false };
  } catch {
    return {
      count: 1,
      entries: [
        {
          id: "entry-fallback-01",
          reference: "disb:opp-seed-001",
          eventType: "DISBURSEMENT",
          description: "Day 0 capital disbursal — advance ₹9,50,000 to Vertex Components",
          occurredAt: new Date().toISOString(),
          postings: [
            {
              id: "p1",
              direction: "DEBIT",
              amount: "934188.36",
              currency: "INR",
              account: {
                code: "supplier:vertex-components:cash",
                name: "Vertex Components Pvt Ltd — cash",
                type: "ASSET"
              }
            },
            {
              id: "p2",
              direction: "DEBIT",
              amount: "15811.64",
              currency: "INR",
              account: {
                code: "supplier:vertex-components:financing_expense",
                name: "Vertex Components Pvt Ltd — financing expense",
                type: "EXPENSE"
              }
            },
            {
              id: "p3",
              direction: "CREDIT",
              amount: "950000.00",
              currency: "INR",
              account: {
                code: "provider:rapidfin:cash",
                name: "Rapidfin — cash",
                type: "ASSET"
              }
            }
          ],
          totals: {
            debits: "950000.00",
            credits: "950000.00",
            balanced: true
          }
        }
      ],
      isFallback: true
    };
  }
}
