// Seed data for the Sprint 1 MVP.
//
// The centrepiece is opportunity #1, which reproduces the worked example from
// docs/01-commerce-analysis.md §3 exactly: a ₹10,00,000 invoice over 45 days
// where the 11.0% offer is *worse and dearer* than the 13.5% one. Those two
// bids are seeded with the terms the doc names, and every figure the demo
// shows is computed from them by quoteEconomics() — nothing is typed in.
//
// Four providers, not the two the issue asks for. With two, one offer can
// dominate the other on every axis and the "intelligent matching" result is
// vacuous; docs/01-commerce-analysis.md §6 makes non-domination the validity
// test for the whole market. Four archetypes with genuinely different costs of
// funds and settlement speeds produce a real Pareto frontier for Track 2 to
// work against.

// Loads frontend/.env so `npx tsx prisma/seed.ts` works standalone.
import "dotenv/config";

import { createHash } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ensureAccounts,
  platformAccountSpecs,
  supplierAccountSpecs,
  providerAccountSpecs,
  buyerAccountSpecs,
  PLATFORM,
  providerAccounts,
  supplierAccounts,
  buyerAccounts,
} from "../src/lib/ledger/accounts";
import { postEntry, debit, credit, trialBalance } from "../src/lib/ledger/post";
import {
  postDisbursement,
  postBuyerPayment,
  postReserveRelease,
} from "../src/lib/ledger/flows";
import { quoteEconomics, money } from "../src/lib/money";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SUPPLIER = "vertex-components";
const PLATFORM_SLUG = "lienrho";

/** Anti-double-financing key. Same shape as docs/01-commerce-analysis.md §8.5. */
function fingerprint(sellerTaxId: string, buyerTaxId: string, invoiceNumber: string) {
  return createHash("sha256").update(`${sellerTaxId}|${buyerTaxId}|${invoiceNumber}`).digest("hex");
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

async function main() {
  console.log("Resetting marketplace tables…");
  // Order matters: children before parents.
  await prisma.posting.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.escrowLock.deleteMany();
  await prisma.match.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.financingOpportunity.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.capitalProvider.deleteMany();
  await prisma.account.deleteMany();
  await prisma.organization.deleteMany();

  // ---------------------------------------------------------------- orgs

  const platform = await prisma.organization.create({
    data: { slug: PLATFORM_SLUG, name: "LienRho", type: "PLATFORM", taxId: "29AAAAA0000A1Z5" },
  });

  const supplier = await prisma.organization.create({
    data: {
      slug: SUPPLIER,
      name: "Vertex Components Pvt Ltd",
      type: "SUPPLIER",
      taxId: "29AABCV1234C1Z9",
    },
  });

  // Mandates are deliberately non-dominating: the bank is cheapest but slow and
  // advances least; the fintech is dearest but instant and advances most. No
  // single provider wins on every axis, which is what makes the market real.
  const providerSeeds = [
    {
      slug: "meridian-bank",
      name: "Meridian Bank",
      archetype: "BANK" as const,
      taxId: "27AAACM5678M1Z2",
      costOfFunds: "0.075",
      hurdleRate: "0.090",
      totalLiquidity: "500000000.00",
      minTicket: "500000.00",
      maxTicket: "50000000.00",
      minTenorDays: 30,
      maxTenorDays: 120,
      riskAppetiteFloor: "B",
      concentrationLimitPct: "0.150000",
      settlementDays: 3,
      sectorFocus: [],
    },
    {
      slug: "kaveri-capital",
      name: "Kaveri Capital (NBFC)",
      archetype: "NBFC" as const,
      taxId: "33AABCK9012K1Z7",
      costOfFunds: "0.105",
      hurdleRate: "0.130",
      totalLiquidity: "120000000.00",
      minTicket: "200000.00",
      maxTicket: "15000000.00",
      minTenorDays: 15,
      maxTenorDays: 90,
      riskAppetiteFloor: "C",
      concentrationLimitPct: "0.250000",
      settlementDays: 1,
      sectorFocus: [],
    },
    {
      slug: "rapidfin",
      name: "Rapidfin",
      archetype: "FINTECH" as const,
      taxId: "29AABCR3456R1Z1",
      costOfFunds: "0.130",
      hurdleRate: "0.160",
      totalLiquidity: "30000000.00",
      minTicket: "50000.00",
      maxTicket: "2500000.00",
      minTenorDays: 7,
      maxTenorDays: 60,
      riskAppetiteFloor: "C",
      concentrationLimitPct: "0.400000",
      settlementDays: 0,
      sectorFocus: [],
    },
    {
      slug: "ashwin-credit-fund",
      name: "Ashwin Credit Fund",
      archetype: "CREDIT_FUND" as const,
      taxId: "27AABCA7890A1Z4",
      costOfFunds: "0.110",
      hurdleRate: "0.150",
      totalLiquidity: "250000000.00",
      minTicket: "2000000.00",
      maxTicket: "80000000.00",
      minTenorDays: 30,
      maxTenorDays: 180,
      // Takes weaker credits than anyone else — at a price.
      riskAppetiteFloor: "E",
      concentrationLimitPct: "0.200000",
      settlementDays: 3,
      sectorFocus: ["auto-components", "textiles"],
    },
  ];

  const providers: Record<string, { id: string; orgId: string }> = {};
  for (const p of providerSeeds) {
    const org = await prisma.organization.create({
      data: { slug: p.slug, name: p.name, type: "PROVIDER", taxId: p.taxId },
    });
    const { slug, name, taxId, ...mandate } = p;
    const cp = await prisma.capitalProvider.create({
      data: {
        ...mandate,
        name,
        orgId: org.id,
        availableLiquidity: mandate.totalLiquidity,
      },
    });
    providers[slug] = { id: cp.id, orgId: org.id };
  }

  // ------------------------------------------------------------ buyers

  const buyerSeeds = [
    {
      slug: "bharat-auto",
      name: "Bharat Auto Ltd",
      taxId: "27AAACB1111B1Z6",
      industry: "auto-components",
      averageDelayDays: 4.2,
      relationshipDurationDays: 1460,
    },
    {
      slug: "sundaram-textiles",
      name: "Sundaram Textiles Ltd",
      taxId: "33AAACS2222S1Z3",
      industry: "textiles",
      averageDelayDays: 18.7,
      relationshipDurationDays: 540,
    },
    {
      slug: "orion-retail",
      name: "Orion Retail Pvt Ltd",
      taxId: "29AAACO3333O1Z8",
      industry: "retail",
      averageDelayDays: 31.5,
      relationshipDurationDays: 190,
    },
  ];

  const buyers: Record<string, { id: string; taxId: string }> = {};
  for (const b of buyerSeeds) {
    const c = await prisma.customer.create({ data: { ...b, orgId: supplier.id } });
    buyers[b.slug] = { id: c.id, taxId: b.taxId };
  }

  // ---------------------------------------------------------- invoices

  const invoiceSeeds = [
    {
      // The worked example. Buyer-accepted, so it is priced close to Bharat
      // Auto's credit rather than Vertex's.
      number: "INV-2026-0801",
      buyer: "bharat-auto",
      faceValue: "1000000.00",
      tenorDays: 45,
      tier: "BUYER_ACCEPTED" as const,
      threeWayMatched: true,
      accepted: true,
      riskGrade: "A",
      pd: "0.021000",
      dilution: "0.005000",
    },
    {
      number: "INV-2026-0802",
      buyer: "sundaram-textiles",
      faceValue: "450000.00",
      tenorDays: 60,
      tier: "LEDGER_VERIFIED" as const,
      threeWayMatched: true,
      accepted: false,
      riskGrade: "C",
      pd: "0.084000",
      dilution: "0.022000",
    },
    {
      // Unverified: no purchase order, no delivery evidence, buyer has not
      // acknowledged it. Most mandates decline this outright, and that is the
      // graded tier doing its job.
      number: "INV-2026-0803",
      buyer: "orion-retail",
      faceValue: "2200000.00",
      tenorDays: 30,
      tier: "SUPPLIER_ASSERTED" as const,
      threeWayMatched: false,
      accepted: false,
      riskGrade: "E",
      pd: "0.230000",
      dilution: "0.070000",
    },
  ];

  const opportunities: Record<string, { id: string; buyer: string; faceValue: string; tenorDays: number }> = {};

  for (const inv of invoiceSeeds) {
    const buyer = buyers[inv.buyer];
    const invoice = await prisma.invoice.create({
      data: {
        orgId: supplier.id,
        customerId: buyer.id,
        invoiceNumber: inv.number,
        faceValue: inv.faceValue,
        invoiceDate: daysFromNow(-5),
        dueDate: daysFromNow(inv.tenorDays - 5),
        acceptanceDate: inv.accepted ? daysFromNow(-3) : null,
        verificationTier: inv.tier,
        threeWayMatched: inv.threeWayMatched,
        fingerprint: fingerprint(supplier.taxId!, buyer.taxId, inv.number),
      },
    });

    const opp = await prisma.financingOpportunity.create({
      data: {
        orgId: supplier.id,
        invoiceId: invoice.id,
        requestedAmount: inv.faceValue,
        tenorDays: inv.tenorDays,
        riskGrade: inv.riskGrade,
        probabilityOfDefault: inv.pd,
        expectedDilutionPct: inv.dilution,
        status: inv.tier === "SUPPLIER_ASSERTED" ? "RECEIVED" : "VERIFIED",
      },
    });

    opportunities[inv.number] = {
      id: opp.id,
      buyer: inv.buyer,
      faceValue: inv.faceValue,
      tenorDays: inv.tenorDays,
    };
  }

  // -------------------------------------------------- chart of accounts

  const specs = [
    ...platformAccountSpecs,
    ...supplierAccountSpecs(SUPPLIER, supplier.name, supplier.id),
    ...providerSeeds.flatMap((p) =>
      providerAccountSpecs(p.slug, p.name, providers[p.slug].orgId),
    ),
    ...buyerSeeds.flatMap((b) => buyerAccountSpecs(b.slug, b.name)),
  ];
  await ensureAccounts(prisma, specs);

  // Genesis funding. Opening balances need a counterparty in double entry, and
  // that counterparty is equity — not thin air.
  for (const p of providerSeeds) {
    await postEntry({
      reference: `open:provider:${p.slug}`,
      eventType: "OPENING_BALANCE",
      description: `Opening capital for ${p.name}`,
      postings: [
        debit(providerAccounts(p.slug).cash, p.totalLiquidity),
        credit(PLATFORM.openingBalance, p.totalLiquidity),
      ],
    }, prisma);
  }

  await postEntry({
    reference: "open:supplier:" + SUPPLIER,
    eventType: "OPENING_BALANCE",
    description: `Opening cash for ${supplier.name}`,
    postings: [
      debit(supplierAccounts(SUPPLIER).cash, "850000.00"),
      credit(PLATFORM.openingBalance, "850000.00"),
    ],
  }, prisma);

  // Buyers owe what they owe: a payable against the cash they hold to settle it.
  for (const inv of invoiceSeeds) {
    await postEntry({
      reference: `open:buyer:${inv.buyer}:${inv.number}`,
      eventType: "OPENING_BALANCE",
      description: `${inv.number} payable recognised by buyer`,
      postings: [
        debit(buyerAccounts(inv.buyer).cash, inv.faceValue),
        credit(PLATFORM.openingBalance, inv.faceValue),
        debit(supplierAccounts(SUPPLIER).invoiceReceivable, inv.faceValue),
        credit(buyerAccounts(inv.buyer).payable, inv.faceValue),
      ],
    }, prisma);
  }

  // ------------------------------------------------------------- bids
  //
  // Opportunity #1 goes to auction with the two offers from the worked example
  // plus an intermediate, so the frontier has a middle rather than two corners.

  const opp1 = opportunities["INV-2026-0801"];
  await prisma.financingOpportunity.update({
    where: { id: opp1.id },
    data: {
      status: "AUCTION_LIVE",
      auctionClosesAt: daysFromNow(1),
      // Derived from the cash forecast, not asked for: Vertex needs ₹9,00,000
      // by Friday. Offer A clears neither gate — it delivers ₹7.87L, on day 3.
      sufficiencyFloor: "900000.00",
      timingDeadline: daysFromNow(2),
      urgencyWeight: "0.720000",
    },
  });

  const bidSeeds = [
    // Offer A in the doc: the cheap-looking one that is actually worse.
    {
      provider: "meridian-bank",
      annualRate: "0.110000",
      advanceRate: "0.800000",
      flatFee: "2500.00",
      settlementDays: 3,
      recourse: true,
    },
    // Offer B: dearer on the headline, better on every axis that matters.
    {
      provider: "rapidfin",
      annualRate: "0.135000",
      advanceRate: "0.950000",
      flatFee: "0.00",
      settlementDays: 0,
      recourse: false,
    },
    {
      provider: "kaveri-capital",
      annualRate: "0.122000",
      advanceRate: "0.880000",
      flatFee: "1000.00",
      settlementDays: 1,
      recourse: true,
    },
  ];

  for (const b of bidSeeds) {
    await prisma.bid.create({
      data: {
        opportunityId: opp1.id,
        providerId: providers[b.provider].id,
        annualRate: b.annualRate,
        advanceRate: b.advanceRate,
        flatFee: b.flatFee,
        tenorDays: opp1.tenorDays,
        settlementDays: b.settlementDays,
        recourse: b.recourse,
        repaymentStructure: "BULLET",
        expiresAt: daysFromNow(1),
        status: "ACTIVE",
      },
    });
  }

  // Scoring outputs are left null on purpose. Track 2's deterministic scorer
  // fills them; seeding them here would mean the demo shows numbers nothing
  // computed, which is the one thing this project promises not to do.

  // ----------------------------------------- a fully settled deal (#2)
  //
  // Opportunity #2 is run end to end so the ledger has real Day 0 and Day 90
  // entries for the Stitch visualiser, and so the flows are exercised by the
  // seed rather than only by tests.

  const opp2 = opportunities["INV-2026-0802"];
  const settledTerms = {
    annualRate: "0.128000",
    advanceRate: "0.900000",
    flatFee: "750.00",
    settlementDays: 1,
  };
  const econ2 = quoteEconomics({
    faceValue: opp2.faceValue,
    tenorDays: opp2.tenorDays,
    ...settledTerms,
  });

  const winningBid = await prisma.bid.create({
    data: {
      opportunityId: opp2.id,
      providerId: providers["kaveri-capital"].id,
      ...settledTerms,
      tenorDays: opp2.tenorDays,
      recourse: true,
      repaymentStructure: "BULLET",
      status: "WON",
      netCashToSupplier: econ2.netCash,
      effectiveAnnualCost: econ2.effectiveAnnualCost,
      rank: 1,
    },
  });

  await prisma.match.create({
    data: {
      opportunityId: opp2.id,
      bidId: winningBid.id,
      providerId: providers["kaveri-capital"].id,
      allocatedAmount: opp2.faceValue,
      advanceAmount: econ2.advance,
      discountCharge: econ2.discountCharge,
      feeAmount: econ2.fee,
      netDisbursed: econ2.netCash,
      reserveAmount: econ2.reserve,
      quotedSettlementDays: settledTerms.settlementDays,
      quotedDisbursalDate: daysFromNow(-58),
      // Quoted T+1, delivered T+2. The learning loop should notice.
      actualDisbursalDate: daysFromNow(-57),
      expectedBuyerPayment: daysFromNow(-2),
      actualBuyerPayment: daysFromNow(-1),
      constraintSnapshot: {
        availableLiquidityAtMatch: "120000000.00",
        concentrationHeadroom: "30000000.00",
        riskGradeAccepted: "C",
      },
    },
  });

  const parties = {
    supplierSlug: SUPPLIER,
    providerSlug: "kaveri-capital",
    buyerSlug: opp2.buyer,
  };

  await postDisbursement(
    { opportunityId: opp2.id, faceValue: opp2.faceValue, tenorDays: opp2.tenorDays, ...settledTerms, ...parties },
    prisma,
  );
  await postBuyerPayment(
    { opportunityId: opp2.id, amountPaid: opp2.faceValue, ...parties },
    prisma,
  );
  await postReserveRelease(
    {
      opportunityId: opp2.id,
      amountInEscrow: opp2.faceValue,
      advanceAmount: econ2.advance,
      ...parties,
    },
    prisma,
  );

  await prisma.financingOpportunity.update({
    where: { id: opp2.id },
    data: { status: "CLOSED" },
  });

  // Kaveri's capital came back with the discount earned on top.
  await prisma.capitalProvider.update({
    where: { id: providers["kaveri-capital"].id },
    data: { availableLiquidity: money("120000000.00").plus(econ2.discountCharge) },
  });

  // ------------------------------------------------------------ report

  const tb = await trialBalance(prisma);
  const a = quoteEconomics({
    faceValue: opp1.faceValue,
    tenorDays: 45,
    annualRate: "0.110000",
    advanceRate: "0.800000",
    flatFee: "2500.00",
  });
  const b = quoteEconomics({
    faceValue: opp1.faceValue,
    tenorDays: 45,
    annualRate: "0.135000",
    advanceRate: "0.950000",
    flatFee: "0.00",
  });

  console.log(`
Seed complete.
  organizations   ${await prisma.organization.count()}
  providers       ${await prisma.capitalProvider.count()}
  buyers          ${await prisma.customer.count()}
  invoices        ${await prisma.invoice.count()}
  opportunities   ${await prisma.financingOpportunity.count()}
  bids            ${await prisma.bid.count()}
  accounts        ${await prisma.account.count()}
  journal entries ${await prisma.journalEntry.count()}
  postings        ${await prisma.posting.count()}

Trial balance: debits ${tb.debits.toFixed(2)} / credits ${tb.credits.toFixed(2)} -> ${tb.balanced ? "BALANCED" : "OUT OF BALANCE"}

The worked example (INV-2026-0801, face 10,00,000 over 45 days):
  Offer A  11.0% headline, 80% advance, fee 2500, T+3
           net cash ${a.netCash.toFixed(2)}   effective ${a.effectiveAnnualCost.times(100).toFixed(2)}%
  Offer B  13.5% headline, 95% advance, fee 0,    T+0
           net cash ${b.netCash.toFixed(2)}   effective ${b.effectiveAnnualCost.times(100).toFixed(2)}%
  Offer B delivers ${b.netCash.minus(a.netCash).toFixed(2)} more cash, 3 days sooner, and is effectively cheaper.
`);

  if (!tb.balanced) throw new Error("Ledger does not balance after seeding.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
