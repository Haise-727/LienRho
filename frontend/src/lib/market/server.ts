/**
 * Server-side loading for the clearing engine.
 *
 * This module owns **the only** query that feeds `clearOpportunity`. Both the
 * `/api/match` route and the `/market` pages call through here rather than
 * writing their own.
 *
 * That is not tidiness, it is a guard against a specific bug that has already
 * happened once (`9c96ef8`). `FinancingOpportunity.sufficiencyFloor` and
 * `timingDeadline` are **null in the database by design** — the gates are
 * derived from the supplier's cash position at clearing time, so the stored
 * columns stay empty. A caller that forgets to join `cashPosition` therefore
 * gets nulls, `supplierUtilityFromStored` returns `unconstrained`, and clearing
 * silently degrades to cost-only ranking — the exact behaviour this project
 * exists to argue against, with no error raised anywhere.
 *
 * One query, written once, and the join cannot be forgotten.
 */

import { prisma } from '@/lib/db';

import { clearOpportunity } from './clear';
import type { ProviderCapacity } from './allocate';
import { decimalToPaise } from './prisma-adapter';
import { deriveSupplierUtility, supplierUtilityFromStored } from './utility';
import type { Bps, MatchResult } from './types';

/** Today, as the clearing engine's `asOf`. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The join every clearing read needs.
 *
 * Obligations come back in date order because `deriveSupplierUtility` walks
 * them looking for the *first* breach of the cash buffer — the nearest cliff is
 * the deadline the supplier is actually up against. It sorts defensively too,
 * but ordering here keeps the intent visible at the query.
 */
const CLEARING_INCLUDE = {
  invoice: { select: { faceValue: true } },
  cashPosition: { include: { obligations: { orderBy: { dueDate: 'asc' } } } },
} as const;

/**
 * Load one opportunity with everything clearing needs.
 *
 * Exported so the agent-bids path can share the same read. Both paths must
 * derive the gates the same way — see `utilityFor` below for why that is not
 * optional.
 */
export async function loadOpportunity(opportunityId: string) {
  return prisma.financingOpportunity.findUnique({
    where: { id: opportunityId },
    include: CLEARING_INCLUDE,
  });
}

type LoadedOpportunity = NonNullable<Awaited<ReturnType<typeof loadOpportunity>>>;

/**
 * The supplier's gates for a loaded opportunity.
 *
 * Prefers the cash position and falls back to the stored columns. Every caller
 * must go through this rather than reading the columns directly, because the
 * columns are null by design — reading them alone yields `unconstrained`, which
 * means *no gates*, which means cost-only ranking with nothing to signal that
 * the safety check was skipped.
 */
export function utilityFor(opportunity: LoadedOpportunity, asOf: string = today()) {
  if (opportunity.cashPosition) {
    return deriveSupplierUtility(
      {
        currentCashPaise: opportunity.cashPosition.currentCashPaise,
        cashThresholdPaise: opportunity.cashPosition.cashThresholdPaise,
        obligations: opportunity.cashPosition.obligations.map((o) => ({
          label: o.label,
          dueDate: o.dueDate.toISOString().slice(0, 10),
          amountPaise: o.amountPaise,
        })),
      },
      asOf,
    );
  }

  return supplierUtilityFromStored(
    opportunity.sufficiencyFloor === null ? null : decimalToPaise(opportunity.sufficiencyFloor.toString()),
    opportunity.timingDeadline === null ? null : opportunity.timingDeadline.toISOString().slice(0, 10),
    asOf,
  );
}

/** Face value in paise, for a loaded opportunity. */
export function faceValuePaiseFor(opportunity: LoadedOpportunity): number {
  return decimalToPaise(opportunity.invoice.faceValue.toString());
}

/**
 * Load one opportunity and clear it.
 *
 * Returns `null` only when the opportunity does not exist. A cleared result with
 * `status: 'NO_ACCEPTABLE_OFFER'` is a success — callers must branch on
 * `status`, not on falsiness.
 */
export async function clearById(
  opportunityId: string,
  urgencyNudgeBps: Bps = 0,
  asOf: string = today(),
): Promise<MatchResult | null> {
  const opportunity = await loadOpportunity(opportunityId);
  if (!opportunity) return null;

  const bids = await prisma.bid.findMany({
    where: { opportunityId, status: 'ACTIVE' },
    include: { provider: { select: { id: true, name: true } } },
  });

  // Provider capacity, read fresh at clearing time rather than trusted from bid
  // time. A provider's position moves: they may have funded something else, or
  // hit a concentration cap on this buyer, since they quoted.
  //
  // NOTE: this read and the allocation it feeds are not yet wrapped in a
  // transaction, so two opportunities clearing concurrently could both believe
  // they have the same liquidity. That is the atomic-allocation work in
  // 03-system-design.md Module 8 and it belongs here, at the I/O boundary —
  // allocate() itself is pure and cannot fix it.
  const providers = await prisma.capitalProvider.findMany({
    where: { id: { in: bids.map((b) => b.providerId) } },
    select: {
      id: true,
      availableLiquidity: true,
      minTicket: true,
      maxTicket: true,
      concentrationLimitPct: true,
      totalLiquidity: true,
    },
  });

  const capacities: Record<string, ProviderCapacity> = Object.fromEntries(
    providers.map((p) => [
      p.id,
      {
        providerId: p.id,
        availableLiquidityPaise: decimalToPaise(p.availableLiquidity.toString()),
        minTicketPaise: decimalToPaise(p.minTicket.toString()),
        maxTicketPaise: decimalToPaise(p.maxTicket.toString()),
        // Concentration headroom is modelled as a share of the total book. The
        // exposure already taken against this buyer is not tracked yet, so this
        // is the cap rather than the remainder — it will bind correctly for a
        // first deal and is optimistic afterwards. Flagged rather than hidden.
        buyerHeadroomPaise: Math.round(
          decimalToPaise(p.totalLiquidity.toString()) *
            Number(p.concentrationLimitPct),
        ),
      },
    ]),
  );

  return clearOpportunity({
    capacities,
    opportunity: {
      id: opportunity.id,
      invoice: { faceValue: opportunity.invoice.faceValue.toString() },
      sufficiencyFloor: opportunity.sufficiencyFloor?.toString() ?? null,
      timingDeadline: opportunity.timingDeadline,
      // Prefer the cash position: it is what makes the derivation real rather
      // than a value someone wrote into a column.
      cashPosition: opportunity.cashPosition
        ? {
            currentCashPaise: opportunity.cashPosition.currentCashPaise,
            cashThresholdPaise: opportunity.cashPosition.cashThresholdPaise,
            obligations: opportunity.cashPosition.obligations.map((o) => ({
              label: o.label,
              // IsoDate strings, not Date objects — they survive JSON intact
              // and the engine's date maths is string-based throughout.
              dueDate: o.dueDate.toISOString().slice(0, 10),
              amountPaise: o.amountPaise,
            })),
          }
        : null,
    },
    // Decimals stringify exactly; the adapter parses decimal text rather than
    // going through Number(), so nothing is lost crossing this boundary.
    bids: bids.map((b) => ({
      id: b.id,
      opportunityId: b.opportunityId,
      providerId: b.providerId,
      advanceRate: b.advanceRate.toString(),
      annualRate: b.annualRate.toString(),
      flatFee: b.flatFee.toString(),
      tenorDays: b.tenorDays,
      settlementDays: b.settlementDays,
      recourse: b.recourse,
      expiresAt: b.expiresAt,
      provider: b.provider,
    })),
    asOf,
    urgencyNudgeBps,
  });
}

/**
 * Display fields for one opportunity's header.
 *
 * Separate from `loadOpportunity` on purpose. That query is tuned for clearing
 * and selects only what the engine consumes; widening it so a page can print a
 * customer name would mean every clearing read drags display joins with it.
 * Two small reads beat one query serving two masters.
 */
export async function loadOpportunityHeader(opportunityId: string) {
  return prisma.financingOpportunity.findUnique({
    where: { id: opportunityId },
    select: {
      id: true,
      status: true,
      tenorDays: true,
      org: { select: { name: true } },
      invoice: {
        select: {
          invoiceNumber: true,
          faceValue: true,
          verificationTier: true,
          customer: { select: { name: true } },
        },
      },
    },
  });
}

/** One row on the market index. */
export interface OpportunitySummary {
  id: string;
  status: string;
  tenorDays: number;
  faceValue: string;
  invoiceNumber: string;
  verificationTier: string;
  supplierName: string;
  buyerName: string;
  bidCount: number;
}

/**
 * Every opportunity, newest first, with just enough to render an index.
 *
 * Deliberately not returning whole rows: the index does not need the ledger
 * trail or provider mandates, and `CapitalProvider` internals must never reach
 * a page (`01-commerce-analysis.md` §6 — mandates are private).
 */
export async function listOpportunities(): Promise<OpportunitySummary[]> {
  const rows = await prisma.financingOpportunity.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      org: { select: { name: true } },
      invoice: {
        select: {
          faceValue: true,
          invoiceNumber: true,
          verificationTier: true,
          customer: { select: { name: true } },
        },
      },
      _count: { select: { bids: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    tenorDays: r.tenorDays,
    faceValue: r.invoice.faceValue.toString(),
    invoiceNumber: r.invoice.invoiceNumber,
    verificationTier: r.invoice.verificationTier,
    supplierName: r.org.name,
    buyerName: r.invoice.customer.name,
    bidCount: r._count.bids,
  }));
}
