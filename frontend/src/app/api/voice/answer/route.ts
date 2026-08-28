// What the CFO assistant answers, and where the answer comes from (#29).
//
// Questions are matched to intents by keyword, and each intent reads live
// database state through the same clearing loader the screen uses. No language
// model is involved, which is the point rather than a limitation: the assistant
// speaks rupee figures aloud, and a spoken figure is a claim exactly like a
// printed one. A model that paraphrases "about nine lakh" over a screen reading
// ₹9,34,188.36 has made the audit trail a liability.
//
// The consequence is honest and worth stating on stage: this answers a fixed
// set of questions well and says so plainly when a question falls outside it,
// rather than improvising something plausible.

import { prisma } from "@/lib/db";
import { clearById } from "@/lib/market/server";
import { offerScript } from "@/lib/voice/script";
import type { ScoredOffer } from "@/lib/market/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rupees(paise: number): string {
  const s = (Math.abs(paise) / 100).toFixed(2);
  const [whole, frac] = s.split(".");
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `${grouped}.${frac}`;
}

const pct = (bps: number) => `${(bps / 100).toFixed(2)} percent`;

type Intent =
  | "winner"
  | "cheapest"
  | "need"
  | "disqualified"
  | "ledger"
  | "portfolio"
  | "help";

/**
 * Route a question to an intent.
 *
 * Order matters: "why was the cheapest rejected" contains both "cheapest" and
 * a rejection cue, and the rejection reading is the more useful answer, so the
 * disqualification test runs first.
 */
function classify(q: string): Intent {
  const t = q.toLowerCase();
  if (/(disqualif|reject|why not|gated|fail)/.test(t)) return "disqualified";
  if (/(cheap|lowest|least|best rate|smallest)/.test(t)) return "cheapest";
  if (/(win|best|recommend|accept|which offer|who won)/.test(t)) return "winner";
  if (/(need|floor|payroll|obligation|deadline|urgen|shortfall)/.test(t)) return "need";
  if (/(ledger|journal|balance|book|posting|entry|audit)/.test(t)) return "ledger";
  if (/(portfolio|exposure|liquidity|capacity|deploy)/.test(t)) return "portfolio";
  return "help";
}

export async function POST(request: Request) {
  let question: string;
  let opportunityId: string | undefined;
  try {
    const body = await request.json();
    question = String(body?.question ?? "").trim();
    opportunityId = body?.opportunityId ? String(body.opportunityId) : undefined;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!question) return Response.json({ error: "bad_request" }, { status: 400 });

  const intent = classify(question);

  try {
    // Pick a subject when the caller did not name one.
    //
    // Deterministic on purpose. "Most bids" picked an arbitrary opportunity
    // once the database grew past the seeded three, so the assistant answered
    // about a different invoice each time the data changed — which is the
    // worst property a demo can have. Prefer the worked example explicitly,
    // then fall back to the oldest live auction that actually has bids.
    if (!opportunityId) {
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
      opportunityId = fallback?.id;
    }

    if (intent === "portfolio") {
      const providers = await prisma.capitalProvider.findMany({
        select: { name: true, availableLiquidity: true, totalLiquidity: true },
      });
      const total = providers.reduce((a, p) => a + Number(p.totalLiquidity), 0);
      const free = providers.reduce((a, p) => a + Number(p.availableLiquidity), 0);
      return Response.json({
        intent,
        answer:
          `Across ${providers.length} capital providers, total committed capital is ` +
          `${rupees(total * 100)} rupees, of which ${rupees(free * 100)} rupees is ` +
          `currently available to deploy.`,
      });
    }

    if (intent === "ledger") {
      const grouped = await prisma.posting.groupBy({
        by: ["direction"],
        _sum: { amount: true },
      });
      const pick = (d: string) => Number(grouped.find((g) => g.direction === d)?._sum.amount ?? 0);
      const debits = pick("DEBIT");
      const credits = pick("CREDIT");
      const entries = await prisma.journalEntry.count();
      return Response.json({
        intent,
        answer:
          `The ledger holds ${entries} journal entries. Total debits are ` +
          `${rupees(debits * 100)} rupees and total credits are ${rupees(credits * 100)} rupees. ` +
          (Math.abs(debits - credits) < 0.005
            ? "The books balance."
            : "The books do not balance, which is a fault and should be investigated."),
      });
    }

    if (!opportunityId) {
      return Response.json({
        intent: "help",
        answer: "There is no live auction to report on at the moment.",
      });
    }

    const result = await clearById(opportunityId);
    if (!result) {
      return Response.json({ intent: "help", answer: "I could not load that opportunity." });
    }

    const offers: ScoredOffer[] = result.scoredOffers;
    const winner = offers.find((o) => o.rank === 1 && !o.disqualified);
    const cheapest = [...offers].sort((a, b) => a.effectiveCostBps - b.effectiveCostBps)[0];
    const rejected = offers.filter((o) => o.disqualified);

    if (intent === "winner") {
      if (!winner) {
        return Response.json({
          intent,
          answer:
            "No offer cleared the supplier's requirements, so the correct outcome is not to finance. " +
            (result.status === "NO_ACCEPTABLE_OFFER" ? result.reason ?? "" : ""),
        });
      }
      return Response.json({ intent, answer: offerScript(winner) });
    }

    if (intent === "cheapest") {
      if (!cheapest) return Response.json({ intent, answer: "There are no offers to compare." });
      const clean = !cheapest.disqualified;
      return Response.json({
        intent,
        answer:
          `The lowest true cost is ${cheapest.providerName} at ${pct(cheapest.effectiveCostBps)}. ` +
          (clean
            ? "It also clears both gates, so it is the recommended offer."
            : `It is disqualified, so it is not the recommended offer. ` +
              (cheapest.gates.sufficiency.passed ? "" : cheapest.gates.sufficiency.reason + ". ") +
              (cheapest.gates.timing.passed ? "" : cheapest.gates.timing.reason + ".")),
      });
    }

    if (intent === "disqualified") {
      if (rejected.length === 0) {
        return Response.json({ intent, answer: "No offers were disqualified on this opportunity." });
      }
      const lines = rejected.map((o) => {
        const why = [
          o.gates.sufficiency.passed ? null : o.gates.sufficiency.reason,
          o.gates.timing.passed ? null : o.gates.timing.reason,
        ].filter(Boolean);
        return `${o.providerName} was disqualified. ${why.join(". ")}.`;
      });
      return Response.json({ intent, answer: lines.join(" ") });
    }

    if (intent === "help") {
      // Say what it can answer rather than guessing. An assistant that
      // improvises past its competence is worse than one with edges you can
      // see, especially when the answers are rupee figures.
      return Response.json({
        intent,
        answer:
          "I can tell you which offer wins and why, which is cheapest, why an offer was " +
          "disqualified, what this supplier needs and by when, whether the ledger balances, " +
          "and total portfolio exposure. Ask me one of those.",
      });
    }

    // "need"
    const u = result.utility;
    return Response.json({
      intent: "need",
      answer: u.unconstrained
        ? "This supplier has no projected shortfall, so cost alone decides which offer is best."
        : `This supplier needs ${rupees(u.sufficiencyFloorPaise)} rupees by ${u.timingDeadline}` +
          (u.drivingObligation ? `, driven by ${u.drivingObligation}` : "") +
          `. That figure was derived from their dated cash obligations, not asked for. ` +
          `Any offer delivering less, or arriving later, is disqualified rather than ranked lower.`,
    });
  } catch (e) {
    return Response.json(
      { error: "answer_failed", message: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
