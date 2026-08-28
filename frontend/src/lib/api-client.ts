import { 
  Opportunity, 
  CapitalProviderDetail, 
  FALLBACK_OPPORTUNITY, 
  FALLBACK_PROVIDER_DETAIL 
} from "./scoring";
import type { MatchResult, ScoredOffer, Allocation, SupplierUtility } from "./market/types";

export type { Opportunity, CapitalProviderDetail, ScoredOffer, Allocation, SupplierUtility, MatchResult };
export { FALLBACK_OPPORTUNITY, FALLBACK_PROVIDER_DETAIL };


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

/**
 * Clear one opportunity through the matching engine.
 *
 * Returns null when the engine cannot be reached. It previously returned
 * FALLBACK_MATCH_RESULT — a complete, plausible clearing decision with a winning
 * provider, a net cash figure and gate explanations, none of which any engine
 * produced (#41).
 *
 * That is different in kind from a mock opportunity. A mock opportunity invents
 * input data; this invented the *decision*. The failure mode is that a dropped
 * database connection mid-demo still resolves the auction and still looks
 * right — nobody in the room can tell, so we keep presenting a result that was
 * never computed. A visible failure is strictly better than an invisible one.
 */
export async function matchOpportunity(
  opportunityId: string,
  urgencyNudgeBps: number = 0,
): Promise<MatchApiResponse | null> {
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
    console.error(`Could not clear ${opportunityId}:`, err);
    return null;
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
