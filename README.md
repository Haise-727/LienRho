<div align="center">

# ⚖️ LIENRHO

### A competitive capital market for supply-chain working capital

**The cheapest offer is not the best offer.**
Every marketplace ranks financing by rate.
LIENRHO asks whether the money actually solves the problem.

![next.js](https://img.shields.io/badge/next.js-16-000000?logo=nextdotjs&logoColor=white)
![react](https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=black)
![typescript](https://img.shields.io/badge/typescript-5-3178C6?logo=typescript&logoColor=white)
![postgres](https://img.shields.io/badge/postgres-16-4169E1?logo=postgresql&logoColor=white)
![prisma](https://img.shields.io/badge/prisma-7-2D3748?logo=prisma&logoColor=white)
![python](https://img.shields.io/badge/python-3.12+-3776AB?logo=python&logoColor=white)
![agents](https://img.shields.io/badge/agents-LangGraph-1C3C3C)
![llm](https://img.shields.io/badge/llm-LiteLLM-6B46C1)

[Quickstart](#quickstart) · [The Problem](#the-problem) · [How It Works](#what-lienrho-does) · [The Numbers](#the-numbers) · [Architecture](#architecture) · [Scope](#scope) · [Docs](#requirements--design-docs)

**CSI ORIGIN 2026 · Problem Statement 5**

</div>

---

A supplier with an accepted invoice presents it to a market. Banks, NBFCs, funds and fintechs compete to finance it. LIENRHO decides which offer is genuinely best **for that supplier's actual situation** — then clears the trade against a double-entry ledger.

> Given a verified invoice, four competing offers, and what this supplier actually needs — which financing outcome is right, and can we defend the answer?

It is **not** a loan-comparison site. The problem statement is explicit that displaying competing offers does not solve the problem, because *"the most attractive financing option for a supplier may not be the offer with the lowest interest rate."*

> **Status: working end to end.** Live against Postgres — invoices ingest through a real Tally parser, four provider archetypes bid, the engine gates and ranks, allocation re-checks capacity atomically, and settlement posts balanced journal entries. Verified: `tsc` clean · 36 frontend tests · 343 backend tests · build compiles · ledger balances.
> Providers bid **fixed archetype terms** rather than pricing each invoice, and the learning loop is not built. Both are stated plainly in [`docs/final/01-requirements-coverage.md`](docs/final/01-requirements-coverage.md).

## Quickstart

```bash
cd frontend
cp .env.example .env      # fill in DATABASE_URL and DIRECT_URL
npm install               # postinstall runs prisma generate
npm run dev               # http://localhost:3000
```

`DATABASE_URL` uses port **6543** (pooler, runtime). `DIRECT_URL` uses **5432** (direct — DDL cannot run through the pooler).

Walk the whole market from the API, in a terminal:

```bash
./scripts/demo.sh
```

Everything it prints is read live. Nothing is hardcoded.

**Checks:**

```bash
cd frontend && npx tsc --noEmit && npm test && npm run build
cd backend  && uv run pytest -q
```

## The problem

A supplier holds a ₹10,00,000 invoice their buyer has already accepted. Payment lands in 45 days. Payroll is Friday.

Today they call one bank and take what that bank offers. Meanwhile banks, NBFCs and funds hold deployable capital and cannot see the opportunity. PS-5 calls this the structural mismatch — and notes that simply showing more offers does not fix it:

- The **11.0%** offer can be dearer than the **13.5%** one, once advance rate and fees are counted
- An offer can be cheapest and still fail, if it delivers too little or arrives too late
- Providers differ in liquidity, appetite, ticket size and concentration limits, so an offer that suits one supplier is unfundable for another

The missing capability is a market that **assesses, gates, ranks and clears** — not one that sorts a list.

## What LIENRHO does

```
Verified invoice  (graded tier: buyer-accepted / ledger-verified / supplier-asserted)
        │
        ▼
  Supplier utility  ← DERIVED from cash position, never asked for
        │             cash on hand, dated obligations, buffer → floor + deadline
        ▼
  Provider bids  (four archetypes, each pricing from its own private mandate)
        │
        ▼
  ┌─ SUFFICIENCY GATE ─ does it deliver enough?  ─┐
  │                                               │  fail → DISQUALIFIED
  └─ TIMING GATE ────── does it arrive in time? ──┘        with a readable reason
        │
        ▼
  Effective-cost ranking  (charges ÷ NET CASH RECEIVED, annualised)
        │
        ▼
  Allocation  (liquidity, min ticket, buyer concentration — re-read, not trusted)
        │             no single provider big enough → syndicate across several
        ▼
  Atomic commit  (conditional update: two deals cannot draw the same rupees)
        │
        ▼
  Double-entry settlement  (Day 0 advance + reserve → buyer pays → reserve releases)
```

### The one rule the whole architecture is built around

**No language model computes a financial figure. Anywhere.**

A model chooses *posture* — aggressive, conservative, decline. Every rupee and every rate comes from a named deterministic function. `llm.complete()` returns `None` on any failure and **every** caller has a deterministic fallback: the market degrades, it never halts.

This protected a legal filing in a previous build. Here it protects priced capital and a settlement obligation, so the bar is higher — the audit trail *is* the product, and "the model said so" is not an audit trail.

### The second rule: gates, not weights

Sufficiency and timing **disqualify**. Cost ranks only what survives.

A weighted score would let a cheap, slow, insufficient offer outrank one that actually makes payroll — which is precisely the failure PS-5 describes. An offer that cannot solve the supplier's problem is not *worse*; it is **out**.

### The third rule: derived, not elicited

Nobody can honestly report that they value settlement speed at 0.3. Elicited weights are noise dressed as data.

We read the supplier's cash position — what is in the bank, what is owed and when, the buffer the business will not go below — and walk forward to the first breach. **That date is the deadline; the gap is the floor.**

## The numbers

The worked example, computed live:

| | Meridian Bank | Rapidfin | Kaveri Capital |
|---|---|---|---|
| Headline rate | **11.0%** | 13.5% | 12.2% |
| Advance rate | 80% | 95% | 88% |
| Flat fee | ₹2,500 | ₹0 | ₹1,000 |
| Settlement | T+3 | T+0 | T+1 |
| **Cash to supplier** | ₹7,86,650.68 | **₹9,34,188.36** | ₹8,65,763.84 |
| **True cost** | 13.76% | 13.73% | **13.34%** |
| Outcome | short ₹1.13L, 3 days late | ✅ **MATCHED** | cheapest — still disqualified |

**Kaveri is the cheapest offer in the market and it loses.** ₹8.66L against ₹9L needed, a day late. Any marketplace ranking by price recommends it. A weighted score ranks it *first*.

### Measured across 5000 invoices, not one example

| | 280 invoices | **5000 invoices** |
|---|---|---|
| Gates changed the winner vs price-ranking | 12.9% | **13.5%** |
| Cheapest offer disqualified | 34.2% | **37.9%** |
| No acceptable offer — *do not finance* | 21.3% | **24.4%** |
| Median winning effective cost | 18.10% | 17.08% |

The figures barely moved across an 18× sample increase. **One deal in eight goes to a different lender than price-ranking would pick.**

```bash
npx tsx scripts/corpus/analyse.ts
```

## Architecture

One Next.js deployable for UI and API, a Python agent package, and a retired FastAPI service kept for its Tally connector and test suite.

```
Web Client (Next.js 16, React 19)
  → LIENRHO API (Next.js route handlers)
      lib/market/        — THE MATCHING ENGINE (pure, DB-free, 36 tests)
        offer-math.ts      four formulas, one implementation
        utility.ts         derives gates from the cash position
        score.ts           lexicographic gates → cost ranking
        pareto.ts          non-dominated frontier + degeneracy guard
        allocate.ts        capacity, tickets, concentration, syndication
        commit.ts          atomic allocation under one transaction
      lib/ledger/        — double-entry posting
      app/api/           — match · opportunities · providers · ledger · voice
  → PostgreSQL (Supabase) — invoices, bids, matches, journal entries, escrow
  ↕ ai/nexus/ (Python)   — LangGraph agents over LiteLLM; posture only
```

**Money is integer paise. Rates are integer basis points.** The worked example turns on a **3 basis point** gap, and IEEE-754 drift across advance → discount → net → effective-cost is the same order of magnitude. A float would let rounding noise pick the winner.

### The degeneracy guard — the check that caught our own bug

If one offer beats every other on cash, cost **and** speed at once, the bid set is broken rather than the market competitive. No arithmetic test catches this, because every individual calculation is correct.

It fired immediately against our own generator: the fintech had the highest advance, no fee, instant settlement *and* a spread below the bank's — **210 of 279 opportunities flagged**. Not a market; a price list with one entry. After giving the fintech a convenience premium and providers minimum tickets, four-offer sets went from **71/274 degenerate to 0/257**.

## Scope

**Built:**
- Graded invoice verification (three tiers, never a boolean) + anti-double-financing fingerprint
- Supplier utility derived from cash position — sufficiency floor and timing deadline
- Four provider archetypes bidding across rate, advance, fees, tenor, settlement, recourse
- Lexicographic gates + effective-cost ranking, with `NO_ACCEPTABLE_OFFER` as a first-class outcome
- Pareto frontier and degeneracy guard
- Capacity-aware allocation with syndication and atomic commit
- Stitch-style double-entry ledger, Day 0 through reserve release
- LangGraph agents over LiteLLM; ElevenLabs voice surfaces
- Tally XML ingestion through a real connector

**Not built, deliberately:**
- **Dynamic provider pricing** — bids are frozen archetype terms, not `PD × LGD × exposure` against a hurdle rate
- **The learning loop** — `reliabilityScore` exists; nothing writes to it
- **Real invoice data** — the corpus is synthetic; the *parser and engine* are real
- **Proven concurrency** — the allocation guard is argued in tests, not exercised against concurrent Postgres transactions

## Repository layout

```
.
├── frontend/                    — Next.js app: UI + all API surface
│   ├── prisma/
│   │   ├── schema.prisma        — marketplace + ledger models
│   │   └── seed.ts              — synthetic market, reproduces the worked example
│   ├── scripts/seed-corpus.ts   — curated 48-opportunity board
│   └── src/
│       ├── app/api/             — match · opportunities · providers · ledger
│       ├── app/dashboard/       — supplier and lender views
│       ├── lib/market/          — the matching engine
│       └── lib/ledger/          — double-entry posting
├── ai/nexus/                    — LangGraph agents (supplier · lender · clearing)
├── backend/                     — FastAPI: Tally connector, 343 tests
│   └── app/connectors/tally/    — the real XML parser the corpus runs through
├── scripts/
│   ├── corpus/generate_tally.py — synthetic corpus as Tally XML
│   ├── corpus/analyse.ts        — clears 5000 invoices, reports the statistics
│   └── demo.sh                  — walks the market from the API
└── docs/
    ├── final/                   — submission: coverage, demo script, architecture
    └── tracks/                  — per-track working notes
```

## Requirements & design docs

| Doc | Purpose |
|---|---|
| [`docs/final/00-README.md`](docs/final/00-README.md) | **Start here** — the claim, the thirty-second version, verified state |
| [`docs/final/01-requirements-coverage.md`](docs/final/01-requirements-coverage.md) | Every PS-5 requirement mapped to a file or a measured figure, including what we did not build |
| [`docs/final/02-demo-script.md`](docs/final/02-demo-script.md) | Four-minute demo, and the questions you will be asked |
| [`docs/01-commerce-analysis.md`](docs/01-commerce-analysis.md) | The commerce reasoning the engine implements — why effective cost, why gates |
| [`docs/03-system-design.md`](docs/03-system-design.md) | Module-by-module design and the tool boundary |
| [`docs/10-handoff.md`](docs/10-handoff.md) | Entry point for a new contributor: architecture, conventions, known traps |
| [`docs/09-database.md`](docs/09-database.md) | Schema reference |

---

<div align="center">

**Built for CSI ORIGIN 2026 · Problem Statement 5**

*A market that always transacts is not exercising judgement.*

</div>
