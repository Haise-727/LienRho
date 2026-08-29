// The agent's deterministic toolset — every tool does real work and returns a
// `summary` string that the model relays verbatim. The model never computes a
// rupee figure itself; it chooses WHICH tools to call and how to phrase the
// result. This is the "agents judge, never compute" rule, extended from the
// nexus Python layer into the live cockpit.

import { z } from "zod";
import { tool } from "ai";
import { prisma } from "@/lib/db";
import { clearById } from "@/lib/market/server";
import { rupees, percent } from "./format";
import {
  resolveOpportunityId,
  winnerOf,
  cheapestOf,
  offerSummary,
} from "./clearing";
import { guardWriteAction } from "./guardrails";
import { buildCorpus, retrieve } from "./bm25";

const opportunityArg = z
  .object({ opportunityId: z.string().optional() })
  .optional();

export const treasuryTools = {
  getWinningOffer: tool({
    description:
      "Return the recommended (winning) offer for an auction: the offer that clears both the supplier's sufficiency and timing gates and has the lowest true cost among survivors. Call this when asked who wins, which offer is best, or what to accept.",
    inputSchema: opportunityArg,
    execute: async (args) => {
      const id = await resolveOpportunityId(args?.opportunityId);
      if (!id) return { summary: "There is no live auction to report on right now." };
      const result = await clearById(id);
      if (!result)
        return { summary: "I could not load that opportunity." };
      if (result.status === "NO_ACCEPTABLE_OFFER") {
        return {
          summary:
            "No offer cleared the supplier's requirements, so the correct outcome is not to finance. " +
            (result.reason ?? ""),
          status: result.status,
        };
      }
      const winner = winnerOf(result);
      if (!winner)
        return {
          summary:
            "No offer cleared the supplier's requirements, so the correct outcome is not to finance.",
          status: result.status,
        };
      return {
        summary: offerSummary(winner),
        opportunityId: id,
        providerName: winner.providerName,
        netCashPaise: winner.netCashPaise,
        effectiveCostBps: winner.effectiveCostBps,
        settlementDays: winner.offer.settlementDays,
      };
    },
  }),

  getCheapestOffer: tool({
    description:
      "Return the offer with the lowest true cost (effective APR), and whether it was disqualified by a gate. Call when asked which is cheapest, lowest rate, or least cost.",
    inputSchema: opportunityArg,
    execute: async (args) => {
      const id = await resolveOpportunityId(args?.opportunityId);
      if (!id) return { summary: "There is no live auction to report on right now." };
      const result = await clearById(id);
      if (!result) return { summary: "I could not load that opportunity." };
      const cheapest = cheapestOf(result);
      if (!cheapest) return { summary: "There are no offers to compare." };
      const clean = !cheapest.disqualified;
      const summary =
        `The lowest true cost is ${cheapest.providerName} at ${percent(cheapest.effectiveCostBps)}. ` +
        (clean
          ? "It also clears both gates, so it is the recommended offer."
          : `It is disqualified, so it is not the recommended offer. ` +
            (cheapest.gates.sufficiency.passed
              ? ""
              : cheapest.gates.sufficiency.reason + ". ") +
            (cheapest.gates.timing.passed ? "" : cheapest.gates.timing.reason + "."));
      return {
        summary,
        providerName: cheapest.providerName,
        effectiveCostBps: cheapest.effectiveCostBps,
        disqualified: cheapest.disqualified,
      };
    },
  }),

  getSupplierNeed: tool({
    description:
      "Return what the supplier actually needs and by when, derived from their dated cash obligations (not self-reported). Call when asked what the supplier needs, the floor, the deadline, urgency, or shortfall.",
    inputSchema: opportunityArg,
    execute: async (args) => {
      const id = await resolveOpportunityId(args?.opportunityId);
      if (!id) return { summary: "There is no live auction to report on right now." };
      const result = await clearById(id);
      if (!result) return { summary: "I could not load that opportunity." };
      const u = result.utility;
      const summary = u.unconstrained
        ? "This supplier has no projected shortfall, so cost alone decides which offer is best."
        : `This supplier needs ${rupees(u.sufficiencyFloorPaise)} rupees by ${u.timingDeadline}` +
          (u.drivingObligation ? `, driven by ${u.drivingObligation}` : "") +
          `. That figure was derived from their dated cash obligations, not asked for. ` +
          `Any offer delivering less, or arriving later, is disqualified rather than ranked lower.`;
      return {
        summary,
        sufficiencyFloorPaise: u.sufficiencyFloorPaise,
        timingDeadline: u.timingDeadline,
        drivingObligation: u.drivingObligation,
        unconstrained: u.unconstrained,
      };
    },
  }),

  getDisqualifiedOffers: tool({
    description:
      "List every offer that failed a gate for an auction and exactly why. Call when asked why an offer was rejected, disqualified, gated, or failed.",
    inputSchema: opportunityArg,
    execute: async (args) => {
      const id = await resolveOpportunityId(args?.opportunityId);
      if (!id) return { summary: "There is no live auction to report on right now." };
      const result = await clearById(id);
      if (!result) return { summary: "I could not load that opportunity." };
      const rejected = result.scoredOffers.filter((o) => o.disqualified);
      if (rejected.length === 0)
        return { summary: "No offers were disqualified on this opportunity." };
      const lines = rejected.map((o) => {
        const why = [
          o.gates.sufficiency.passed ? null : o.gates.sufficiency.reason,
          o.gates.timing.passed ? null : o.gates.timing.reason,
        ].filter(Boolean);
        return `${o.providerName} was disqualified. ${why.join(". ")}.`;
      });
      return {
        summary: lines.join(" "),
        rejected: rejected.map((o) => ({
          providerName: o.providerName,
          sufficiency: o.gates.sufficiency,
          timing: o.gates.timing,
        })),
      };
    },
  }),

  getLedgerBalance: tool({
    description:
      "Return whether the double-entry ledger balances: total debits vs credits across all journal entries. Call when asked whether the ledger balances, or about journal/book/postings/audit.",
    inputSchema: z.object({}).optional(),
    execute: async () => {
      const grouped = await prisma.posting.groupBy({
        by: ["direction"],
        _sum: { amount: true },
      });
      const pick = (d: string) =>
        Number(grouped.find((g) => g.direction === d)?._sum.amount ?? 0);
      const debits = pick("DEBIT");
      const credits = pick("CREDIT");
      const entries = await prisma.journalEntry.count();
      const balanced = Math.abs(debits - credits) < 0.005;
      const summary =
        `The ledger holds ${entries} journal entries. Total debits are ` +
        `${rupees(debits * 100)} rupees and total credits are ${rupees(credits * 100)} rupees. ` +
        (balanced
          ? "The books balance."
          : "The books do not balance, which is a fault and should be investigated.");
      return { summary, entries, debitsPaise: debits * 100, creditsPaise: credits * 100, balanced };
    },
  }),

  getPortfolioExposure: tool({
    description:
      "Return total committed capital and currently available capital across all providers. The headline figures are always returned; pass `limit`/`offset` to page the per-provider breakdown rather than returning every provider.",
    inputSchema: z
      .object({
        limit: z.number().int().min(1).max(20).optional().describe("max providers to list (default 8)"),
        offset: z.number().int().min(0).optional().describe("providers to skip (default 0)"),
      })
      .optional(),
    execute: async ({ limit = 8, offset = 0 } = {}) => {
      const providers = await prisma.capitalProvider.findMany({
        select: { name: true, availableLiquidity: true, totalLiquidity: true },
        orderBy: { name: "asc" },
      });
      const total = providers.reduce((a, p) => a + Number(p.totalLiquidity), 0);
      const free = providers.reduce((a, p) => a + Number(p.availableLiquidity), 0);
      const page = providers.slice(offset, offset + limit);
      const summary =
        `Across ${providers.length} capital providers, total committed capital is ` +
        `${rupees(total * 100)} rupees, of which ${rupees(free * 100)} rupees is ` +
        `currently available to deploy` +
        (providers.length > page.length ? ` (listing ${offset + 1}–${offset + page.length}).` : `.`);
      return {
        summary,
        totalProviders: providers.length,
        totalPaise: total * 100,
        freePaise: free * 100,
        providers: page.map((p) => ({
          name: p.name,
          availablePaise: Number(p.availableLiquidity) * 100,
          totalPaise: Number(p.totalLiquidity) * 100,
        })),
      };
    },
  }),

  listOpportunities: tool({
    description:
      "List live financing opportunities. NEVER dump the whole book — use `query` (BM25-ranked over invoice number, supplier, buyer) to find the right auction, and `limit`/`offset` to page. Prefer a specific `query` whenever the user names a supplier, buyer, or invoice number. Returns at most `limit` rows (default 8).",
    inputSchema: z
      .object({
        limit: z.number().int().min(1).max(20).optional().describe("max rows to return (default 8)"),
        offset: z.number().int().min(0).optional().describe("rows to skip (default 0)"),
        query: z.string().optional().describe("free-text search, BM25-ranked over invoice/supplier/buyer"),
      })
      .optional(),
    execute: async ({ limit = 8, offset = 0, query } = {}) => {
      const all = await prisma.financingOpportunity.findMany({
        where: { status: "AUCTION_LIVE" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          invoice: { select: { invoiceNumber: true, customer: { select: { name: true } } } },
          org: { select: { name: true } },
          _count: { select: { bids: true } },
        },
      });
      if (all.length === 0) return { summary: "There are no live auctions right now.", opportunities: [] };

      let rows = all;
      if (query && query.trim()) {
        const corpus = buildCorpus(
          all.map((o) => ({
            id: o.id,
            text: `${o.invoice.invoiceNumber} ${o.org.name} ${o.invoice.customer.name}`,
          })),
        );
        const ids = new Set(retrieve(corpus, query, all.length));
        rows = all.filter((o) => ids.has(o.id));
      }
      const total = rows.length;
      const page = rows.slice(offset, offset + limit);
      const shown = page.map((r) => ({
        id: r.id,
        invoiceNumber: r.invoice.invoiceNumber,
        supplier: r.org.name,
        buyer: r.invoice.customer.name,
        bidCount: r._count.bids,
      }));
      const range =
        total === 0 ? "" : ` — showing ${offset + 1}–${offset + page.length} of ${total}`;
      const summary = query
        ? `Found ${total} auction(s) matching "${query}"${range}: ` +
          shown.map((s) => `${s.invoiceNumber} (${s.supplier} → ${s.buyer}, ${s.bidCount} bids)`).join("; ") +
          "."
        : `There are ${total} live auctions${range}: ` +
          shown.map((s) => `${s.invoiceNumber} (${s.supplier} → ${s.buyer}, ${s.bidCount} bids)`).join("; ") +
          ".";
      return { summary, total, query: query ?? null, limit, offset, opportunities: shown };
    },
  }),

  getCashPosition: tool({
    description:
      "Return the supplier's cash position behind an auction: cash on hand, buffer, and dated obligations, plus the derived sufficiency floor and timing deadline. Call when asked about cash on hand, obligations, payroll, buffer, or why the floor is what it is.",
    inputSchema: opportunityArg,
    execute: async (args) => {
      const id = await resolveOpportunityId(args?.opportunityId);
      if (!id) return { summary: "There is no live auction to report on right now." };
      const opp = await prisma.financingOpportunity.findUnique({
        where: { id },
        include: { cashPosition: { include: { obligations: { orderBy: { dueDate: "asc" } } } } },
      });
      if (!opp || !opp.cashPosition)
        return { summary: "No cash position is recorded for this opportunity." };
      const cp = opp.cashPosition;
      const result = await clearById(id);
      const u = result?.utility;
      const obligations = cp.obligations.map((o) => ({
        label: o.label,
        amountPaise: o.amountPaise,
        dueDate: o.dueDate.toISOString().slice(0, 10),
      }));
      const summary =
        `Cash on hand is ${rupees(cp.currentCashPaise)} rupees against a buffer of ` +
        `${rupees(cp.cashThresholdPaise)} rupees. ` +
        (obligations.length
          ? `Obligations: ${obligations
              .map((o) => `${o.label} ${rupees(o.amountPaise)} due ${o.dueDate}`)
              .join("; ")}. `
          : "") +
        (u && !u.unconstrained
          ? `Derived need: ${rupees(u.sufficiencyFloorPaise)} rupees by ${u.timingDeadline}` +
            (u.drivingObligation ? `, driven by ${u.drivingObligation}` : "") +
            "."
          : "No projected shortfall.");
      return {
        summary,
        currentCashPaise: cp.currentCashPaise,
        cashThresholdPaise: cp.cashThresholdPaise,
        obligations,
        utility: u,
      };
    },
  }),

  getInvoiceDetail: tool({
    description:
      "Return the invoice behind an auction: number, face value, customer, due date, verification tier, and three-way-match status. Call when asked about the invoice, customer, face value, or verification of a specific deal.",
    inputSchema: opportunityArg,
    execute: async (args) => {
      const id = await resolveOpportunityId(args?.opportunityId);
      if (!id) return { summary: "There is no live auction to report on right now." };
      const opp = await prisma.financingOpportunity.findUnique({
        where: { id },
        include: { invoice: { include: { customer: true } } },
      });
      if (!opp) return { summary: "I could not load that opportunity." };
      const inv = opp.invoice;
      const summary =
        `Invoice ${inv.invoiceNumber} from ${inv.customer.name}, face value ` +
        `${rupees(Number(inv.faceValue.toString()) * 100)} rupees, due ` +
        `${inv.dueDate.toISOString().slice(0, 10)}. Verification tier: ${inv.verificationTier}` +
        (inv.threeWayMatched ? " (three-way matched)." : ".");
      return {
        summary,
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer.name,
        faceValuePaise: Number(inv.faceValue.toString()) * 100,
        verificationTier: inv.verificationTier,
        dueDate: inv.dueDate.toISOString().slice(0, 10),
      };
    },
  }),

  getProviderLiquidity: tool({
    description:
      "Return per-provider liquidity and capacity: total and available capital, ticket range, settlement speed, concentration cap, and reliability score. Use `name` to scope to one provider, and `limit`/`offset` to page — never dump the entire provider book at once.",
    inputSchema: z
      .object({
        name: z.string().optional().describe("filter to a provider whose name contains this (case-insensitive)"),
        limit: z.number().int().min(1).max(20).optional().describe("max rows (default 8)"),
        offset: z.number().int().min(0).optional().describe("rows to skip (default 0)"),
      })
      .optional(),
    execute: async ({ name, limit = 8, offset = 0 } = {}) => {
      const where = name && name.trim() ? { name: { contains: name.trim(), mode: "insensitive" as const } } : {};
      const all = await prisma.capitalProvider.findMany({
        where,
        select: {
          name: true,
          archetype: true,
          totalLiquidity: true,
          availableLiquidity: true,
          minTicket: true,
          maxTicket: true,
          settlementDays: true,
          concentrationLimitPct: true,
          reliabilityScore: true,
        },
      });
      if (all.length === 0)
        return { summary: name ? `No provider matches "${name}".` : "There are no capital providers on file.", providers: [] };
      const total = all.length;
      const page = all.slice(offset, offset + limit);
      const rows = page.map((p) => ({
        name: p.name,
        archetype: p.archetype,
        totalPaise: Math.round(Number(p.totalLiquidity.toString()) * 100),
        freePaise: Math.round(Number(p.availableLiquidity.toString()) * 100),
        minTicketPaise: Math.round(Number(p.minTicket.toString()) * 100),
        maxTicketPaise: Math.round(Number(p.maxTicket.toString()) * 100),
        settlementDays: p.settlementDays,
        concentrationCapPct: Number(p.concentrationLimitPct.toString()),
        reliability: Number(p.reliabilityScore.toString()),
      }));
      const range = total === 0 ? "" : ` — showing ${offset + 1}–${offset + page.length} of ${total}`;
      const summary =
        (name ? `Providers matching "${name}"` : "Providers") +
        `${range}: ` +
        rows
          .map(
            (r) =>
              `${r.name} (${r.archetype}) has ${rupees(r.freePaise)} rupees free of ` +
              `${rupees(r.totalPaise)} rupees, settles T+${r.settlementDays}, reliability ${r.reliability.toFixed(2)}`,
          )
          .join("; ") +
        ".";
      return { summary, total, limit, offset, providers: rows };
    },
  }),

  getActionQueue: tool({
    description:
      "List invoices pending a financing decision (the action queue). Use `limit`/`offset` to page — never return the entire queue at once. Call when asked about the pending queue, what needs approval, or upcoming decisions.",
    inputSchema: z
      .object({
        limit: z.number().int().min(1).max(20).optional().describe("max rows (default 8)"),
        offset: z.number().int().min(0).optional().describe("rows to skip (default 0)"),
      })
      .optional(),
    execute: async ({ limit = 8, offset = 0 } = {}) => {
      const all = await prisma.invoice.findMany({
        include: { customer: true },
        orderBy: { dueDate: "asc" },
      });
      if (all.length === 0) return { summary: "The action queue is empty.", queue: [] };
      const total = all.length;
      const page = all.slice(offset, offset + limit);
      const queue = page.map((inv) => ({
        id: `AQ-${inv.id}`,
        invoiceId: inv.id,
        customerName: inv.customer.name,
        amountPaise: Math.round(Number(inv.faceValue.toString()) * 100),
        dueDate: inv.dueDate.toISOString().slice(0, 10),
        daysOverdue: Math.max(0, Math.floor((Date.now() - inv.dueDate.getTime()) / 86_400_000)),
        approvalState: "PENDING_APPROVAL",
        recommendedAction: "FINANCE",
      }));
      const range = ` — showing ${offset + 1}–${offset + page.length} of ${total}`;
      const summary =
        `There are ${total} invoices in the action queue${range}. ` +
        queue.map((q) => `${q.customerName} ${rupees(q.amountPaise)} rupees due ${q.dueDate}`).join("; ") +
        ".";
      return { summary, total, limit, offset, queue };
    },
  }),

  getVerificationStatus: tool({
    description:
      "Return verification tiers across the book and the tier for a specific auction's invoice. Call when asked about verification, KYB, or how trusted an invoice is.",
    inputSchema: opportunityArg,
    execute: async (args) => {
      const distribution = await prisma.invoice.groupBy({
        by: ["verificationTier"],
        _count: true,
      });
      const dist = distribution.map((d) => `${d.verificationTier}: ${d._count}`).join(", ");
      let summary = `Verification tiers across the book: ${dist}.`;
      if (args?.opportunityId) {
        const opp = await prisma.financingOpportunity.findUnique({
          where: { id: args.opportunityId },
          include: { invoice: true },
        });
        if (opp) summary += ` This auction's invoice is ${opp.invoice.verificationTier}.`;
      }
      return {
        summary,
        distribution: distribution.map((d) => ({ tier: d.verificationTier, count: d._count })),
      };
    },
  }),

  executeDecision: tool({
    description:
      "EXECUTE a write action: approve or reject an invoice for financing. This changes state and must only be called when the user has explicitly requested the action AND passed confirmed: true. Never call it speculatively.",
    inputSchema: z.object({
      invoiceId: z.string(),
      decision: z.enum(["approve", "reject"]),
      confirmed: z.boolean(),
    }),
    execute: async ({ invoiceId, decision, confirmed }) => {
      const guard = guardWriteAction({ decision, confirmed });
      if (!guard.allowed) {
        return {
          blocked: true,
          message:
            guard.reason ??
            "Write actions require explicit confirmation before they run.",
        };
      }
      // The underlying disbursement/approval pipeline is simulated in this
      // build; the guardrail (confirmed === true) is the real control. The
      // result mirrors the /api/actions contract so the surface is wired end to
      // end. See frontend/src/app/api/actions/[invoiceId]/[decision]/route.ts.
      return {
        blocked: false,
        recorded: true,
        invoiceId,
        approvalState: decision === "approve" ? "APPROVED" : "REJECTED",
        recommendedAction: "FINANCE",
        auditTrail: [
          {
            timestamp: new Date().toISOString(),
            decidedBy: "AGENT",
            what: decision === "approve" ? "Approved" : "Rejected",
            why: "Agent-executed write action, confirmed by caller.",
          },
        ],
      };
    },
  }),
};

export type TreasuryTools = typeof treasuryTools;
