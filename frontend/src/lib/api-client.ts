import { Opportunity, CapitalProviderDetail } from "./scoring";
import type { MatchResult } from "@/lib/market/types";

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
    return { count: data.count, opportunities: data.opportunities ?? [], isFallback: false };
  } catch {
    // No mock fallback. An empty list with isFallback set lets the UI say the
    // data could not be loaded; substituting invented opportunities would make
    // a broken connection look like a working marketplace, which is a worse
    // failure than an empty screen — especially in a demo.
    return { count: 0, opportunities: [], isFallback: true };
  }
}

export async function fetchProviders(): Promise<ProvidersResponse> {
  try {
    const res = await fetch("/api/providers", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch providers");
    const data = await res.json();
    return { count: data.count, providers: data.providers ?? [], isFallback: false };
  } catch {
    return { count: 0, providers: [], isFallback: true };
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
 * This is the call that was missing. The UI previously fetched raw bids and
 * scored them itself, which meant the screen and the audit trail could disagree
 * — and did, by about 23 basis points on every offer.
 *
 * Returns null on failure rather than a fabricated result: "we could not reach
 * the matching engine" and "here is who should fund you" must never look the
 * same.
 */
export async function matchOpportunity(
  opportunityId: string,
  urgencyNudgeBps = 0,
): Promise<MatchResult | null> {
  try {
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId, urgencyNudgeBps }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as MatchResult;
  } catch {
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
              amount: "934171.23",
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
              amount: "15828.77",
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
