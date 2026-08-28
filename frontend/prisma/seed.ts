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
import { postEntry, debit, credit, trialBalance, accountBalance } from "../src/lib/ledger/post";
import {
  postDisbursement,
  postBuyerPayment,
  postReserveRelease,
} from "../src/lib/ledger/flows";
import { quoteEconomics, money } from "../src/lib/money";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SUPPLIER = "vertex-components";
// A second supplier, in genuine distress. Two suppliers is what makes the
// NO_ACCEPTABLE_OFFER path reachable: one cash position cannot both leave some
// offers clearing the floor and no offers clearing it.
const SUPPLIER2 = "kalinga-precision";
const PLATFORM_SLUG = "lienrho";

const PAISE = 100;
const rupees = (paise: number) => paise / PAISE;

/** Anti-double-financing key. Same shape as docs/01-commerce-analysis.md §8.5. */
function fingerprint(sellerTaxId: string, buyerTaxId: string, invoiceNumber: string) {
  return createHash("sha256").update(`${sellerTaxId}|${buyerTaxId}|${invoiceNumber}`).digest("hex");
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

async function main() {
  // The seed is destructive, and it now points at a database three other
  // people are writing to. Refuse to wipe work that is not ours unless the
  // caller says so explicitly — losing Track 2's scored bids at hour six is a
  // much worse outcome than an extra environment variable.
  // The seed's own settled deal (#2) legitimately carries a ranked bid and a
  // match, so a bare count would refuse every clean re-seed. What actually
  // signals someone else's work is scoring or matching on a *live* auction —
  // the seed leaves every AUCTION_LIVE bid unscored and unmatched.
  const [scoredLiveBids, liveMatches, derivedUtility] = await Promise.all([
    prisma.bid.count({
      where: {
        opportunity: { status: "AUCTION_LIVE" },
        OR: [{ rank: { not: null } }, { utilityScore: { not: null } }],
      },
    }),
    prisma.match.count({ where: { opportunity: { status: "AUCTION_LIVE" } } }),
    prisma.financingOpportunity.count({
      where: { status: "AUCTION_LIVE", sufficiencyFloor: { not: null } },
    }),
  ]);
  const existingWork = scoredLiveBids + liveMatches + derivedUtility;

  if (existingWork > 0 && process.env.SEED_FORCE !== "1") {
    console.error(
      `\nRefusing to seed: the database already holds ${existingWork} scored bid(s) or match(es) ` +
        `that this script would delete.\n\n` +
        `If you genuinely want to reset the shared database, re-run with:\n` +
        `  SEED_FORCE=1 npx tsx prisma/seed.ts\n\n` +
        `If you only wanted your own copy, point DATABASE_URL and DIRECT_URL at a local\n` +
        `Postgres first — see prisma/README.md.\n`,
    );
    process.exit(1);
  }

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
  await prisma.verificationDocument.deleteMany();
  await prisma.user.deleteMany();
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

  const distressed = await prisma.organization.create({
    data: {
      slug: SUPPLIER2,
      name: "Kalinga Precision Works Pvt Ltd",
      type: "SUPPLIER",
      taxId: "21AABCK5566K1Z2",
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
    // Orion is Kalinga's customer; the other two are Vertex's.
    const owner = b.slug === "orion-retail" ? distressed : supplier;
    const c = await prisma.customer.create({ data: { ...b, orgId: owner.id } });
    buyers[b.slug] = { id: c.id, taxId: b.taxId };
  }

  // ---------------------------------------------------------- sign-in allowlist
  //
  // Supabase Auth owns the credential; these rows own the mapping from a
  // verified Google identity to an Organization (#25). `supabaseUserId` stays
  // null until the person first signs in — the callback matches on email, then
  // stamps the Supabase UUID so later sessions match on that instead.
  //
  // An allowlist rather than self-registration: you do not get to self-declare
  // as a bank on a capital marketplace. Replace these with real team addresses
  // before demoing OAuth, or nobody can get in.

  const allowlist: { email: string; displayName: string; org: string; role: "OWNER" | "MEMBER" }[] = [
    // The four of us. Email is globally unique, so one address maps to exactly
    // one org — spread across party types so the team collectively covers
    // supplier, provider and platform views. To demo the other side, change the
    // `org` here and reseed rather than editing the row by hand: a reseed would
    // otherwise wipe the edit.
    { email: "ragav6032022@gmail.com", displayName: "Ragav Hariharan", org: PLATFORM_SLUG, role: "OWNER" },
    { email: "justaweebwithinternet@gmail.com", displayName: "Harsha Sakamuri", org: SUPPLIER, role: "OWNER" },
    { email: "yuvaraj28022005@gmail.com", displayName: "Yuvaraj", org: "meridian-bank", role: "OWNER" },
    { email: "tharoonsays@gmail.com", displayName: "Tharun", org: "rapidfin", role: "OWNER" },

    // Placeholders so every seeded org has an owner. Nobody can sign in as
    // these — no Google account owns an @example address, which is the point.
    { email: "finance@kalingaprecision.example", displayName: "Kalinga Precision — Finance", org: SUPPLIER2, role: "OWNER" },
    { email: "desk@kavericapital.example", displayName: "Kaveri Capital — Desk", org: "kaveri-capital", role: "OWNER" },
    { email: "desk@ashwincredit.example", displayName: "Ashwin Credit Fund — Desk", org: "ashwin-credit-fund", role: "OWNER" },
  ];

  const orgIdBySlug: Record<string, string> = {
    [SUPPLIER]: supplier.id,
    [SUPPLIER2]: distressed.id,
    [PLATFORM_SLUG]: platform.id,
    ...Object.fromEntries(providerSeeds.map((p) => [p.slug, providers[p.slug].orgId])),
  };

  for (const u of allowlist) {
    await prisma.user.create({
      data: {
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        orgId: orgIdBySlug[u.org],
      },
    });
  }

  // ------------------------------------------------- supplier cash positions
  //
  // Raw, dated facts. Nothing here is a pre-computed urgency number: Track 2's
  // deriveSupplierUtility() reads these and produces the sufficiency floor and
  // the timing deadline. Seeding those directly would delete the derivation and
  // leave us re-displaying an input we invented — which is the one step that
  // makes this more than a loan-comparison table (docs/01 §4).

  const vertexCash = await prisma.supplierCashPosition.create({
    data: {
      orgId: supplier.id,
      asOfDate: new Date(),
      // Reconciled against the ledger at the end of this script.
      currentCashPaise: 0,
      cashThresholdPaise: 100_000 * PAISE,
      obligations: {
        create: [
          // Thursday: the steel invoice draws Vertex down to exactly its buffer.
          // Dated a day before payroll rather than alongside it so the order is
          // fixed by date, not by whether a sort happens to be stable.
          {
            label: "Kalyani Steel — billet delivery",
            amountPaise: 46_072_836,
            dueDate: daysFromNow(1),
          },
          // Friday: payroll then leaves them 9,00,000 short of the buffer.
          { label: "September payroll", amountPaise: 900_000 * PAISE, dueDate: daysFromNow(2) },
          // Outside the window: should not drive the floor.
          { label: "GST remittance — Q2", amountPaise: 180_000 * PAISE, dueDate: daysFromNow(12) },
        ],
      },
    },
  });

  // The term loan lands first, and it is the one nothing can cover. Order
  // matters: the derivation stops at the *first* breach, so an unclearable
  // obligation sitting behind a clearable one would never drive the floor.
  const kalingaCash = await prisma.supplierCashPosition.create({
    data: {
      orgId: distressed.id,
      asOfDate: new Date(),
      currentCashPaise: 40_000 * PAISE,
      cashThresholdPaise: 50_000 * PAISE,
      obligations: {
        create: [
          {
            label: "Canara Bank term loan — bullet repayment",
            amountPaise: 2_100_000 * PAISE,
            dueDate: daysFromNow(3),
          },
          { label: "October payroll", amountPaise: 690_000 * PAISE, dueDate: daysFromNow(6) },
        ],
      },
    },
  });

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
    const owner = inv.buyer === "orion-retail" ? distressed : supplier;
    const cashPosition = owner === distressed ? kalingaCash : vertexCash;
    const invoice = await prisma.invoice.create({
      data: {
        orgId: owner.id,
        customerId: buyer.id,
        invoiceNumber: inv.number,
        faceValue: inv.faceValue,
        invoiceDate: daysFromNow(-5),
        dueDate: daysFromNow(inv.tenorDays - 5),
        acceptanceDate: inv.accepted ? daysFromNow(-3) : null,
        verificationTier: inv.tier,
        threeWayMatched: inv.threeWayMatched,
        fingerprint: fingerprint(owner.taxId!, buyer.taxId, inv.number),
      },
    });

    const opp = await prisma.financingOpportunity.create({
      data: {
        orgId: owner.id,
        invoiceId: invoice.id,
        cashPositionId: cashPosition.id,
        requestedAmount: inv.faceValue,
        tenorDays: inv.tenorDays,
        riskGrade: inv.riskGrade,
        probabilityOfDefault: inv.pd,
        expectedDilutionPct: inv.dilution,
        status: "VERIFIED",
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
    ...supplierAccountSpecs(SUPPLIER2, distressed.name, distressed.id),
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

  const VERTEX_OPENING = "120000.00";
  await postEntry({
    reference: "open:supplier:" + SUPPLIER,
    eventType: "OPENING_BALANCE",
    description: `Opening cash for ${supplier.name}`,
    postings: [
      debit(supplierAccounts(SUPPLIER).cash, VERTEX_OPENING),
      credit(PLATFORM.openingBalance, VERTEX_OPENING),
    ],
  }, prisma);

  const KALINGA_OPENING = money(rupees(kalingaCash.currentCashPaise)).toFixed(2);
  await postEntry({
    reference: "open:supplier:" + SUPPLIER2,
    eventType: "OPENING_BALANCE",
    description: `Opening cash for ${distressed.name}`,
    postings: [
      debit(supplierAccounts(SUPPLIER2).cash, KALINGA_OPENING),
      credit(PLATFORM.openingBalance, KALINGA_OPENING),
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
        debit(
          supplierAccounts(inv.buyer === "orion-retail" ? SUPPLIER2 : SUPPLIER).invoiceReceivable,
          inv.faceValue,
        ),
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
    // sufficiencyFloor / timingDeadline / urgencyWeight stay null on purpose.
    // Track 2's deriveSupplierUtility() computes them from vertexCash and
    // writes them back. The facts it reads are the obligations above.
    data: { status: "AUCTION_LIVE", auctionClosesAt: daysFromNow(1) },
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

  // ------------------------------- an opportunity nothing can clear (#3)
  //
  // Kalinga owes 21,00,000 to Canara Bank within three days against a
  // 22,00,000 invoice. Even a 95% advance cannot produce what they need, so
  // the correct answer is NO_ACCEPTABLE_OFFER rather than "here is the least
  // bad option" — a market that always transacts is not exercising judgement.
  //
  // One bid only, and that is the graded tier doing real work: the invoice is
  // SUPPLIER_ASSERTED at risk grade E, and Ashwin is the sole mandate whose
  // risk floor reaches that far down.
  const opp3 = opportunities["INV-2026-0803"];
  const ashwinTerms = { annualRate: "0.155000", advanceRate: "0.850000", flatFee: "5000.00" };
  await prisma.financingOpportunity.update({
    where: { id: opp3.id },
    data: { status: "AUCTION_LIVE", auctionClosesAt: daysFromNow(1) },
  });
  await prisma.bid.create({
    data: {
      opportunityId: opp3.id,
      providerId: providers["ashwin-credit-fund"].id,
      ...ashwinTerms,
      tenorDays: opp3.tenorDays,
      settlementDays: 3,
      recourse: true,
      repaymentStructure: "BULLET",
      expiresAt: daysFromNow(1),
      status: "ACTIVE",
    },
  });

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
    // Capital returned, and the discount is income rather than deployable
    // capital — adding it to availableLiquidity pushed available above total,
    // which made "how much can you deploy" answer with more than the provider
    // owns.
    data: { availableLiquidity: "120000000.00" },
  });

  // ------------------------------------------------------------ report

  // Reconcile the cash position with the ledger rather than stating the number
  // twice. Opportunity #2's settlement moved Vertex's cash, so the position is
  // read back off the account it has to agree with.
  const vertexLedgerCash = await accountBalance(supplierAccounts(SUPPLIER).cash, prisma);
  await prisma.supplierCashPosition.update({
    where: { id: vertexCash.id },
    data: { currentCashPaise: Number(vertexLedgerCash.times(PAISE).toFixed(0)) },
  });

  /**
   * A seed-time sanity check on the scenario — NOT an implementation of the
   * derivation. Track 2's deriveSupplierUtility() is authoritative; this exists
   * only so a seed edit cannot quietly destroy the demo beat, and it is
   * deliberately local and unexported (see issue #11 on not growing a third
   * copy of shared arithmetic).
   *
   * Walk obligations in date order. The first day cash falls below the
   * threshold is the breach; the gap at that point is the floor.
   */
  const firstBreach = async (positionId: string) => {
    const position = await prisma.supplierCashPosition.findUniqueOrThrow({
      where: { id: positionId },
      include: { obligations: { orderBy: { dueDate: "asc" } } },
    });
    // One obligation at a time, stopping at the first breach — the same
    // semantics as deriveSupplierUtility(), so this check and the production
    // derivation cannot report different floors.
    let cash = position.currentCashPaise;
    for (const o of position.obligations) {
      cash -= o.amountPaise;
      if (cash < position.cashThresholdPaise) {
        return {
          floorPaise: position.cashThresholdPaise - cash,
          deadline: o.dueDate.toISOString().slice(0, 10),
          driving: o.label,
        };
      }
    }
    return null;
  };

  const vertexNeed = (await firstBreach(vertexCash.id))!;
  const kalingaNeed = (await firstBreach(kalingaCash.id))!;

  const offers = bidSeeds.map((b) => ({
    name: b.provider,
    settlementDays: b.settlementDays,
    ...quoteEconomics({
      faceValue: opp1.faceValue,
      tenorDays: opp1.tenorDays,
      annualRate: b.annualRate,
      advanceRate: b.advanceRate,
      flatFee: b.flatFee,
    }),
  }));
  const ashwin = quoteEconomics({
    faceValue: opp3.faceValue,
    tenorDays: opp3.tenorDays,
    ...ashwinTerms,
  });

  const clearsFloor = (net: (typeof offers)[number]["netCash"], floorPaise: number) =>
    net.times(PAISE).greaterThanOrEqualTo(floorPaise);
  const deadlineDays = 2;

  const tb = await trialBalance(prisma);

  console.log(`
Seed complete.
  organizations     ${await prisma.organization.count()}
  providers         ${await prisma.capitalProvider.count()}
  buyers            ${await prisma.customer.count()}
  invoices          ${await prisma.invoice.count()}
  opportunities     ${await prisma.financingOpportunity.count()}
  bids              ${await prisma.bid.count()}
  users             ${await prisma.user.count()}
  cash positions    ${await prisma.supplierCashPosition.count()}
  cash obligations  ${await prisma.cashObligation.count()}
  accounts          ${await prisma.account.count()}
  journal entries   ${await prisma.journalEntry.count()}
  postings          ${await prisma.posting.count()}

Trial balance: ${tb.debits.toFixed(2)} / ${tb.credits.toFixed(2)} -> ${tb.balanced ? "BALANCED" : "OUT OF BALANCE"}

Supplier utility is NOT seeded. What deriveSupplierUtility() should produce
from the seeded obligations (checked here, computed there):

  Vertex Components  floor ${rupees(vertexNeed.floorPaise).toFixed(2)} by ${vertexNeed.deadline}
                     driven by ${vertexNeed.driving}
  Kalinga Precision  floor ${rupees(kalingaNeed.floorPaise).toFixed(2)} by ${kalingaNeed.deadline}
                     driven by ${kalingaNeed.driving}

INV-2026-0801 — the worked example, gates discriminating:
${offers
  .map(
    (o) =>
      `  ${o.name.padEnd(20)} net ${o.netCash.toFixed(2).padStart(10)}  T+${o.settlementDays}  eff ${o.effectiveAnnualCost.times(100).toFixed(2)}%  ${
        !clearsFloor(o.netCash, vertexNeed.floorPaise)
          ? "fails sufficiency"
          : o.settlementDays > deadlineDays
            ? "fails timing"
            : "CLEARS both gates"
      }`,
  )
  .join("\n")}

  The 11.0% offer is worse AND dearer: Rapidfin hands over ${offers[1].netCash.minus(offers[0].netCash).toFixed(2)} more, 3 days sooner.

INV-2026-0803 — nothing clears it:
  ashwin-credit-fund   net ${ashwin.netCash.toFixed(2)} against a floor of ${rupees(kalingaNeed.floorPaise).toFixed(2)}  ->  NO_ACCEPTABLE_OFFER
`);

  if (!tb.balanced) throw new Error("Ledger does not balance after seeding.");

  // The demo turns on these three properties. If a seed edit breaks one, fail
  // here rather than on stage.
  const [meridian, rapidfin, kaveri] = offers;
  if (clearsFloor(meridian.netCash, vertexNeed.floorPaise) || clearsFloor(kaveri.netCash, vertexNeed.floorPaise)) {
    throw new Error("Seed broken: the sufficiency gate no longer disqualifies anyone.");
  }
  if (!clearsFloor(rapidfin.netCash, vertexNeed.floorPaise)) {
    throw new Error("Seed broken: no offer clears the floor on the demo opportunity.");
  }
  if (clearsFloor(ashwin.netCash, kalingaNeed.floorPaise)) {
    throw new Error("Seed broken: INV-2026-0803 no longer exercises NO_ACCEPTABLE_OFFER.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
