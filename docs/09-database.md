# Database reference

The complete data model behind LienRho — what each table holds, why it exists,
what is guaranteed about it, and how to query it.

Written to be read by a person joining the project and by an AI agent working
in the repo. Every invariant is stated explicitly rather than left implicit in
the code, and every non-obvious design decision carries its reason.

> **Read §12 before deploying anything.** There are no user accounts and no
> access control in this database — a working login screen exists, which makes
> that easy to miss.

- **Schema source of truth:** [`frontend/prisma/schema.prisma`](../frontend/prisma/schema.prisma)
- **Seed / demo fixture:** [`frontend/prisma/seed.ts`](../frontend/prisma/seed.ts)
- **Ledger engine:** [`frontend/src/lib/ledger/`](../frontend/src/lib/ledger/)
- **Integration quickstart:** [`frontend/prisma/README.md`](../frontend/prisma/README.md)

---

## 1. Where the data comes from

**Everything in the database is synthetic. There is no real money, no live
provider integration, and no real company's ledger.** Say this plainly wherever
the project is presented — it is a simulated market, and claiming otherwise
would be both wrong and, in a regulated activity, reckless.

Inside that, three categories worth distinguishing:

| Category | What it is | Where it comes from |
|---|---|---|
| **Invented inputs** | 4 capital providers and their mandates, 2 suppliers, 3 buyers, 3 invoices, 5 dated cash obligations | Written by hand in `prisma/seed.ts`. Plausible Indian MSME figures, chosen to make the market non-degenerate |
| **Doc-derived inputs** | The two headline offers on `INV-2026-0801` — 11%/80%/₹2,500/T+3 and 13.5%/95%/₹0/T+0 | Transcribed from [`01-commerce-analysis.md`](01-commerce-analysis.md) §3, written **before** any of this code existed |
| **Computed outputs** | Net cash, effective annual cost, sufficiency floors, all 42 ledger postings, the trial balance | Produced at seed time by `quoteEconomics()` and `deriveSupplierUtility()`. Never typed in |

That third row is the one that matters. **No figure in the demo is a literal.**
Change a bid's rate and every downstream number moves — the offer economics, the
ledger postings, the winner. The seed asserts this: it exits non-zero if the
trial balance fails or if the three properties the demo depends on stop holding.

The doc-derived row matters too, for a different reason: the worked example's
terms were fixed in the design document before the scoring engine was written,
so the demo's headline result was not reverse-engineered to flatter the code.

### What is *not* modelled

Stated so nobody assumes otherwise: real bank connectivity, KYC/KYB, actual
disbursement rails, credit bureau data, GST/e-invoice verification against the
IRP, multi-currency, and tax. The `Invoice.verificationTier` field records a
*claim* about verification quality; nothing performs the verification.

**And, most consequentially: there are no user accounts and no access control
in this database.** See §12 — it is the largest known gap and the one most
likely to be mistaken for solved, because a working login screen exists.

---

## 2. Model map

Thirteen models in four groups.

```
                    ┌──────────────────┐
                    │   Organization   │  party-typed: SUPPLIER | PROVIDER | PLATFORM
                    └────────┬─────────┘
          ┌──────────────────┼──────────────────┬─────────────────┐
          │                  │                  │                 │
     ┌────▼─────┐   ┌────────▼────────┐  ┌──────▼───────┐   ┌─────▼─────┐
     │ Customer │   │ CapitalProvider │  │SupplierCash  │   │  Account  │
     │ (buyer)  │   │   (mandate)     │  │  Position    │   │  (ledger) │
     └────┬─────┘   └────────┬────────┘  └──────┬───────┘   └─────┬─────┘
          │                  │                  │                 │
     ┌────▼─────┐            │           ┌──────▼────────┐  ┌─────▼──────┐
     │ Invoice  │            │           │CashObligation │  │  Posting   │
     └────┬─────┘            │           └───────────────┘  └─────┬──────┘
          │                  │                                    │
   ┌──────▼───────────────┐  │                            ┌───────▼──────┐
   │ FinancingOpportunity │◄─┼───────────────────────────►│ JournalEntry │
   └──────┬───────────────┘  │                            └──────────────┘
          │                  │
     ┌────▼────┐        ┌────▼────────┐
     │   Bid   │        │ EscrowLock  │
     └────┬────┘        └─────────────┘
          │
     ┌────▼────┐
     │  Match  │
     └─────────┘
```

| Group | Models | Purpose |
|---|---|---|
| **Base** | `Organization`, `Customer`, `Invoice` | Who the parties are and what is owed |
| **Marketplace** | `CapitalProvider`, `FinancingOpportunity`, `Bid`, `Match` | The auction: mandates, listings, competing offers, the winner |
| **Supplier need** | `SupplierCashPosition`, `CashObligation` | Raw cash facts the utility derivation reads |
| **Ledger** | `Account`, `JournalEntry`, `Posting`, `EscrowLock` | Double-entry record of every movement of money |

---

## 3. Money representation — read this before writing any query

Three different numeric conventions coexist, deliberately. Mixing them is the
single easiest way to introduce a wrong number.

| Where | Type | Unit | Example |
|---|---|---|---|
| Marketplace + ledger tables | `Decimal(18,2)` | **rupees** | `1000000.00` = ₹10,00,000 |
| Rates | `Decimal(9,6)` | **fraction** | `0.135000` = 13.5% |
| `SupplierCashPosition`, `CashObligation` | `Int` | **paise** | `90000000` = ₹9,00,000 |
| Scoring engine (`lib/market/`) | `number` | **paise / bps** | `90000000`, `1350` bps |
| API responses | `string` | rupees, 2dp | `"1000000.00"` |

**Why not one convention.** The ledger needs arbitrary precision and Postgres
`Decimal` gives it. The scoring engine needs to run with no database and no
generated client — it has zero imports by design — so it uses integer paise,
which is exact under JS arithmetic. The cash-position tables sit on the boundary
between them and use the scorer's convention so the hot path needs no conversion.

**Never parse money with `Number()`.** `0.1 + 0.2 !== 0.3`, and the worked
example turns on a 3-basis-point gap (13.76% vs 13.73%) — float drift is the
same order of magnitude as the effect being demonstrated. Use:

```ts
import { quoteEconomics, Decimal } from "@/lib/money";     // Decimal, ledger side
import { computeOfferEconomics } from "@/lib/market/offer-math";  // paise, scorer side
```

**Known ceiling:** `Int` paise tops out at 2,147,483,647 ≈ ₹2.14 crore. Correct
for supplier working capital, wrong for a balance sheet — which is why provider
liquidity stays `Decimal`. If a supplier ever needs to exceed it, the column
becomes `BigInt` and the scorer's `Paise` alias becomes `bigint` on the same
commit.

---

## 4. Base entities

### `Organization`

A tenant. `type` is `SUPPLIER | PROVIDER | PLATFORM`.

| Field | Notes |
|---|---|
| `slug` | **unique.** Ledger account codes are built from it (`provider:meridian-bank:cash`), so a reseed keeps codes meaningful and anything written against them keeps working |
| `taxId` | unique; feeds the anti-double-financing fingerprint |

Party type lives on the org because **a provider must never see another
provider's mandate or bids.** That is a tenancy rule, not a UI concern.

⚠️ **This rule is currently a design intent, not an enforced guarantee.** No
API route resolves a caller to an `Organization`, so nothing checks *who is
asking*. `GET /api/providers` hides mandate internals by projection, which
protects the fields but not the tenancy. See §12.

### `Customer`

The buyer who owes the invoice. Passive — a verification target and a credit
input, never a user of the platform. `averageDelayDays` is realised payment
behaviour, which is a credit signal providers price against.

### `Invoice`

| Field | Notes |
|---|---|
| `faceValue` | `Decimal(18,2)`, rupees |
| `verificationTier` | **graded, never boolean** — see below |
| `acceptanceDate` | set only when the buyer formally accepted; drives `BUYER_ACCEPTED` |
| `threeWayMatched` | invoice ↔ purchase order ↔ proof of delivery |
| `fingerprint` | **unique.** `sha256(sellerTaxId \| buyerTaxId \| invoiceNumber)` |

**Verification tiers, and why graded:**

| Tier | Basis | Effect on pricing |
|---|---|---|
| `BUYER_ACCEPTED` | Buyer formally acknowledged the debt | Lowest uncertainty; priced closest to buyer credit |
| `LEDGER_VERIFIED` | Present and consistent in the supplier's books, with delivery evidence | Moderate |
| `SUPPLIER_ASSERTED` | Claimed, unconfirmed | Highest; most mandates decline outright |

Providers price the *difference* between these. Flattening them into one
"verified" flag destroys the information that stops the market unravelling
toward its worst participants — if providers can't distinguish good claims from
bad ones, they price for the average and good suppliers leave.

**Anti-double-financing.** The `fingerprint` unique constraint makes financing
the same invoice twice a database error rather than a service call. Be precise
about its limits: it catches the *same* invoice under an unchanged identifier.
It does **not** catch a fabricated near-duplicate with a tweaked invoice number
— that needs `threeWayMatched` doing its job. The two checks are complementary,
not redundant.

---

## 5. Marketplace

### `CapitalProvider` — a private mandate

| Field | Meaning |
|---|---|
| `costOfFunds` | Annualised. The floor under anything it can quote |
| `hurdleRate` | Minimum risk-adjusted return before it deploys |
| `totalLiquidity` / `availableLiquidity` | Capital, and what's free right now |
| `minTicket` / `maxTicket` | Viable deal size |
| `minTenorDays` / `maxTenorDays` | How long it will stay deployed |
| `riskAppetiteFloor` | Worst grade it will touch at any price (`A` best … `E` worst) |
| `concentrationLimitPct` | Cap on exposure to one buyer, as a fraction of total liquidity |
| `settlementDays` | T+0 / T+1 / T+3 capability |
| `reliabilityScore` | Realised reliability, learned from quoted-vs-delivered settlement |

> **Critical rule — the scoring engine must never read these fields.**
>
> If provider pricing is generated by the same logic that later scores it, the
> market is theatre and any "intelligent matching" result is circular. This is
> the same discipline as not letting a data generator leak the label it is meant
> to teach a model to predict.
>
> `GET /api/providers` enforces it: the default projection omits `costOfFunds`,
> `hurdleRate`, `riskAppetiteFloor`, `concentrationLimitPct` and
> `availableLiquidity`. The full mandate is returned only for `?self=<id>`.

**The four seeded archetypes** are deliberately non-dominating — no provider
wins on every axis, so a genuine Pareto frontier exists:

| Provider | Type | Cost of funds | Settles | Risk floor | Character |
|---|---|---|---|---|---|
| Meridian Bank | `BANK` | 7.5% | T+3 | B | Cheapest money, slow and rigid |
| Kaveri Capital | `NBFC` | 10.5% | T+1 | C | The middle of the market |
| Rapidfin | `FINTECH` | 13.0% | T+0 | C | Dearest, instant, small tickets |
| Ashwin Credit Fund | `CREDIT_FUND` | 11.0% | T+3 | **E** | Takes weak credits at a price |

**Validity check before trusting any demo output:** plot the offers. If one
dominates all others on every axis, the market generator is broken.

### `FinancingOpportunity` — one invoice, listed

Carries the invoice, the risk assessment, and the **derived** supplier utility.

| Field | Written by | Notes |
|---|---|---|
| `status` | lifecycle | 13 states, below |
| `riskGrade`, `probabilityOfDefault`, `expectedDilutionPct` | risk engine | PD calibration is market infrastructure, not a leaderboard number — a provider pricing off an uncalibrated PD is being misled |
| `sufficiencyFloor`, `timingDeadline`, `drivingObligation`, `urgencyWeight` | **Track 2's `deriveSupplierUtility()`** | **Null in the seed on purpose.** See §6 |
| `cashPositionId` | seed | The snapshot the derivation read, kept so a past decision stays reproducible after the supplier's position moves |

**Lifecycle (`OpportunityStatus`):**

```
RECEIVED → VERIFIED → AUCTION_LIVE → MATCHED → DISBURSING → DISBURSED
  → AWAITING_BUYER → BUYER_PAID → RESERVE_RELEASED → CLOSED
                    ↘ DEFAULTED / DISPUTED
  ↘ NO_ACCEPTABLE_OFFER
```

`NO_ACCEPTABLE_OFFER` is a **success outcome, not an error**. When nothing
clears the supplier's floor the correct answer is "do not finance", not "here is
the least bad option". A market that always transacts is not exercising
judgement. The name matches `MatchResult` in `lib/market/types.ts` deliberately
— one concept, one word.

### `Bid` — one provider's competing offer

The four attributes the scorer ranks on:

| Field | Meaning |
|---|---|
| `annualRate` | APR on the advance. The headline number, and the most over-weighted one |
| `advanceRate` | Share of face paid upfront, 0–1. Dominates rate on short tenors |
| `flatFee` | Flat, therefore **regressive** — it hurts small invoices hardest |
| `settlementDays` | Disbursal latency, T+0 / T+1 / T+3 |

Plus `tenorDays`, `recourse`, `repaymentStructure`, `expiresAt`.

Scoring outputs — `netCashToSupplier`, `effectiveAnnualCost`,
`projectedArrival`, `utilityScore`, `rank`, `gateFailures` — are **nullable and
null until an auction clears.** Seeding them would put numbers on the demo that
nothing computed, which is the one thing this project promises not to do.

`@@unique([opportunityId, providerId])` — one bid per provider per opportunity.

### `Match` — the winning allocation

Records the economics (`advanceAmount`, `discountCharge`, `feeAmount`,
`netDisbursed`, `reserveAmount`) and, critically, **quoted versus delivered**:

| Quoted | Delivered |
|---|---|
| `quotedSettlementDays`, `quotedDisbursalDate` | `actualDisbursalDate` |
| `expectedBuyerPayment` | `actualBuyerPayment` |

A provider quoting T+0 and settling T+3 has, in substance, made a worse offer
than it advertised. That delta is the input the learning loop needs — it is what
gives "Learn" in the PS-5 cycle something concrete to do instead of being a
diagram label.

`constraintSnapshot` (JSON) freezes the provider's position at allocation time,
so the allocation is provably legal when made even after the position moves.

---

## 6. Supplier need — the differentiator

**This is the part most implementations get wrong, and the reason the schema
looks the way it does.**

Ranking offers by "overall suitability" requires knowing what this supplier
values *today*. Both naive answers are bad: fixed weights are wrong for
everyone, and asking a supplier to self-report that they value settlement speed
at 0.3 produces noise dressed as data.

**So the platform does not ask. It reads the cash position.**

### `SupplierCashPosition` + `CashObligation`

```
SupplierCashPosition
  currentCashPaise      Int    -- reconciles with supplier:<slug>:cash in the ledger
  cashThresholdPaise    Int    -- buffer the business will not go below
  obligations           CashObligation[]

CashObligation
  label                 String -- "September payroll"
  amountPaise           Int
  dueDate               DateTime
```

Obligations are **dated and itemised, never aggregated** into a single "upcoming
expenses" figure. The sufficiency floor is only explicable on stage if the
system can name the obligation that produced it: *"you need ₹9,00,000 by Friday
because payroll is ₹9,00,000."*

`currentCashPaise` is read back off the supplier's ledger cash account by the
seed rather than stated twice, so the cash position and the ledger cannot drift
apart.

### The derivation

`deriveSupplierUtility(position, asOf)` in `lib/market/utility.ts` walks
obligations in date order, running the balance down, and **stops at the first
date the balance falls below the threshold**:

```
sufficiencyFloorPaise = cashThresholdPaise − balanceAtBreach
timingDeadline        = that obligation's dueDate
drivingObligation     = that obligation's label
```

First breach only: that is the cliff the supplier is actually up against.
Financing decisions are made against the nearest one, not the worst one.

**Order matters and is not cosmetic.** An unclearable obligation sitting behind
a clearable one would never drive the floor. The seed dates Kalyani Steel a day
before payroll for exactly this reason — so the order is fixed by date rather
than by whether a sort happens to be stable.

### Gates, not weights

The two derived values are **lexicographic gates**. An offer that fails either
is *disqualified*, not ranked lower. Only survivors are ranked, and only on
cost.

Why this matters, from the live demo (`INV-2026-0801`, floor ₹9,00,000 by day 2):

| Provider | Net cash | Settles | Effective cost | Outcome |
|---|---|---|---|---|
| Meridian Bank | ₹7,86,650.68 | T+3 | 13.76% | fails **both** gates |
| Kaveri Capital | ₹8,65,763.84 | T+1 | **13.34%** | fails sufficiency and timing |
| Rapidfin | ₹9,34,188.36 | T+0 | 13.73% | **clears both — wins** |

**Kaveri is the cheapest offer in the market and it loses.** A weighted score
ranks it first. A lexicographic gate says plainly: *this does not cover what you
need, and it arrives after you need it.* That is the failure mode PS-5 names,
and it is why the gates are gates.

> ⚠️ **Failure mode to know about.** `supplierUtilityFromStored()` returns
> `unconstrained` when both stored columns are null — meaning **no gates and
> cost-only ranking**, silently. Because Track 1 nulls those columns by design,
> any code path that reads the stored columns without deriving from the cash
> position will quietly rank on cost alone and pick the wrong winner. This
> actually happened (see the fix in `clear.ts`). **Always join
> `cashPosition` when clearing.**

---

## 7. The Stitch double-entry ledger

[Stitch](https://www.stitch.co/) provides *"a programmable double-entry ledger
that records every movement of money in real time."* This models that, applied
to the two events the marketplace must get right: **Day 0 disbursement** and
**Day 90 buyer repayment**.

### Tables

| Model | Holds |
|---|---|
| `Account` | Chart of accounts. `code` is the stable handle; `type` is `ASSET \| LIABILITY \| EQUITY \| REVENUE \| EXPENSE`. **Not a user account** — see §12 |
| `JournalEntry` | One balanced transaction. `reference` is **unique** — the idempotency key |
| `Posting` | One leg. Amount always **positive**; `direction` (`DEBIT`/`CREDIT`) carries the sign |
| `EscrowLock` | A hold on provider liquidity while a bid is live |

### The invariant

> **Every journal entry's postings sum to zero — total debits equal total
> credits.**

Enforced in `postEntry()` *inside the transaction that writes them*, so an
unbalanced entry cannot reach the table even under a concurrent writer.
Entries are **immutable**: a correction is a new reversing entry, never an edit,
because in this product the trail is the deliverable.

`reference` being unique means a **retried disbursement returns the existing
entry instead of posting twice.** That is the "without double-counting"
requirement, made the database's job rather than the caller's.

**Never call `prisma.posting.create()` directly.** Go through `postEntry()`, or
the balance check is bypassed and the ledger silently stops meaning anything.

### Account naming

```
platform:cash                    platform:escrow_cash      platform:fee_income
platform:escrow_payable          platform:opening_balance

supplier:<slug>:cash             supplier:<slug>:invoice_receivable
supplier:<slug>:financing_expense

provider:<slug>:cash             provider:<slug>:funded_receivable
provider:<slug>:encumbered_capital   provider:<slug>:discount_income

buyer:<slug>:cash                buyer:<slug>:payable
```

Join on `code`, not `id`, so a reseeded database doesn't invalidate your query.

### Day 0 — `postDisbursement()`

For face **F**, advance rate **a**, rate **r**, tenor **T**, fee **f**:

```
advance        = a × F
discountCharge = advance × r × T/365
netCash        = advance − discountCharge − f
reserve        = F − advance
```

Postings (each party's sub-ledger balances, and so does the entry as a whole):

| Account | Dr | Cr |
|---|---|---|
| `supplier:<s>:cash` | netCash | |
| `supplier:<s>:financing_expense` | discount + fee | |
| `supplier:<s>:invoice_receivable` | | advance |
| `provider:<p>:funded_receivable` | advance | |
| `provider:<p>:cash` | | advance − discount |
| `provider:<p>:discount_income` | | discount |
| `platform:cash` | fee | |
| `platform:fee_income` | | fee |

The provider keeps its discount **at source** — cash leaving is `advance −
discount`, not the full advance.

### Day 90 — `postBuyerPayment()` then `postReserveRelease()`

Buyer settles into escrow, recorded as cash held against a matching payable so
**escrow is structurally never platform revenue**:

| Account | Dr | Cr |
|---|---|---|
| `buyer:<b>:payable` | amount | |
| `buyer:<b>:cash` | | amount |
| `platform:escrow_cash` | amount | |
| `platform:escrow_payable` | | amount |

Then escrow distributes — **the provider is made whole first**, and only what
remains is the supplier's reserve:

| Account | Dr | Cr |
|---|---|---|
| `platform:escrow_payable` | escrow | |
| `platform:escrow_cash` | | escrow |
| `provider:<p>:cash` | min(escrow, advance) | |
| `provider:<p>:funded_receivable` | | min(escrow, advance) |
| `supplier:<s>:cash` | remainder | |
| `supplier:<s>:invoice_receivable` | | remainder |

If the buyer short-pays, **dilution eats the reserve rather than the provider's
principal.** That is what a recourse arrangement means mechanically, and why the
reserve is not risk-free money a supplier can count on.

### `EscrowLock` — the concurrency seam

Two opportunities can legitimately try to draw down the same provider's
remaining liquidity at once. `@@unique([providerId, opportunityId])` makes a
double-hold a database error rather than a silent over-commitment of capital.

Redis `SETNX` sits **in front** of this for fast rejection, but correctness
rests on the Postgres row: write the lock in the same transaction that
decrements `availableLiquidity`, and a lost Redis lock then costs throughput,
never money.

An `ESCROW_HOLD` moves capital from `cash` to `encumbered_capital` — nothing
leaves the provider, so committed capital is visible and cannot be promised
twice.

**Transaction timeout:** ledger writes allow 30s, not Prisma's 5s default. A
posting is several round trips and the shared database is in `ap-northeast-1`;
5s is comfortable against localhost and marginal against Tokyo, so the default
failed intermittently — passing in development and aborting against the real
database.

---

## 8. Current contents

As seeded. `npm run db:seed` reproduces this exactly.

| Table | Rows |
|---|---|
| `Organization` | 7 (1 platform, 2 suppliers, 4 providers) |
| `CapitalProvider` | 4 |
| `Customer` | 3 |
| `Invoice` | 3 |
| `FinancingOpportunity` | 3 |
| `Bid` | 5 |
| `Match` | 1 |
| `SupplierCashPosition` | 2 |
| `CashObligation` | 5 |
| `Account` | 33 (21 asset, 5 revenue, 4 liability, 2 expense, 1 equity) |
| `JournalEntry` | 12 (9 opening, 1 disbursement, 1 buyer payment, 1 reserve release) |
| `Posting` | 42 |
| `EscrowLock` | 0 |

**Trial balance: ₹91,00,70,750.00 debits = ₹91,00,70,750.00 credits.**

### The three scenarios

| Invoice | Supplier | Scenario |
|---|---|---|
| `INV-2026-0801` | Vertex Components | **The thesis.** ₹10,00,000, 45 days, `BUYER_ACCEPTED`, 3 competing bids. Floor ₹9,00,000 by day 2. Rapidfin wins; the cheapest offer is gated out |
| `INV-2026-0802` | Vertex Components | **A settled deal.** ₹4,50,000, 60 days, run end to end through Day 0 and Day 90 so the ledger has real entries. Quotes T+1, delivers T+2 — left there for the learning loop to find |
| `INV-2026-0803` | Kalinga Precision | **`NO_ACCEPTABLE_OFFER`.** ₹22,00,000, `SUPPLIER_ASSERTED` at grade E. Only Ashwin's risk floor reaches that far down; it nets ₹18,41,176.71 against a ₹21,10,000 floor. Nothing clears |

---

## 9. Querying

```ts
import { prisma } from "@/lib/db";   // lazy singleton — never construct your own
```

**Live auctions with everything needed to clear them:**

```ts
const live = await prisma.financingOpportunity.findMany({
  where: { status: "AUCTION_LIVE" },
  include: {
    invoice: { include: { customer: true } },
    cashPosition: { include: { obligations: { orderBy: { dueDate: "asc" } } } },
    bids: { include: { provider: { select: { id: true, name: true } } } },
  },
});
```

⚠️ The `cashPosition` join is **not optional** — without it the gates silently
degrade to cost-only ranking (§6).

**One deal's full audit trail:**

```ts
const trail = await prisma.journalEntry.findMany({
  where: { opportunityId },
  orderBy: { occurredAt: "asc" },
  include: { postings: { include: { account: true } } },
});
```

**Prove the books balance:**

```ts
import { trialBalance, accountBalance } from "@/lib/ledger";
const { debits, credits, balanced } = await trialBalance();
const cash = await accountBalance("supplier:vertex-components:cash");
```

### API routes

| Route | Returns |
|---|---|
| `GET /api/db-health` | reachable, seeded, ledger balanced |
| `GET /api/opportunities?status=AUCTION_LIVE` | market view — invoice, buyer, cash position, all bids |
| `GET /api/opportunities/:id` | one deal plus its full journal trail |
| `GET /api/providers` | public projection (mandate fields omitted) |
| `GET /api/providers?self=<id>` | that provider's own full mandate |
| `GET /api/ledger/entries?opportunityId=<id>` | entries with per-entry Dr/Cr totals |
| `GET /api/ledger/trial-balance` | every account + the system check — **500 if unbalanced** |
| `POST /api/match` | clear an opportunity |

`trial-balance` returning 500 rather than 200-with-a-bad-number is deliberate: a
figure you cannot trust should not arrive with a success code.

---

## 10. Invariants

Things that must hold. Several are enforced by the database; the rest by code
paths named here.

| # | Invariant | Enforced by |
|---|---|---|
| 1 | Every journal entry's postings sum to zero | `postEntry()`, inside the write transaction |
| 2 | Journal entries are immutable; corrections are reversing entries | Convention — no update path exists |
| 3 | A `reference` posts at most once | `JournalEntry.reference` unique index |
| 4 | One invoice cannot be financed twice under one identifier | `Invoice.fingerprint` unique index |
| 5 | One bid per provider per opportunity | `@@unique([opportunityId, providerId])` |
| 6 | One live escrow hold per provider per opportunity | `@@unique([providerId, opportunityId])` |
| 7 | The scorer never reads provider mandate internals | `GET /api/providers` projection; code review. **Field-level only — caller identity is never checked (§12)** |
| 8 | No LLM produces a financial figure | `quoteEconomics()` / `offer-math.ts` are the only sources |
| 9 | `currentCashPaise` reconciles with the ledger cash account | Seed reads it back off the account |
| 10 | Sufficiency and timing are gates, not weights | `scoreOffers()` |

---

## 11. Operations

```bash
cd frontend
npm install                 # postinstall generates the Prisma client
npm run db:studio           # browse
npm run db:seed             # DESTRUCTIVE — see below
npx prisma migrate deploy   # what CI/production runs
```

**The seed wipes marketplace tables.** A guard refuses when it detects scored
bids, matches, or derived utility on a live auction — the signals of someone
else's work — and names `SEED_FORCE=1` as the override. It deliberately allows
a clean re-seed, because the seed's own settled deal legitimately carries a
ranked bid and a match.

**Schema changes go through migrations, not `db push`:**

```bash
npx prisma migrate dev --name <what-changed>
```

`prisma/migrations/0_init` is the baseline and Supabase is marked as having it
applied. `migrate deploy` is verified against an empty database — it creates all
13 tables and the seed then runs clean — so the Aurora cutover in
[`08-aws-migration-plan.md`](08-aws-migration-plan.md) needs no baselining work.

**Two URLs, not interchangeable:** `DATABASE_URL` is the transaction pooler
(6543) used by the app; `DIRECT_URL` is the direct connection (5432) used by the
CLI, because DDL cannot run through the pooler. See
[`frontend/.env.example`](../frontend/.env.example).

---

## 12. User accounts and access control — the known gap

**There are no user accounts in this database, and no marketplace endpoint
performs any authorization check.**

This is documented at length rather than in a footnote because a working login
screen exists, which makes the gap easy to mistake for solved.

### What each layer actually does

| Layer | State |
|---|---|
| **Prisma schema (this database)** | No `User`, `Session`, or credential model. No email, password hash, or token anywhere |
| **Frontend** | Complete login UI — `/login`, an httpOnly session cookie (`lib/session.ts`), and a `proxy.ts` redirect gate on page routes |
| **Legacy `backend/` (Python)** | The only real implementation: `User` + `Org` tables, PBKDF2-HMAC-SHA256 password hashing, JWT with a 12-hour TTL, and org-scoped query helpers |

`POST /api/auth/login` proxies to `${NEXT_PUBLIC_API_URL}/auth/login` — FastAPI
on `:8000`, the deprecated backend the marketplace no longer runs. **If that
service is not up, nobody can log in at all.** The login screen is orphaned
relative to the current stack.

### Every marketplace route is unauthenticated

None of `/api/opportunities`, `/api/providers`, `/api/match`,
`/api/ledger/entries`, `/api/ledger/trial-balance` or `/api/db-health` reads the
session cookie or resolves a caller to an `Organization`.

The page-route gate explicitly excludes the API:

```ts
// frontend/src/proxy.ts
matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
```

That exclusion was **correct in the original design** — FastAPI validated the
JWT itself, so the proxy only needed to stop a page rendering and then failing
to fetch. It stopped being correct when the new API routes replaced FastAPI
without inheriting its auth. The gate was never wrong; the thing behind it
changed.

Consequence: anyone who can reach the server can read the entire ledger, every
opportunity, and every bid.

### `Account` is not a user account

`model Account` is the **ledger** chart of accounts —
`provider:rapidfin:cash`, `platform:escrow_payable`. It has no relationship to
authentication. Anyone grepping for `Account` expecting to find auth will find
the wrong table, and an agent asked to "add a field to the account model" could
plausibly modify the ledger. Named here so that cannot happen quietly.

### Why it is like this

A deliberate scope decision, recorded in issue #1: *"we are not building full
production auth or full real-world lending logic — we are scaffolding the
Prisma schema, building the mock data, and setting up the core ledger tables to
prove the concept."* For a local demo over synthetic data that is a reasonable
trade.

### What follows from it

1. **Do not deploy this publicly as-is.** The Sprint 2 plan
   ([`08-aws-migration-plan.md`](08-aws-migration-plan.md)) puts the app behind
   a public ALB on Fargate. If that happens before auth exists, the ledger is
   world-readable. Auth is a prerequisite for that phase, not a follow-up.
2. **Multi-tenancy is unenforced.** `Organization.type` exists and provider
   mandates are hidden by projection, but nothing verifies the caller. Treat
   invariant #7 as field-level hygiene, not isolation.
3. **The Python backend is still load-bearing for login only.** Dropping
   `backend/` entirely requires replacing auth first.

### The smallest honest fix

A `User` model in Prisma (id, email unique, passwordHash, `orgId` → `Organization`),
plus one shared `requireSession()` helper that resolves the cookie to an
`orgId` and scopes every query by it. Roughly 60 lines. It would also sever the
last dependency on the Python backend.

Not in Track 1's assigned scope, so it is recorded here rather than silently
built.

---

## 13. Reading order for the reasoning

Every design decision here traces to an analysis document:

| Decision | Source |
|---|---|
| Why graded verification tiers | [`01-commerce-analysis.md`](01-commerce-analysis.md) §8 |
| Why the anti-double-financing hash | §8.5 |
| Why utility is derived, not asked | §4 |
| Why gates rather than weights | §4 |
| Why providers must be non-dominating | §6 |
| Why `NO_ACCEPTABLE_OFFER` exists | §7 |
| Why quoted-vs-delivered is tracked | §9 |
| Why the market is simulated and labelled | §10 |
| The lifecycle state machine | [`03-system-design.md`](03-system-design.md) Module 9 |
| The concurrency seam | Module 8 |
