/**
 * Seed a curated slice of the corpus into Postgres so it can be browsed in the UI.
 *
 * ADDITIVE and opt-in. It does not wipe anything — the team's demo data stays
 * exactly where it is, and everything written here carries the `corpus-` id
 * prefix so it can be removed again with one delete.
 *
 * Curated rather than bulk-loaded: 280 rows is the right size for a statistical
 * claim and the wrong size for a person clicking through a screen. This selects
 * a spread that shows the engine actually deciding — deals that clear
 * comfortably, deals where the cheapest offer is disqualified, deals nobody can
 * fund — because a list of forty near-identical matched deals demonstrates
 * nothing.
 *
 * Run:  npx tsx scripts/seed-corpus.ts [--count 48] [--wipe]
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

// Prisma 7 requires an explicit driver adapter. Reading .env directly rather
// than importing lib/db.ts keeps this script runnable from the repo root
// without depending on Next's path aliases.
// Resolved against this file, so the script works from any cwd.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
config({ path: resolve(REPO, 'frontend/.env') });

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Set DIRECT_URL or DATABASE_URL (frontend/.env) before seeding.');
  process.exit(1);
}
// DIRECT_URL by preference: this writes several hundred rows, and the pooled
// connection is tuned for short request-scoped queries rather than a bulk load.
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const PREFIX = 'corpus-';
const AS_OF = new Date('2026-08-29T00:00:00Z');

interface CanonicalInvoice {
  invoice_id: string;
  customer_id: string;
  invoice_amount: string;
  invoice_date: string;
  due_date: string;
  payment_status: string;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUPPLIERS = [
  'Vertex Components', 'Kalinga Precision Works', 'Sundar Engineering',
  'Deccan Polymers', 'Anand Tooling', 'Nashik Fabricators', 'Coimbatore Castings',
  'Meenakshi Textiles', 'Godavari Chemicals', 'Sarvodaya Electricals',
  'Pragati Metalworks', 'Konark Instruments',
];

/**
 * Obligation labels a person recognises.
 *
 * These reach the screen verbatim in gate explanations — "delivers only ₹7.86L
 * of the ₹9.00L needed for **August payroll**" — so they have to read like real
 * commitments a business has, not like test fixtures. `obligation_1` would make
 * the most important sentence in the product look synthetic even though the
 * arithmetic behind it is exact.
 */
const OBLIGATIONS = [
  { label: 'Monthly payroll', weight: 0.55, window: [2, 9] },
  { label: 'GST remittance', weight: 0.18, window: [5, 18] },
  { label: 'Raw material payment', weight: 0.3, window: [3, 12] },
  { label: 'Quarterly advance tax', weight: 0.22, window: [8, 25] },
  { label: 'Machinery loan EMI', weight: 0.12, window: [1, 14] },
  { label: 'Warehouse rent', weight: 0.08, window: [4, 15] },
];

const PROVIDERS = [
  { slug: 'meridian-bank', name: 'Meridian Bank', archetype: 'BANK', cof: '0.070000', hurdle: '0.096000', adv: 0.8, rate: 0.096, fee: 2500, settle: 3, min: 300_000, max: 6_500_000, liq: 42_000_000 },
  { slug: 'kaveri-capital', name: 'Kaveri Capital (NBFC)', archetype: 'NBFC', cof: '0.088000', hurdle: '0.128000', adv: 0.87, rate: 0.128, fee: 1200, settle: 1, min: 100_000, max: 3_500_000, liq: 18_000_000 },
  { slug: 'rapidfin', name: 'Rapidfin', archetype: 'FINTECH', cof: '0.103000', hurdle: '0.179000', adv: 0.95, rate: 0.179, fee: 0, settle: 0, min: 40_000, max: 2_000_000, liq: 9_500_000 },
  { slug: 'ashwin-credit', name: 'Ashwin Credit Fund', archetype: 'CREDIT_FUND', cof: '0.095000', hurdle: '0.151000', adv: 0.9, rate: 0.151, fee: 4000, settle: 3, min: 1_000_000, max: 9_000_000, liq: 60_000_000 },
];

const money = (r: number) => r.toFixed(2);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

async function wipe() {
  // Ordered by dependency. Cascades would handle most of this, but being
  // explicit means a partial failure is obvious rather than mysterious.
  await prisma.bid.deleteMany({ where: { opportunityId: { startsWith: PREFIX } } });
  await prisma.financingOpportunity.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.cashObligation.deleteMany({ where: { cashPositionId: { startsWith: PREFIX } } });
  await prisma.supplierCashPosition.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.invoice.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.customer.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.organization.deleteMany({ where: { id: { startsWith: PREFIX } } });
  console.log('removed previous corpus rows');
}

async function main() {
  const args = process.argv.slice(2);
  const count = Number(args[args.indexOf('--count') + 1]) || 48;
  if (args.includes('--wipe')) await wipe();

  const raw = JSON.parse(readFileSync(resolve(REPO, 'data/corpus/canonical.json'), 'utf8')) as {
    invoices: CanonicalInvoice[];
  };
  const random = rng(20260829);

  // Only outstanding invoices are financeable; a settled one has nothing left
  // to advance against. Sorted by amount so the selection spans small tickets
  // (where the flat fee bites) through large (where it is noise).
  const open = raw.invoices
    .filter((i) => i.payment_status !== 'PAID')
    .sort((a, b) => Number(a.invoice_amount) - Number(b.invoice_amount));

  const step = Math.max(1, Math.floor(open.length / count));
  const chosen = open.filter((_, i) => i % step === 0).slice(0, count);

  const providers = await Promise.all(
    PROVIDERS.map(async (p) => {
      const org = await prisma.organization.upsert({
        where: { slug: `${PREFIX}${p.slug}` },
        update: {},
        create: { id: `${PREFIX}org-${p.slug}`, slug: `${PREFIX}${p.slug}`, name: p.name, type: 'PROVIDER' },
      });
      const cp = await prisma.capitalProvider.upsert({
        where: { orgId: org.id },
        update: { availableLiquidity: money(p.liq) },
        create: {
          id: `${PREFIX}cp-${p.slug}`, orgId: org.id, name: p.name,
          archetype: p.archetype as never, costOfFunds: p.cof, hurdleRate: p.hurdle,
          totalLiquidity: money(p.liq), availableLiquidity: money(p.liq),
          minTicket: money(p.min), maxTicket: money(p.max),
          minTenorDays: 10, maxTenorDays: 120,
          riskAppetiteFloor: 'D', concentrationLimitPct: '0.250000',
          settlementDays: p.settle,
        },
      });
      return { ...p, providerId: cp.id };
    }),
  );

  let made = 0;
  for (const [idx, inv] of chosen.entries()) {
    const face = Math.round(Number(inv.invoice_amount));
    const supplierName = `${SUPPLIERS[idx % SUPPLIERS.length]} Pvt Ltd`;
    const supplierSlug = `${PREFIX}sup-${idx % SUPPLIERS.length}`;

    const supplierOrg = await prisma.organization.upsert({
      where: { slug: supplierSlug },
      update: {},
      create: { id: `${PREFIX}org-sup-${idx % SUPPLIERS.length}`, slug: supplierSlug, name: supplierName, type: 'SUPPLIER' },
    });

    const customer = await prisma.customer.upsert({
      where: { id: `${PREFIX}cust-${idx}` },
      update: {},
      create: {
        id: `${PREFIX}cust-${idx}`, orgId: supplierOrg.id, name: inv.customer_id,
        slug: `${PREFIX}cust-${idx}`,
        industry: 'Manufacturing', averageDelayDays: Math.round(random() * 18),
        relationshipDurationDays: 200 + Math.round(random() * 900),
      },
    });

    const tenor = Math.max(
      15,
      Math.round((Date.parse(inv.due_date) - Date.parse(inv.invoice_date)) / 86_400_000),
    );
    // Buyer-accepted is the cheapest tier to fund and the most common in a
    // healthy book; supplier-asserted is the tail providers dislike.
    const tierRoll = random();
    const tier = tierRoll > 0.45 ? 'BUYER_ACCEPTED' : tierRoll > 0.15 ? 'LEDGER_VERIFIED' : 'SUPPLIER_ASSERTED';

    const invoice = await prisma.invoice.create({
      data: {
        id: `${PREFIX}inv-${idx}`, orgId: supplierOrg.id, customerId: customer.id,
        invoiceNumber: inv.invoice_id, faceValue: money(face), currency: 'INR',
        invoiceDate: new Date(inv.invoice_date), dueDate: new Date(inv.due_date),
        verificationTier: tier as never, threeWayMatched: tier !== 'SUPPLIER_ASSERTED',
        acceptanceDate: tier === 'BUYER_ACCEPTED' ? new Date(inv.invoice_date) : null,
        fingerprint: `${PREFIX}fp-${idx}`,
      },
    });

    // Cash story, back-solved to land in a band where the decision is visible.
    //
    // The first version generated obligations from plausible-looking ratios and
    // produced a boring board: 47 of 48 deals matched, nothing was ever
    // disqualified, and one provider won everything. The gates were never
    // binding, so the screen showed a price list.
    //
    // The band that matters is narrow. A low-advance offer nets ~78% of face
    // and a high-advance one ~93%, so only a floor between those two makes the
    // cheap offer fail while a dearer one succeeds — which is the entire
    // argument. Choosing the floor first and deriving the obligation from it is
    // the only reliable way to hit it.
    //
    // Honest about what this is: the SEEDED SLICE is curated to demonstrate.
    // The statistical claims come from scripts/corpus/analyse.ts, which samples
    // pressure uniformly and is not tuned toward any outcome.
    const shape = random();
    const floorFraction =
      shape < 0.26 ? 0                          // comfortable: no shortfall at all
      : shape < 0.70 ? 0.70 + random() * 0.16   // the thesis band: cheap offers fall short
      : shape < 0.88 ? 0.86 + random() * 0.06   // tight: only the highest advance clears
      : 1.04 + random() * 0.22;                 // unfundable: correct answer is "do not finance"

    const cash = Math.round(face * (0.18 + random() * 0.3));
    const threshold = Math.round(face * 0.08);
    const ob = OBLIGATIONS[Math.floor(random() * OBLIGATIONS.length)];

    // Deadlines spread so the timing gate bites independently of sufficiency.
    // About a fifth land inside two days, which only a fast provider can meet.
    // The first attempt used a third at zero-to-one days, and combined with the
    // sufficiency band that pushed nearly half the board to NO_ACCEPTABLE_OFFER
    // — technically correct and useless to look at.
    const dueIn =
      floorFraction === 0
        ? 20 + Math.round(random() * 20)
        : random() < 0.2
          ? Math.round(random() * 2)
          : 3 + Math.round(random() * 9);

    // floor = threshold - (cash - obligations)  =>  obligations = floor + cash - threshold
    const targetFloor = Math.round(face * floorFraction);
    const obligationAmount =
      floorFraction === 0
        ? Math.max(0, Math.round(cash * 0.35))
        : Math.max(1, targetFloor + cash - threshold);

    const position = await prisma.supplierCashPosition.create({
      data: {
        id: `${PREFIX}cash-${idx}`, orgId: supplierOrg.id, asOfDate: AS_OF,
        currentCashPaise: cash * 100, cashThresholdPaise: threshold * 100,
        obligations: {
          create: [
            { label: ob.label, amountPaise: obligationAmount * 100, dueDate: addDays(AS_OF, dueIn) },
            // Deliberately dated past the first breach so it does not shift the
            // solved floor. It exists so the UI shows a real obligation list
            // rather than a single lonely row.
            { label: 'Warehouse rent', amountPaise: Math.round(face * 0.05) * 100, dueDate: addDays(AS_OF, 75) },
          ],
        },
      },
    });

    const opportunity = await prisma.financingOpportunity.create({
      data: {
        id: `${PREFIX}opp-${idx}`, orgId: supplierOrg.id, invoiceId: invoice.id,
        status: 'AUCTION_LIVE', requestedAmount: money(face), tenorDays: tenor,
        riskGrade: tier === 'BUYER_ACCEPTED' ? 'A' : tier === 'LEDGER_VERIFIED' ? 'B' : 'C',
        probabilityOfDefault: (0.012 + random() * 0.06).toFixed(6),
        // Left null on purpose: the gates are derived from the cash position at
        // clearing time, which is what makes the claim true (issue #7).
        sufficiencyFloor: null, timingDeadline: null,
        cashPositionId: position.id,
        auctionClosesAt: addDays(AS_OF, 1),
      },
    });

    // Bids priced from provider mandates only. Never from the scorer — a market
    // whose bids come from the logic that ranks them is circular (issue #8).
    for (const p of providers) {
      const advance = face * p.adv;
      if (advance < p.min || advance > p.max) continue;
      const riskPremium = tier === 'BUYER_ACCEPTED' ? 0 : tier === 'LEDGER_VERIFIED' ? 0.011 : 0.026;
      const tenorPremium = tenor > 60 ? 0.009 : tenor > 30 ? 0.004 : 0;
      await prisma.bid.create({
        data: {
          id: `${PREFIX}bid-${idx}-${p.slug}`, opportunityId: opportunity.id, providerId: p.providerId,
          advanceRate: p.adv.toFixed(6),
          annualRate: (p.rate + riskPremium + tenorPremium + random() * 0.012).toFixed(6),
          flatFee: money(p.fee), tenorDays: tenor, settlementDays: p.settle,
          recourse: true, status: 'ACTIVE', expiresAt: addDays(AS_OF, 2),
        },
      });
    }
    made += 1;
    if (made % 10 === 0) process.stdout.write(`  seeded ${made}/${chosen.length}\r`);
  }

  const bids = await prisma.bid.count({ where: { opportunityId: { startsWith: PREFIX } } });
  console.log(`\nseeded ${made} opportunities, ${bids} bids, ${providers.length} providers`);
  console.log(`all ids prefixed "${PREFIX}" — remove with: npx tsx scripts/seed-corpus.ts --wipe --count 0`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
