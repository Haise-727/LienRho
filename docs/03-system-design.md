# System design — «PROJECT»

Proposed architecture for PS-5. Design intent and rationale only; no code.

---

## Actors

| Actor | Role | Agency |
|---|---|---|
| **Supplier** | Holds receivables, needs working capital | Represented by an agent that infers their needs |
| **Capital provider** | Bank / NBFC / fund / fintech with deployable capital | One agent each, evaluating within its own mandate |
| **Buyer** | Owes the invoice | Passive — a verification target and a credit input, not a user |
| **Platform** | Verifies, assesses, routes, clears, settles, learns | The clearing agent plus deterministic engines |

---

## The allocation loop

PS-5 specifies it: *Invoice → Verify → Assess Risk → Discover Capital →
Generate Offers → Compare → Match → Finance → Settle → Learn.*

```
   ┌──────────── LEARN ◄─── SETTLE ◄─── FINANCE ◄─── MATCH
   │                                                    ▲
   ▼                                                    │
INVOICE ──► VERIFY ──► ASSESS RISK ──► DISCOVER ──► GENERATE ──► COMPARE
                                       CAPITAL       OFFERS
```

The feedback edge is what makes it a market rather than a pipeline: realised
settlement behaviour changes future routing, pricing, and scoring.

---

## Modules

### 1. Ingestion & Verification `(R1)`

Reads invoices from the accounting system of record and assigns a **graded
verification tier** — never a boolean:

| Tier | Basis | Effect on pricing |
|---|---|---|
| **Buyer-accepted** | Buyer has formally acknowledged the debt | Lowest uncertainty; priced closest to buyer credit |
| **Ledger-verified** | Present and consistent in the supplier's books, with delivery evidence | Moderate |
| **Supplier-asserted** | Claimed, unconfirmed | Highest uncertainty; many providers will decline outright |

Graded because providers price the difference; flattening it destroys the
information that makes the market efficient (`01-commerce-analysis.md` §8).

**Two concrete checks belong here, both cheap:**

- **Anti-double-financing.** Hash `(seller_tax_id, buyer_tax_id,
  invoice_number)`, reject on collision. A Postgres unique constraint, not a
  service — see `01-commerce-analysis.md` §8.5 for what it does and doesn't
  catch.
- **3-way match**, where the source data supports it: invoice vs. purchase
  order vs. proof of delivery. This is what actually earns an invoice the
  "ledger-verified" tier rather than "supplier-asserted" — a match across all
  three is a materially stronger claim than the invoice alone.

### 2. Risk Engine `(R5)`

Reuses the existing model, repurposed. Produces:

- probability of payment across time buckets → **PD**
- expected dilution (disputes, short payment) → informs **LGD**
- a **risk grade** and the confidence attached to it
- feature-level explanation, because providers need to see *why*

Must expose calibration quality alongside every estimate. A provider consuming
an uncalibrated PD is being misled, and will eventually price for that.

### 3. Supplier Utility Engine `(R4)` ← *the differentiator*

Derives what this supplier needs from observable cash position rather than
asking:

- **Sufficiency floor** — minimum net cash that solves the problem
- **Timing deadline** — the date by which it must land
- **Cost sensitivity** — how much price matters once the above are satisfied

Structured **lexicographically**: sufficiency and timing act as gates; cost
ranks the survivors. A weighted sum would let a cheap, slow, insufficient offer
outrank one that actually works — the exact failure PS-5 calls out.

### 4. Capital Provider Registry `(R2, R6)`

Each provider carries: cost of funds, risk appetite floor, available liquidity,
ticket range, tenor limits, sector preferences, concentration caps, hurdle rate,
and settlement capability.

Private by construction — a provider's mandate is never visible to other
providers, and the scoring engine must not read provider internals
(`01-commerce-analysis.md` §6).

### 5. Opportunity Router `(R2)`

Decides which providers see which opportunities. Two filters:

- **Eligibility** — hard constraints: ticket size, tenor, sector, risk floor,
  concentration headroom
- **Suitability** — soft ranking: would this plausibly clear their hurdle?

Routing everything to everyone is not a marketplace, it is a mailing list, and
it wastes provider attention — which is a real cost in the real version.

### 6. Offer Engine `(R3)`

Provider agents price within their mandates, producing offers that vary across
rate, advance rate, fees, tenor, settlement speed, recourse, and repayment
structure.

Multi-agent coordination runs the bidding — one agent per provider, evaluating
inside its own mandate — orchestrated with LangGraph, with model access through
LiteLLM. Neither is load-bearing for correctness: LangGraph sequences the work
and LiteLLM routes the call, while every figure comes from a deterministic
function below.

**The agent decides posture — aggressive, conservative, decline — and
deterministic functions compute every number.** This is the old tool boundary,
unchanged in principle and more consequential in effect: it protected a legal
filing before, and it protects priced capital and a settlement obligation now.

Concretely, an agent must never emit a rupee or a rate it derived itself. It
selects a posture; `lib/market/offer-math.ts` computes the figures; the call is
recorded. Bids are validated at the edge against `OfferSchema` before they enter
the market, because an LLM in the loop is exactly where the shape cannot be
assumed.

One trap worth restating here (see `01-commerce-analysis.md` §6): provider
pricing must be driven by each provider's own cost of funds and constraints, and
the scorer must not read those internals. If bids are generated by the logic that
scores them, the market is theatre and any matching result is circular.

### 7. Scoring & Comparison `(R4)`

Deterministic throughout. Computes effective cost, net cash, and arrival date
per offer, then ranks against the supplier's utility structure. Publishes the
rule so providers can bid efficiently.

ElevenLabs sits **downstream of this module**, not inside it: the CFO voice
cockpit and the audio deal explainer read already-computed scored offers. They
are a voice surface over existing data, not a decision-making capability — which
means they depend on this module working, and cannot substitute for it.

Must be able to return **no acceptable offer**.

### 8. Matching & Allocation `(R2, R6)`

Selects the winner, or splits across providers when no single one has the
liquidity or concentration headroom for the whole amount. Re-checks constraints
at allocation time, because a provider's position may have moved since it bid.

**Concurrency is a real correctness concern, not a scale concern.** Two
opportunities can legitimately try to draw down the same provider's remaining
liquidity or concentration headroom at once. The MVP answer doesn't need
Redis or distributed locking: a Postgres transaction that reads the provider's
committed capacity, checks headroom, and writes the allocation atomically is
sufficient at hackathon scale, and it's the same discipline already used
elsewhere (durable audit trail via Postgres, not an in-memory store that loses
state). Revisit only if a real throughput number ever demands it.

### 9. Settlement Tracker `(R7)` (Stitch Double-Entry Ledger)

**The state machine spans the whole opportunity, not just post-match:**

```
RECEIVED → VERIFIED → AUCTION_LIVE → MATCHED → DISBURSING → DISBURSED
  → AWAITING_BUYER → BUYER_PAID → RESERVE_RELEASED → CLOSED
                    ↘ DEFAULTED / DISPUTED (from AWAITING_BUYER)
```

**How the provider actually gets repaid:** the provider advances cash to the
supplier now; the buyer's original payment on the due date is redirected —
contractually, not necessarily technically — to the provider (directly, or via
an escrow-like holding step) rather than to the supplier, since the supplier
was already paid. The reserve (the un-advanced portion) releases to the
supplier only after that redirected payment clears. This is the mechanical
detail that makes "the provider gets repaid" concrete rather than assumed; it
belongs in the settlement design, not left implicit.

Failure branches: non-disbursement, late or short buyer payment, dispute
(matches the `DISPUTED` branch above and the 3-way-match failure case in
Module 1).

Records **quoted vs realised** at every step. That delta is the input to
learning.

### 10. Learning Loop `(R7)`

- provider reliability scores from quoted-vs-delivered settlement
- risk model recalibration against realised outcomes
- routing adjustments from which providers actually bid and win

Closes the loop and gives the "Learn" step something concrete to do rather than
being a diagram label.

---

## Agents

| Agent | Owns | Never does |
|---|---|---|
| **Verification** | Judging evidence quality, flagging inconsistency | Assert a fact the ledger doesn't support |
| **Supplier advocate** | Inferring needs, interpreting the cash position, selecting | Compute cost or accept a headline rate at face value |
| **Provider agent** (×N) | Evaluating fit and choosing pricing posture | Compute any rupee figure |
| **Clearing agent** | Running the auction, allocating, handling partial fills | Override the deterministic score |

All four sit behind the same boundary: **judgement is the model's; arithmetic is
the code's.**

---

## Data model — new entities

Alongside the existing Invoice / Customer / Payment:

| Entity | Key fields |
|---|---|
| **CapitalProvider** | liquidity, appetite, hurdle rate, ticket range, concentration caps, settlement capability |
| **FinancingOpportunity** | invoice, verification tier, risk grade, requested amount, supplier utility profile |
| **Offer** | provider, rate, advance rate, fees, tenor, settlement speed, recourse, structure, expiry |
| **ScoredOffer** | offer, net cash, effective cost, arrival date, utility score, rank, gate outcomes |
| **Match** | opportunity, winning offer(s), allocation split, constraint snapshot at allocation |
| **Settlement** | match, lifecycle state, quoted vs realised timings and amounts |
| **ProviderPerformance** | rolling reliability, realised-vs-quoted deltas, win rate |

Invoice gains: **buyer acceptance status** and **verification tier** — the two
fields that move pricing most.

---

## Boundaries worth stating

- **No real money, no live provider integrations.** A simulated market, labelled
  as one — Stitch mock fintech rails, an ElevenLabs WebRTC call simulator, a
  CodeCrafters matcher over synthetic providers. Competitive invoice discounting
  is a regulated activity in India (`01-commerce-analysis.md` §10); say plainly
  that this is a simulation rather than implying an operating market.
- **Deterministic finance.** Every figure from a named, recorded function.
- **Provider isolation.** Bids and mandates are private; this is a tenancy
  requirement, not a UI concern.
- **Fallback everywhere.** A dead LLM degrades the market; it never halts it.
- **Collections is out of scope.** Chasing, escalation, and statutory recovery
  belong to a different product.
