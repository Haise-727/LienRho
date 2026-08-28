# Handoff — how LienRho works and how we work on it

Written for someone opening a fresh session on this repo with no prior context.
Read this first; it tells you what the project is, what is already true, where
everything lives, and what to do next.

Everything below is measured against the repository, not remembered. Where a
claim is unverified, it says so.

---

## 1. What this is, in one paragraph

LienRho is an agentic capital marketplace for supply-chain working capital
(CSI ORIGIN 2026, Problem Statement 5). A supplier with an unpaid but accepted
invoice lists it; multiple capital providers bid to buy it at a discount; the
platform decides which offer is genuinely best **for that supplier's actual
situation** and clears the trade against a double-entry ledger.

The interesting part is the deciding. Everything else is plumbing.

---

## 2. The thesis — read this before changing any pricing code

Three parties:

| Party | Example in our seed | What they want |
|---|---|---|
| **Supplier** (seller) | Vertex Components Pvt Ltd | Cash now, not in 45 days |
| **Buyer** | Bharat Auto Ltd | Nothing — they just accept the invoice |
| **Capital provider** (the "banker") | Meridian Bank, Rapidfin, Kaveri Capital, Ashwin Credit Fund | Yield on idle capital |

Vertex delivers ₹10,00,000 of parts to Bharat Auto on 45-day terms. Bharat Auto
accepts the invoice — which is what makes it financeable, because it converts
"Vertex claims it is owed" into "Bharat Auto agrees it owes". Vertex now holds a
near-certain ₹10L asset and still cannot make payroll on Friday.

### Why headline rate is the wrong comparator

Two offers on the same invoice:

|  | Meridian Bank | Rapidfin |
|---|---|---|
| Headline rate | **11.0%** | 13.5% |
| Advance rate | 80% | 95% |
| Flat fee | ₹2,500 | ₹0 |
| Settlement | T+3 | T+0 |
| **Cash to supplier** | ₹7,86,650.68 | **₹9,34,188.36** |
| **True cost** | **13.76%** | **13.73%** |

The 11.0% offer is *dearer* than the 13.5% one. Two reasons, both structural:

1. **The fee is flat**, so it is regressive — it eats a far bigger share of a
   small advance than a large one.
2. **True cost divides by net cash received**, not by the advance and not by
   face value. You pay for the money you actually got.

```
advance         = advanceRate x faceValue
discountCharge  = advance x annualRate x tenorDays/365
netCash         = advance - discountCharge - fees
effectiveCost   = (discountCharge + fees) / netCash x 365/tenorDays
                                            ^^^^^^^
                                     this denominator is the whole argument
```

**If you ever see the denominator become `advance`, that is a bug.** It
understates true cost by roughly 20–25bp on our data and it has already
happened once (see §9).

### Why ranking is not enough — gates, not weights

Vertex needs **₹9,00,000 by Friday**. That is not a preference, it is a
constraint. So the engine does not score-and-sort. It **gates first**:

- **Sufficiency gate** — does this offer deliver at least the floor?
- **Timing gate** — does the cash land on or before the deadline?
- Only offers passing *both* are ranked, by effective cost.

A live clearing run against the shared database, showing why this matters:

| Provider | Cash delivered | True cost | Lands | Outcome |
|---|---|---|---|---|
| Meridian Bank | ₹7,86,650.68 | 13.76% | 02 Sep | short ₹1.13L, three days late |
| **Rapidfin** | **₹9,34,188.36** | **13.73%** | 28 Aug | **MATCHED** |
| Kaveri Capital | ₹8,65,763.84 | 13.34% | 31 Aug | cheapest, still disqualified |

**Kaveri is the cheapest offer in the market and it loses.** It delivers ₹8.66L
against ₹9L needed and arrives a day late. Any marketplace that ranks by price
recommends Kaveri. A weighted score would rank it *first*. A gate excludes it.

That row is the pitch. Protect it.

### Where the floor and deadline come from

Not from asking the supplier. Nobody can honestly report that they value
settlement speed at 0.3 — elicited weights are noise dressed as data.

They are **derived** from the supplier's cash position: current cash, dated
obligations, and the buffer the business will not go below. The engine walks
obligations in date order, runs the balance down, and stops at the first breach.
That date is the deadline; the gap is the floor.

In the live data the floor is ₹9,00,000 by 30 August, attributed to
"September payroll". `FinancingOpportunity.sufficiencyFloor` and
`timingDeadline` are **null in the database by design** — the derivation is real,
so the columns stay empty. See §9 for the bug this once caused.

### `NO_ACCEPTABLE_OFFER` is a success, not an error

If nothing clears the gates, the correct answer is "do not finance this", not
"here is the least bad option". A market that always transacts is not exercising
judgement. Callers must branch on `status`, never assume a winner exists.

---

## 3. Where everything lives

```
LienRho/
├── frontend/                  Next.js 16 · React 19 · Tailwind 4 · Prisma 7
│   ├── prisma/
│   │   ├── schema.prisma      the whole data model
│   │   └── seed.ts            synthetic market, reproduces the worked example
│   └── src/
│       ├── app/api/           all HTTP surface
│       ├── lib/market/        THE MATCHING ENGINE  ← Track 2
│       ├── lib/ledger/        double-entry posting
│       ├── lib/db.ts          Prisma singleton
│       └── lib/money.ts       Decimal money for the ledger
├── ai/nexus/                  the agents (Python, LiteLLM)
├── backend/                   legacy FastAPI — see §5
├── docs/                      you are here
└── scripts/demo.sh            walks the whole market from the API
```

### The matching engine, file by file

Everything in `frontend/src/lib/market/`. This is the part that must not drift.

| File | Responsibility |
|---|---|
| `types.ts` | The cross-track contract. **Zero imports by design** so every track can code against it without a database. |
| `money.ts` | Integer paise, basis points, UTC + business-day date maths. |
| `offer-math.ts` | The four formulas. One implementation, one entry point. |
| `utility.ts` | Derives the gates from the cash position. |
| `score.ts` | Lexicographic gates, then cost ranking. |
| `clear.ts` | `clearOpportunity()` — the whole pipeline, no DB import. |
| `prisma-adapter.ts` | Track 1's `Decimal` rows → integer paise/bps. |
| `agent-adapter.ts` | The agents' `LenderBid` → `Offer`. |
| `schemas.ts` | Zod validation at the two untrusted boundaries. |

**Money is integer paise. Rates are integer basis points.** Not float rupees.
The worked example turns on a 3bp gap and IEEE-754 drift is the same order of
magnitude, so a float would let rounding noise pick the winner.

### API surface

| Route | Purpose |
|---|---|
| `POST /api/match` | **The decision point.** Everything upstream is bookkeeping. |
| `GET /api/opportunities`, `/[id]` | Listings, with bids and ledger trail |
| `GET /api/providers` | Public view — mandates deliberately absent |
| `GET /api/ledger/entries`, `/trial-balance` | The audit trail |
| `GET /api/db-health` | Liveness |

`POST /api/match` accepts two shapes on purpose:

```jsonc
// UI — bids read from Postgres
{ "opportunityId": "...", "urgencyNudgeBps": 0 }

// Agents — bids supplied inline, nothing persisted
{ "opportunity_id": "...", "bids": [ /* LenderBid[] */ ] }
```

Both converge on `scoreOffers`, so there is exactly one ranking implementation.

---

## 4. The money flow

**Day 0.** Provider advances cash. At 95%:

```
Advance          ₹9,50,000
Discount charge   −₹15,811.64
Fee                    −₹0
─────────────────────────────
Supplier receives ₹9,34,188.36   same day
Reserve held         ₹50,000     (face − advance)
```

**Day 45.** Buyer pays ₹10,00,000, contractually redirected to the provider. The
provider is made whole, *then* the reserve releases to the supplier.

The reserve is what makes "the provider gets repaid" concrete — the supplier was
already paid, so the buyer's payment is not theirs to keep until the provider is
square. Every movement is a balanced journal entry.

---

## 5. Decisions already made — do not relitigate

| Decision | Status |
|---|---|
| Next.js full-stack, Prisma, Postgres (Supabase) | settled |
| Lexicographic gates, not a weighted sum | settled — it is the product |
| Money as integer paise, rates as integer bps | settled |
| `NO_ACCEPTABLE_OFFER` is a status, not an error | settled |
| No LLM computes a financial figure | **non-negotiable** |
| **NexusX dropped; LiteLLM retained** | **new — see below** |
| Python FastAPI backend is legacy | see below |

### The LiteLLM change

**We are dropping NexusX as a sponsor integration. LiteLLM stays — it is what
the code already used for model access.**

The important thing to understand: **this is a claims change, not an
architecture change.** The code already calls LiteLLM —
`ai/nexus/llm.py` does `from litellm import completion` behind a single seam.
"NexusX" was a label on the multi-agent coordination, not an implementation.

What actually needs doing:

1. **Docs and pitch language.** Remove NexusX from `docs/03-system-design.md`,
   `docs/05-decisions-needed.md`, `docs/README.md` and the track docs. Describe
   the agent layer as *multi-agent coordination on LangGraph, with model access
   through LiteLLM*.
2. **Package naming, optionally.** `ai/nexus/` and the `nexus` prefix appear
   across ~12 Python files and several docs. Renaming is mechanical but touches
   a lot; it is cosmetic and can wait. Do the docs first.
3. **Nothing in `frontend/` references NexusX** except doc text — the matching
   engine is unaffected.

Keep the discipline that made the agent layer sound: the model chooses
*posture*, deterministic functions compute every number, and `llm.complete()`
returns `None` on any failure with a deterministic fallback at every call site.

### The legacy backend

`backend/` is the Python FastAPI service transferred from the previous product.
It still holds 342 passing tests and the agent test suite. All *new* API surface
goes in Next.js route handlers. Do not add endpoints to `backend/`.

---

## 6. Running it

```bash
cd frontend
cp .env.example .env      # fill in DATABASE_URL and DIRECT_URL
npm install               # postinstall runs prisma generate
npm run dev
```

`DATABASE_URL` uses port **6543** (pooler, runtime). `DIRECT_URL` uses **5432**
(direct, needed for DDL, migrations and seeding). Both come from
Supabase → Project → Connect → ORMs → Prisma.

### Checks — run all three before pushing

```bash
cd frontend
npx tsc --noEmit                          # must be clean
npm test                                  # 18 engine tests
npm run build                             # must compile

cd ../backend && uv run pytest -q         # 342 passed, 24 skipped
```

CI runs these on every branch. It has been green throughout.

### See the whole market end to end

```bash
# terminal 1
cd frontend && npm run dev
# terminal 2
./scripts/demo.sh
```

Everything it prints is read from the API. Nothing is hardcoded.

### Seeding

`npm run db:seed` is **destructive** and refuses to run against the shared
database without `SEED_FORCE`. The shared database is already seeded — you
almost certainly do not need this.

---

## 7. How we work

### Git

`feature branch → dev → main`. Never commit straight to `main`.

The repo is configured with `pull.rebase=true` and `rebase.autoStash=true`, so
`git pull && git push` always works. If a push is rejected, you are behind —
pull, do not force.

### Commits

- Many small atomic commits, not one large one.
- The commit body explains **why**, including constraints and rejected
  alternatives. Someone reads this history to understand the reasoning.
- **Never add an AI co-author trailer.**

### Comments

Code carries comments explaining reasoning — why a choice was made, what
constraint forced it, what breaks if it changes. Not restatements of the code.

### File ownership

`docs/07-file-ownership.md` maps who owns which paths. The rule that matters
most: **adapters live on the consumer side.** If you need another area's data in
a different shape, convert it in *your* files rather than asking them to change
theirs.

**Do not add a second implementation of anything financial.** This has already
happened twice.

---

## 8. What is done

| Area | State |
|---|---|
| Schema, ledger, seed, read routes | done, on `main` |
| Matching engine + `POST /api/match` | done, **verified end to end against live Supabase** |
| Agents, matching seam, HTTP client | done, 342 tests |
| CI | green on every branch |
| Frontend UI | in progress — see §9 |

The engine reproduces `docs/01-commerce-analysis.md` §3 exactly, and the
expected values in the tests are transcribed from the doc rather than captured
from a run — so the tests cannot merely agree with the code.

---

## 9. Known defects and traps

### Critical — the UI computes its own numbers

`frontend/src/lib/scoring.ts` (Track 4 branch) recomputes the finance in the
browser and **never calls `/api/match`**. Worse, its effective cost divides by
the advance rather than net cash, so every figure understates true cost:

| Provider | API | UI |
|---|---|---|
| Meridian | 13.76% | 13.53% |
| Rapidfin | 13.73% | 13.50% |
| Kaveri | 13.34% | 13.12% |

The fix is a deletion, not a rewrite: call the API, render `scoredOffers`. Every
figure is precomputed, including plain-English gate reasons. Keep the
components and the theme; drop the arithmetic.

### Critical — agent provider fees are 10x too large

`ai/nexus/providers.py` has `fees_paise = 2_500_000` commented as "₹2,500".
That is ₹25,000. A rupee is 100 paise. All three profiles are wrong by the same
factor, and fees feed effective cost directly. Issue #17.

### The trap that already bit: silent gate degradation

`sufficiencyFloor` and `timingDeadline` are null in the database *by design*.
If a caller does not join `cashPosition`, `clearOpportunity` falls back to those
null columns, returns `unconstrained`, and **silently degrades to cost-only
ranking** — the exact behaviour this project argues against, with no error.

Fixed in `9c96ef8`. If gates ever stop firing, check the join first.

### Demos must run the real engine

`MockMatchingClient` ranks on APR, has no gates, and can never return
`NO_ACCEPTABLE_OFFER`. On our own worked example it picks the *wrong* winner.
Anything demonstrated must run `NEXUS_MATCHING_MODE=http`.

### Two economics implementations exist

`lib/money.ts` (`quoteEconomics`, Decimal, for the ledger) and
`lib/market/offer-math.ts` (integer paise, for scoring). They agree today.
A cross-check test asserting they stay in agreement is open — issue #11.

### Providers do not actually price

Bids are constants copied from a frozen dataclass. Every provider quotes
identically for every invoice and none ever declines. Fine for the timebox —
but do not describe them as "pricing within their mandates", which is an
overclaim. Issue #19.

---

## 10. What to do next, in order

1. **Redirect the UI to `/api/match`** — before more components are built on
   numbers that disagree with the API.
2. **Fix the fee constants** (#17) — one line, on the demo path.
3. **Update docs**, dropping NexusX language (§5).
4. **Pareto frontier + degeneracy guard** — makes the "Pareto matching" claim
   honest, and the guard fails loudly when one offer dominates every other on
   every axis, which means the bid generator is broken.
5. **Allocation** — capacity re-check inside a transaction and partial fill
   across providers when no single provider has the headroom. Ranking says who
   *should* win; allocation checks whether they still *can*.
6. **Decide the urgency question** (#18) — supplier urgency is computed and
   never sent to the matcher. Either wire it or declare it narrative. Both are
   fine; the current state is neither.

---

## 11. Starting a fresh session

Paste this:

> This is LienRho — CSI ORIGIN 2026, Problem Statement 5: an agentic capital
> marketplace for supply-chain working capital financing.
>
> Read `docs/10-handoff.md` first — it is the entry point and covers the thesis,
> the architecture, what is verified, and the known defects. Then
> `docs/01-commerce-analysis.md` §2–§4 for the commerce reasoning the matching
> engine implements, and `docs/07-file-ownership.md` for who owns what.
>
> Check GitHub for what has changed since:
> `gh issue list --repo Haise-727/LienRho --state open` and
> `gh pr list --repo Haise-727/LienRho`.
>
> Then verify the base still works:
> ```
> cd frontend && npm install && npx tsc --noEmit && npm test && npm run build
> cd ../backend && uv run pytest -q
> ```
> Expect 18 engine tests and 342 backend passing.
>
> Commit rules for my work: many small atomic commits, bodies that explain why,
> code comments that explain reasoning, **never an AI co-author trailer**, and
> commit locally — I push myself.
>
> Tell me what you found and what you would pick up before writing any code.

---

## 12. The one thing to protect

If you change nothing else correctly, keep this true:

**A cheaper offer that cannot solve the supplier's problem is disqualified, not
ranked lower — and the system can say, in a sentence a human reads, exactly why.**

Everything else in this repository exists to make that sentence defensible.
