# LienRho

**An agentic capital marketplace for supply-chain working capital.**
CSI ORIGIN 2026 · Problem Statement 5

[![CI](https://github.com/Haise-727/LienRho/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/Haise-727/LienRho/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748)
![Postgres](https://img.shields.io/badge/PostgreSQL-16-336791)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)

A supplier holding a verified invoice shouldn't have to call one bank. LienRho
turns that invoice into a live opportunity, lets multiple capital providers
compete to fund it, and picks the winner by what the offer is **actually worth
to that supplier right now** — not by whose interest rate looks smallest.

---

## The thesis

> The cheapest offer is frequently not the best offer, and a marketplace that
> ranks on headline rate quietly destroys value for suppliers.

One invoice: **₹10,00,000**, 45-day tenor. Two offers.

| | Meridian Bank | Rapidfin |
|---|---|---|
| Headline rate | **11.0%** | 13.5% |
| Advance rate | 80% | **95%** |
| Fee | ₹2,500 | **₹0** |
| Settlement | T+3 | **T+0** |
| **Cash in hand** | ₹7,86,650.68 | **₹9,34,188.36** |
| **Effective annual cost** | 13.76% | **13.73%** |

The 13.5% offer delivers **₹1,47,537.68 more cash, three days sooner — and is
effectively cheaper.** The 2.5-point headline advantage is entirely erased by
the lower advance rate and the flat fee.

A marketplace that sorts on rate doesn't give an incomplete answer here. It
gives the **wrong** one, confidently.

This is not a slide. It is [an executable test](frontend/src/lib/market/offer-math.test.ts)
with the figures transcribed from the analysis rather than from a previous run,
and it is seeded into the demo database. `npm test` proves it.

---

## The part most teams get wrong

Ranking by "overall suitability" needs to know what this supplier values
*today*. The naive answers are both bad: fixed weights are wrong for everyone,
and asking a supplier to self-report that they value settlement speed at 0.3
produces noise dressed as data.

**So we don't ask. We read their cash position.**

The platform ingests dated obligations from the supplier's ledger — payroll on
Friday, a steel invoice the same day — and derives two things:

- a **sufficiency floor**: the cash that actually solves the problem
- a **timing deadline**: the date it has to land by

These are **gates, not weights**. An offer failing either is *disqualified*,
not ranked lower. Cost only ranks the survivors.

Why that matters, from the seeded demo:

| Provider | Net cash | Settles | Effective cost | Outcome |
|---|---|---|---|---|
| Meridian Bank | ₹7,86,650.68 | T+3 | 13.76% | fails sufficiency **and** timing |
| Kaveri Capital | ₹8,65,763.84 | T+1 | **13.34%** | fails sufficiency |
| Rapidfin | ₹9,34,188.36 | T+0 | 13.73% | **clears both gates — wins** |

Kaveri is the **cheapest offer in the market** and it still loses, because it
delivers ₹8.65L against a ₹9,00,000 floor. A weighted score ranks it first. A
lexicographic gate says plainly: *this doesn't cover what you need.*

The system can also return **`NO_ACCEPTABLE_OFFER`**. A second seeded supplier
owes ₹21,00,000 in three days against a ₹22,00,000 invoice; nothing clears, and
the correct answer is "do not finance", not "here is the least bad option". A
market that always transacts is not exercising judgement.

---

## Quickstart

```bash
git clone https://github.com/Haise-727/LienRho && cd LienRho

# 1. Database — either the shared Supabase instance or a local one
docker compose up -d                     # Postgres :5432 + Redis :6379

# 2. App
cd frontend
npm install                              # postinstall generates the Prisma client
cp .env.example .env                     # then fill in DATABASE_URL / DIRECT_URL
npm run db:push && npm run db:seed       # 13 tables, then the synthetic market
npm run dev                              # http://localhost:3000
```

Verify it came up:

```bash
curl localhost:3000/api/db-health
# {"status":"ok","seeded":true,"ledgerBalanced":true, ...}

npm test                                 # 18 tests, including the worked example
```

---

## What's in the box

### Multi-attribute clearing

Deterministic scoring across advance rate, APR, fees, tenor and settlement
speed, ranked against derived supplier utility. Every figure comes from a
named function — [`offer-math.ts`](frontend/src/lib/market/offer-math.ts) in
integer paise, [`money.ts`](frontend/src/lib/money.ts) in `Decimal` for the
ledger.

### A Stitch-style double-entry ledger

[Stitch](https://www.stitch.co/) provides *"a programmable double-entry ledger
that records every movement of money in real time."* Ours models the two events
that have to be right: **Day 0 disbursement** and **Day 90 buyer repayment**.

One invariant, enforced rather than trusted: **every journal entry's postings
sum to zero**, checked inside the transaction that writes them. Entries are
immutable and keyed by a unique reference, so a retried disbursement returns
the existing entry instead of posting twice.

`GET /api/ledger/trial-balance` returns **500, not 200**, if the books don't
balance. A number you can't trust shouldn't arrive with a success code.

### Graded verification, not a boolean

`BUYER_ACCEPTED` → `LEDGER_VERIFIED` → `SUPPLIER_ASSERTED`. Providers price the
difference between these, and flattening them into a single "verified" flag
destroys the information that keeps the market from unravelling toward its
worst participants.

### Anti-double-financing

A unique `sha256(sellerTaxId, buyerTaxId, invoiceNumber)` on every invoice — a
database constraint, not a service. It stops the same invoice being financed
twice; a fabricated near-duplicate needs the 3-way match instead. The two
checks are complementary, and we say which does what.

### Agents that judge, never compute

Provider-side bidding, supplier advocacy and market clearing run as agents
(`ai/nexus/`). **No language model produces a rupee or a rate.** The model
chooses posture — aggressive, conservative, decline — and deterministic
functions compute every number, with each call recorded.

---

## Architecture

```
LienRho/
├─ frontend/              Next.js 16 full-stack — UI, API routes, Prisma, ledger
│  ├─ prisma/             schema (13 models), migrations, seed
│  └─ src/lib/
│     ├─ ledger/          double-entry engine — postEntry(), Day 0 / Day 90 flows
│     ├─ market/          scoring, gates, Pareto clearing (integer paise)
│     └─ money.ts         Decimal economics for the ledger
├─ ai/nexus/              NexusX multi-agent layer — supplier, lender, clearing
├─ docs/                  analysis and design (start at docs/README.md)
└─ backend/               ⚠️ legacy Python/FastAPI — superseded, see below
```

**Stack:** Next.js 16 · React 19 · Prisma 7 · PostgreSQL (Supabase) · Redis ·
Python agents · TypeScript throughout.

**Sponsors:** Stitch (double-entry ledger) · CodeCrafters (deterministic
matching, Redis locks) · NexusX (multi-agent coordination) · ElevenLabs (voice).

---

## Honest status

Judges deserve to know what's real. So:

**Working and verified**
- 13-model schema on Postgres, baseline migration, Aurora cutover path tested
- Double-entry ledger, balanced across 42 postings (trial balance ₹91,00,70,750)
- Supplier utility derived from real dated cash obligations
- Multi-attribute scoring with lexicographic gates and `NO_ACCEPTABLE_OFFER`
- 7 read routes + `POST /api/match`; 18 passing tests

**Simulated, and labelled as such**
- **No real money, no live provider integrations.** The capital market is
  synthetic — 4 providers with differentiated mandates. Competitive invoice
  discounting is regulated in India, and licensed TReDS platforms (RXIL,
  M1xchange, Invoicemart) already run multi-financier bidding. We are not
  claiming to have invented that.
- Provider agents currently quote from fixed mandates rather than pricing each
  invoice — a deliberate 2-hour simplification, tracked in [#19](../../issues/19).

**In flight**
- The home screen (`/`) still renders the previous product's collections queue
  and expects the legacy `backend/` on :8000. The marketplace surface is the
  API and the ledger. Track 4's replacement is in progress.
- `backend/` is the earlier receivables-decisioning build. Its risk model and
  cash forecast are the intellectual ancestors of the scoring here, but it is
  **not** on the critical path and is not needed to run the marketplace.

---

## What's actually novel

TReDS exists. So the claim has to be precise:

| Claim | Why it holds |
|---|---|
| **Multi-attribute clearing, not a rate auction** | Existing platforms bid principally on rate. Scoring advance rate, fees, speed and tenor against *derived* supplier utility is a different mechanism |
| **Utility inferred from real cash position** | We read dated obligations and derive urgency, instead of asking suppliers to self-report weights they cannot honestly quantify |
| **`NO_ACCEPTABLE_OFFER` as a first-class outcome** | The system declines to transact when nothing clears the floor |
| **Auditable determinism** | Every rupee traces to a named function, and the ledger balances or the endpoint fails |

---

## Problem Statement 5 — requirement traceability

Every requirement from the brief, and where it lives in this repo.

| # | Requirement | Where | Status |
|---|---|---|---|
| **R1** | Verified invoices presented as financing opportunities to multiple eligible providers | `Invoice.verificationTier` (3 graded tiers) + `FinancingOpportunity`; `GET /api/opportunities` | ✅ |
| **R2** | Intelligently match opportunities to providers on risk appetite, liquidity, capacity, supplier/buyer characteristics | `CapitalProvider` mandate (cost of funds, hurdle, ticket range, tenor, risk floor, concentration cap); `clearOpportunity()` | ✅ |
| **R3** | Competing offers differing across rate, tenor, advance rate, fees, settlement speed, repayment structure | `Bid` carries all six; 4 differentiated provider archetypes produce a genuine Pareto frontier | ✅ |
| **R4** | Evaluate on overall suitability, not lowest rate | `scoreOffers()` — lexicographic sufficiency/timing gates, then effective-cost ranking. **The cheapest offer loses in the seeded demo.** | ✅ |
| **R5** | Account for information asymmetry, incomplete information, changing capital, differing risk | Graded verification tiers disclosed to providers; `probabilityOfDefault` + `expectedDilutionPct`; `EscrowLock` tracks capital as it moves | ✅ |
| **R6** | Providers evaluate against risk-adjusted return requirements and portfolio constraints | `hurdleRate`, `costOfFunds`, `concentrationLimitPct`, `availableLiquidity`; mandates stay private from the scorer | ✅ |
| **R7** | Complete workflow: verification → risk → discovery → offers → matching → financing → settlement → learning | 13-state `OpportunityStatus` machine; ledger posts Day 0 and Day 90; `Match` records quoted-vs-delivered | ✅ core; learning loop partial |

**Annexure — agent autonomy.** Supplier, lender and market-clearing agents run
in `ai/nexus/`. Human involvement is reserved for exceptions, as the annexure
asks. The LLM chooses posture; deterministic functions compute every figure.

**Annexure — settlement reliability.** A match is not complete because an offer
was accepted. `Match` stores `quotedSettlementDays` against
`actualDisbursalDate`, and `expectedBuyerPayment` against
`actualBuyerPayment`, so a provider that quotes T+1 and delivers T+2 is
measurable — the input the learning loop needs.

---

## Team

**Track-parallel build, four people, one sprint.**

| Member | GitHub | Track |
|---|---|---|
| Ragav Hariharan | [@ragavhariharan](https://github.com/ragavhariharan) | **Track 1** — database, Prisma schema, Stitch double-entry ledger, API routes |
| Harsha Sakamuri | [@Haise-727](https://github.com/Haise-727) | **Track 2** — CodeCrafters matching engine, lexicographic scoring, Redis locks |
| Tharun | [@ConTresillo](https://github.com/ConTresillo) | **Track 3** — NexusX multi-agent layer, ElevenLabs voice |
| Yuvaraj | [@YUVARAJ-R-ai](https://github.com/YUVARAJ-R-ai) | **Track 4** — frontend UI, infrastructure, AWS migration plan |

Ownership boundaries are recorded in
[`docs/07-file-ownership.md`](docs/07-file-ownership.md), which is how four
people worked in one repo without colliding.

---

## Engineering practice

- **CI on every push and PR** — schema validation, typecheck, 18 tests, and a
  production build with no database, proving nothing touches Postgres at build
  time.
- **Secret scanning** — CI fails if a `.env` is ever committed or a connection
  string with an embedded password appears in tracked files.
- **Dependency audit** — advisory, so a transitive dev-only advisory is visible
  without blocking a merge.
- **Migrations, not `db push`** — `prisma/migrations/0_init` is baselined and
  `migrate deploy` is verified against an empty database, so the Aurora cutover
  in [`docs/08-aws-migration-plan.md`](docs/08-aws-migration-plan.md) needs no
  baselining work.

---

## Docs

[`docs/README.md`](docs/README.md) indexes everything in reading order. The two
worth your time:

- [`01-commerce-analysis.md`](docs/01-commerce-analysis.md) — how this market
  actually works: the economics, the worked example, auction design, the
  regulatory reality
- [`03-system-design.md`](docs/03-system-design.md) — architecture, agents, the
  full opportunity lifecycle
- [`09-database.md`](docs/09-database.md) — the data model in full: every table,
  the money conventions, the double-entry ledger mechanics, and the invariants

Track 1's integration guide lives at
[`frontend/prisma/README.md`](frontend/prisma/README.md).
