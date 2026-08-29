// Skills: reusable playbooks the orchestrator can run or recommend.
//
// A skill is higher-level than a single tool — it composes the primitive tools
// into a procedure the model can invoke as one step. They are described in the
// system prompt and, where a `run` is provided, can be executed directly by the
// orchestrator's runSkill tool.

import { clearById } from "@/lib/market/server";
import {
  resolveOpportunityId,
  winnerOf,
  cheapestOf,
  offerSummary,
} from "./clearing";
import { rupees, percent } from "./format";
import type { Skill } from "./types";

export const auditAuction: Skill = {
  name: "auditAuction",
  description:
    "Full due-diligence pass on one auction: who wins, who is cheapest, what the supplier needs, and which offers were disqualified and why. Use when the user asks for an audit, review, or 'walk me through this deal'.",
  run: async ({ opportunityId }: { opportunityId?: string }) => {
    const id = await resolveOpportunityId(opportunityId);
    if (!id) return { summary: "There is no live auction to audit right now." };
    const result = await clearById(id);
    if (!result) return { summary: "I could not load that opportunity." };

    const winner = winnerOf(result);
    const cheapest = cheapestOf(result);
    const rejected = result.scoredOffers.filter((o) => o.disqualified);

    const lines: string[] = [];
    lines.push(
      result.status === "NO_ACCEPTABLE_OFFER"
        ? `No acceptable offer: ${result.reason}`
        : winner
          ? `Winner: ${offerSummary(winner)}`
          : "No winner cleared the gates.",
    );
    if (cheapest)
      lines.push(
        `Cheapest true cost: ${cheapest.providerName} at ${(cheapest.effectiveCostBps / 100).toFixed(2)} percent` +
          (cheapest.disqualified ? " (disqualified)." : "."),
      );
    if (!result.utility.unconstrained)
      lines.push(
        `Supplier needs ${rupees(result.utility.sufficiencyFloorPaise)} rupees by ${result.utility.timingDeadline}.`,
      );
    lines.push(
      rejected.length
        ? `Disqualified (${rejected.length}): ${rejected.map((o) => o.providerName).join(", ")}.`
        : "No offers were disqualified.",
    );
    return { summary: lines.join(" "), opportunityId: id };
  },
};

// Composite skill: compare two or more offers head-to-head for a single auction.
export const compareOffers: Skill = {
  name: "compareOffers",
  description:
    "Side-by-side comparison of every offer on one auction: net cash, true cost, settlement, and gate status. Use when the user says 'compare', 'versus', or 'which is better'.",
  run: async ({ opportunityId }: { opportunityId?: string }) => {
    const id = await resolveOpportunityId(opportunityId);
    if (!id) return { summary: "There is no live auction to compare right now." };
    const result = await clearById(id);
    if (!result) return { summary: "I could not load that opportunity." };
    const rows = result.scoredOffers
      .map((o) =>
        [
          `${o.providerName}: net ${rupees(o.netCashPaise)}`,
          `true cost ${percent(o.effectiveCostBps)}`,
          `settles ${o.offer.settlementDays}d`,
          o.disqualified ? `DISQUALIFIED (${o.gates.sufficiency.passed ? "" : "sufficiency"} ${o.gates.timing.passed ? "" : "timing"})` : "clears",
        ].join(", "),
      );
    return { summary: rows.join(" | "), opportunityId: id };
  },
};

// Composite skill: supplier health check — need, cash position, and gating.
export const supplierHealthCheck: Skill = {
  name: "supplierHealthCheck",
  description:
    "Assess a supplier's cash health for one auction: sufficiency floor, timing deadline, obligations, and the disqualification cascade it causes. Use when asked 'is this supplier okay', 'what's their risk', or 'why so few offers clear'.",
  run: async ({ opportunityId }: { opportunityId?: string }) => {
    const id = await resolveOpportunityId(opportunityId);
    if (!id) return { summary: "There is no live auction to assess right now." };
    const result = await clearById(id);
    if (!result) return { summary: "I could not load that opportunity." };
    const u = result.utility;
    if (u.unconstrained) return { summary: "This supplier has no projected shortfall; cost alone decides.", opportunityId: id };
    return {
      summary:
        `Needs ${rupees(u.sufficiencyFloorPaise)} by ${u.timingDeadline}` +
        (u.drivingObligation ? `, driven by ${u.drivingObligation}` : "") +
        `. Offers below that floor or arriving later are disqualified, not ranked.`,
      opportunityId: id,
    };
  },
};

export const skills: Skill[] = [auditAuction, compareOffers, supplierHealthCheck];

/** Look up a registered skill by name (case-insensitive). */
export function findSkill(name: string): Skill | undefined {
  return skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
}

/**
 * Per-tool teaching notes. The orchestrator renders these into the system prompt
 * so the model knows WHEN to call each tool, WHAT args to pass, and which tools
 * to chain — instead of blindly dumping the whole book. Keyed by tool name; only
 * entries present here are emitted.
 */
export const toolTeaching: Record<string, { when: string; args: string; chains?: string }> = {
  getWinningOffer: {
    when: "User asks who wins / best offer / what to accept for a specific auction.",
    args: "opportunityId (optional — omits it to use the demo auction).",
    chains: "Follow with getSupplierNeed to explain WHY it won.",
  },
  getCheapestOffer: {
    when: "User asks which is cheapest / lowest rate / least cost.",
    args: "opportunityId optional.",
    chains: "Pair with getDisqualifiedOffers — cheapest is often disqualified.",
  },
  getSupplierNeed: {
    when: "User asks what the supplier needs / floor / deadline / urgency / shortfall.",
    args: "opportunityId optional.",
  },
  getDisqualifiedOffers: {
    when: "User asks why an offer was rejected / gated / failed / disqualified.",
    args: "opportunityId optional.",
  },
  listOpportunities: {
    when: "User references 'the auction' / 'this deal' / no specific opportunity, OR asks to browse. Always call this FIRST when the subject is ambiguous.",
    args: "limit (default 5) and offset for pagination; query for BM25 text search over invoice/supplier/buyer.",
    chains: "Take the chosen id and pass it to getWinningOffer etc.",
  },
  getCashPosition: {
    when: "User asks about cash on hand, obligations, payroll, buffer, or why the floor is what it is.",
    args: "opportunityId optional.",
  },
  getInvoiceDetail: {
    when: "User asks about the invoice, customer, face value, or verification of a deal.",
    args: "opportunityId optional.",
  },
  getProviderLiquidity: {
    when: "User asks about a provider's capacity, liquidity, reliability, or ticket range.",
    args: "limit/offset for pagination; name filter for a single provider.",
  },
  getPortfolioExposure: {
    when: "User asks about total/aerial exposure, deployable capital, or capacity across the book.",
    args: "limit/offset for pagination.",
  },
  getActionQueue: {
    when: "User asks the pending queue, what needs approval, or upcoming decisions.",
    args: "limit/offset for pagination.",
  },
  getVerificationStatus: {
    when: "User asks about verification, KYB, or how trusted an invoice is.",
    args: "opportunityId optional (omit for book-wide distribution).",
  },
  getLedgerBalance: {
    when: "User asks whether the ledger balances, or about postings / books / audit.",
    args: "none.",
  },
  executeDecision: {
    when: "ONLY when the user has explicitly asked to approve or reject AND you will pass confirmed: true. Never speculative.",
    args: "invoiceId, decision ('approve'|'reject'), confirmed: true.",
  },
};

/** Render the per-tool teaching notes into a system-prompt section. */
export function renderToolTeaching(toolNames: string[]): string {
  const lines = toolNames
    .map((name) => {
      const t = toolTeaching[name];
      if (!t) return null;
      return [
        `- ${name}`,
        `    WHEN: ${t.when}`,
        `    ARGS: ${t.args}`,
        t.chains ? `    CHAINS: ${t.chains}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean);
  return lines.length ? lines.join("\n") : "(none)";
}
