# Track 1 — database, Prisma models & the Stitch ledger

Everything the other three tracks need to talk to the shared database.

## Setup (2 minutes)

```bash
cd frontend
npm install                 # runs `prisma generate` for you via postinstall
cp .env.example .env        # then paste the shared Supabase URLs into it
npx prisma generate         # only if you skipped the install step
```

You do **not** need to run `db push` or the seed — the shared database is
already migrated and seeded. Run them only against your own local Postgres.

```bash
npm run db:seed             # re-seed (destructive: wipes marketplace tables)
npm run db:studio           # browse the data
```

## Which URL goes where

| Variable | Port | Used by |
|---|---|---|
| `DATABASE_URL` | 6543 | the app at runtime — Supabase's transaction pooler |
| `DIRECT_URL` | 5432 | `db push`, `migrate`, `seed` — DDL cannot run through the pooler |

Both come from **Supabase → Project → Connect → ORMs → Prisma**.

## Using the client

```ts
import { prisma } from "@/lib/db";

const live = await prisma.financingOpportunity.findMany({
  where: { status: "AUCTION_LIVE" },
  include: { bids: { include: { provider: true } }, invoice: true },
});
```

It is a lazy singleton — import it anywhere, including from a script. Do not
construct your own `PrismaClient`; Supabase's free tier runs out of connections
quickly.

## Read routes that already exist

| Route | Returns |
|---|---|
| `GET /api/db-health` | reachable, seeded, ledger balanced |
| `GET /api/opportunities?status=AUCTION_LIVE` | market view with every bid |
| `GET /api/opportunities/:id` | one deal plus its full journal trail |
| `GET /api/providers` | public projection — safe to render |
| `GET /api/providers?self=<id>` | one provider's own private mandate |
| `GET /api/ledger/entries?opportunityId=<id>` | entries with per-entry dr/cr totals |
| `GET /api/ledger/trial-balance` | every account, and the system-wide check |

## Money is never a number

Every amount is `Decimal(18,2)` and every rate `Decimal(9,6)`. Over the wire
they are **strings**, deliberately. `0.1 + 0.2 !== 0.3`, and a ledger that
loses a paisa per posting does not balance.

```ts
import { Decimal, quoteEconomics } from "@/lib/money";

// Don't: Number(bid.flatFee) + Number(bid.annualRate)
// Do:
const econ = quoteEconomics({
  faceValue: opportunity.invoice.faceValue,
  advanceRate: bid.advanceRate,
  annualRate: bid.annualRate,
  flatFee: bid.flatFee,
  tenorDays: bid.tenorDays,
});
// -> advance, discountCharge, fee, netCash, reserve, effectiveAnnualCost
```

`quoteEconomics()` is the named deterministic function every rupee traces back
to. No LLM computes a financial figure — that rule is the project's spine, and
it matters more here than it did in the old build because what it now protects
is priced capital and a settlement obligation.

## For Track 2 (matching & Redis locks)

The four attributes to rank on are on `Bid`:

| Field | Meaning |
|---|---|
| `annualRate` | APR — the headline number, and the most over-weighted one |
| `advanceRate` | share of face paid upfront; dominates rate on short tenors |
| `flatFee` | flat, therefore regressive on small invoices |
| `settlementDays` | disbursal latency, T+0 / T+1 / T+3 |

Write your results back to `netCashToSupplier`, `effectiveAnnualCost`,
`projectedArrival`, `utilityScore`, `rank` and `gateFailures`. They are null in
the seed on purpose — a number on the demo that nothing computed is the one
thing we promised not to ship.

Two gates come before ranking, and they are **lexicographic, not weights**:
sufficiency (does this offer's net cash cover what the supplier needs?) and
timing (does it land before the deadline?). An offer failing either is
*disqualified*, not merely ranked lower. A weighted sum would let a cheap, slow
offer beat one that actually makes payroll — the exact failure PS-5 calls out.

`sufficiencyFloor`, `timingDeadline`, `drivingObligation` and `urgencyWeight`
on `FinancingOpportunity` are **null in the seed on purpose** — they are your
outputs, not your inputs. Derive them from `opportunity.cashPosition`, which
ships with the opportunity in one round trip:

```ts
cashPosition: {
  currentCashPaise: 56072836,      // reconciles with the ledger cash account
  cashThresholdPaise: 10000000,    // buffer the business won't go below
  obligations: [                   // dated and itemised, ordered by dueDate
    { label: "September payroll",              amountPaise: 90000000, dueDate: "..." },
    { label: "Kalyani Steel — billet delivery", amountPaise: 46072836, dueDate: "..." },
  ],
}
```

Money here is `Int` **paise**, matching your `Paise` alias — no Decimal at this
boundary. Ceiling is ~₹2.14 crore (Postgres `Int`); fine for working capital,
which is why provider liquidity stays `Decimal`. If that ever binds, the column
becomes `BigInt` and `Paise` becomes `bigint` on the same commit.

The derivation walks obligations in date order and stops at the **first** day
cash falls below the threshold. Order matters: an unclearable obligation
sitting behind a clearable one would never drive the floor.

Seeded so the gates visibly discriminate:

| Opportunity | Floor | By | Outcome |
|---|---|---|---|
| `INV-2026-0801` (Vertex) | ₹9,00,000 | day 2 | Rapidfin clears; Meridian and Kaveri fail sufficiency |
| `INV-2026-0803` (Kalinga) | ₹21,10,000 | day 3 | nothing clears → `NO_ACCEPTABLE_OFFER` |

Note Kaveri is the **cheapest** offer by effective cost (13.34%) and is still
disqualified, because it delivers ₹8,65,763.84 against a ₹9,00,000 floor. That
is the lexicographic model earning its keep — a weighted sum would have ranked
it first.

**Do not read provider internals in the scorer.** `costOfFunds`, `hurdleRate`,
`riskAppetiteFloor`, `concentrationLimitPct` belong to the bidding side. If the
scorer sees them the market is circular and any matching result is theatre.

For concurrency, `EscrowLock` has `@@unique([providerId, opportunityId])`, so a
double-hold is a database error rather than silent over-commitment. Put Redis
`SETNX` in front for fast rejection, but keep correctness on the Postgres row:
write the lock in the same transaction that decrements `availableLiquidity`,
and a lost Redis lock then costs throughput, never money.

## For Track 4 (UI)

`GET /api/opportunities?status=AUCTION_LIVE` is the auction screen's payload in
one call. The invoice, buyer, all bids and each bidding provider's public
fields are included.

For the Stitch ledger visualiser use `GET /api/ledger/entries?opportunityId=`.
Each entry ships its own `totals.debits` / `totals.credits` / `totals.balanced`
so you can show that every entry balances without recomputing it.

The demo's centrepiece is `INV-2026-0801`, which is the worked example from
`docs/01-commerce-analysis.md` §3 seeded exactly:

| | Meridian Bank | Rapidfin |
|---|---|---|
| Headline rate | **11.0%** | 13.5% |
| Advance | 80% | **95%** |
| Fee | ₹2,500 | **₹0** |
| Settlement | T+3 | **T+0** |
| Net cash | ₹7,86,650.68 | **₹9,34,188.36** |
| Effective cost | 13.76% | **13.73%** |

The 11% offer is worse *and* dearer. Vertex needs ₹9,00,000 within two days, so
Meridian fails both gates on top of that. If the UI sorts on headline rate it
gives the confidently wrong answer — which is the whole point of the demo.

## The ledger, briefly

Stitch's double-entry ledger, modelled on four tables: `Account`,
`JournalEntry`, `Posting`, `EscrowLock`.

One invariant, enforced rather than trusted: **every entry's postings sum to
zero**, checked inside the transaction that writes them. Entries are immutable
and keyed by a unique `reference`, so a retried disbursement returns the
existing entry instead of posting twice — that is the "without double-counting"
requirement, made the database's job.

```ts
import { postDisbursement, postBuyerPayment, postReserveRelease } from "@/lib/ledger";
```

- **Day 0** `postDisbursement` — provider advances, keeps the discount at
  source, platform takes its fee, supplier nets the rest.
- **Day 90** `postBuyerPayment` — buyer settles into escrow, held against a
  matching payable so escrow is structurally never platform revenue.
- **Day 90** `postReserveRelease` — the provider is made whole *first*; only
  what remains is the supplier's reserve. If the buyer short-pays, dilution
  eats the reserve rather than the provider's principal.

Never `prisma.posting.create()` directly. Go through `postEntry()`, or the
balance check is bypassed and the ledger silently stops meaning anything.
