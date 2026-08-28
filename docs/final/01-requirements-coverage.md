# PS-5 requirements — what we built, and what we did not

Every claim below is either a file you can open or a figure measured from a run.
Where something is unbuilt or simulated, it says so in the same table as the
things that work. A submission that overclaims loses on the first probing
question; one that is precise about its own edges survives it.

---

## The seven Problem Requirements

| # | Requirement | Status | Where it lives |
|---|---|---|---|
| 1 | Verified invoices presented to multiple eligible providers | **Built** | `FinancingOpportunity` + `Invoice.verificationTier`, `GET /api/opportunities` |
| 2 | Intelligently match on risk appetite, liquidity, capacity, supplier/buyer characteristics | **Built** | `lib/market/allocate.ts`, `CapitalProvider` mandate fields |
| 3 | Competing offers differing across rate, tenor, advance rate, fees, settlement speed, repayment structure | **Built** | `model Bid` carries all six; four archetypes bid differently |
| 4 | Evaluate on overall suitability, not lowest rate | **Built — this is the core** | `lib/market/score.ts`, `offer-math.ts` |
| 5 | Account for information asymmetry, incomplete information, changing capital, differing risk | **Partial** | Graded verification tiers, private mandates, capacity re-read at clearing |
| 6 | Providers evaluate against risk-adjusted return and portfolio constraints | **Partial** | Constraints enforced at allocation; providers do not yet *price* dynamically |
| 7 | Complete workflow: verify → risk → discovery → offers → matching → financing → settlement → learning | **Built except learning** | 13-state lifecycle, double-entry ledger |

---

## Requirement 4 in detail — the one the problem statement singles out

> *"the most attractive financing option for a supplier may not be the offer with the lowest interest rate"*

This is the sentence the whole build answers, and it is answered with arithmetic
rather than a claim.

**Effective cost divides by net cash received**, not by the advance and not by
face value:

```
advance        = advanceRate x faceValue
discountCharge = advance x annualRate x tenorDays/365
netCash        = advance - discountCharge - fees
effectiveCost  = (discountCharge + fees) / netCash x 365/tenorDays
```

On the worked example, an **11.0%** offer is *dearer* than a **13.5%** one:

| | Meridian Bank | Rapidfin |
|---|---|---|
| Headline rate | **11.0%** | 13.5% |
| Advance rate | 80% | 95% |
| Flat fee | ₹2,500 | ₹0 |
| Settlement | T+3 | T+0 |
| **Cash to supplier** | ₹7,86,650.68 | **₹9,34,188.36** |
| **True cost** | **13.76%** | **13.73%** |

Two structural reasons: the fee is flat and therefore regressive, and you pay
for the money you actually received.

### Beyond comparison — gates, not weights

The requirement says *suitability*, not *a better ranking*. So the engine does
not score-and-sort. Sufficiency and timing are **gates**; cost ranks only what
survives them.

A live clearing run:

| Provider | Cash delivered | True cost | Lands | Outcome |
|---|---|---|---|---|
| Meridian Bank | ₹7,86,650.68 | 13.76% | 02 Sep | short ₹1.13L, three days late |
| **Rapidfin** | **₹9,34,188.36** | **13.73%** | 28 Aug | **MATCHED** |
| Kaveri Capital | ₹8,65,763.84 | **13.34%** | 31 Aug | cheapest, still disqualified |

**Kaveri is the cheapest offer in the market and it loses.** It delivers ₹8.66L
against ₹9L needed and arrives a day late. A weighted score ranks it *first*. A
gate excludes it. That distinction is the product.

### Measured across 5000 invoices, not one example

One example can be dismissed as the case we built to win. So the engine was run
across a generated corpus of 5000 invoices (2613 outstanding, 2472 cleared):

| | 280-invoice run | **5000-invoice run** |
|---|---|---|
| Gates changed the winner vs price-ranking | 12.9% | **13.5%** |
| Cheapest offer disqualified | 34.2% | **37.9%** |
| No acceptable offer | 21.3% | **24.4%** |
| Median winning effective cost | 18.10% | 17.08% |

The figures barely moved across an 18x sample increase, which is the point: at
280 samples the confidence interval is roughly ±5.6pp, at 2472 about ±1.9pp.
These are measurements, not impressions.

**One deal in eight goes to a different lender than price-ranking would pick.**

Reproduce: `npx tsx scripts/corpus/analyse.ts`

---

## Requirement 7 — the lifecycle

```
RECEIVED → VERIFIED → AUCTION_LIVE → MATCHED → DISBURSING → DISBURSED
  → AWAITING_BUYER → BUYER_PAID → RESERVE_RELEASED → CLOSED
                    ↘ NO_MATCH / DEFAULTED / DISPUTED
```

`NO_MATCH` is a first-class outcome. If nothing clears the supplier's gates the
correct answer is *do not finance this*, not *here is the least bad option*. A
market that always transacts is not exercising judgement — and it fires on
**24.4%** of the corpus.

**Settlement is double-entry**, which is what makes "financing complete" mean
something more than "an offer was accepted":

- **Day 0** — provider advances; supplier receives net of discount and fee; a reserve is held
- **Day T** — buyer pays, contractually redirected to the provider; only once the provider is whole does the reserve release to the supplier

Every movement is a balanced journal entry. `GET /api/ledger/trial-balance`
proves the books balance.

**Learning is the unbuilt part of requirement 7.** `CapitalProvider.reliabilityScore`
exists and defaults to 1.0; nothing updates it from realised settlement
behaviour yet. Stated plainly rather than implied.

---

## Annexure constraints

| Constraint | Status | Note |
|---|---|---|
| **Agent autonomy** | Partial | Supplier, lender and clearing agents run on LangGraph via LiteLLM. Posture is chosen by a model; **every figure is computed by a deterministic function**. |
| **Invoice verification** | **Built** | Three graded tiers, never a boolean — providers price the difference. Anti-double-financing by invoice fingerprint. |
| **Capital provider matching** | **Built** | Liquidity, ticket range, tenor limits, risk floor, buyer concentration all enforced at allocation |
| **Offer evaluation** | **Built** | Six dimensions, ranked on effective cost after gates |
| **Risk & information asymmetry** | Partial | Graded tiers and private mandates; PD is seeded rather than modelled |
| **Supplier outcomes** | **Built** | Cost, cash received, settlement speed, tenor and fees considered together |
| **Capital provider objectives** | Partial | Constraints enforced; dynamic risk-based pricing not yet built |
| **Dynamic marketplace** | **Built** | Capacity re-read at clearing time, not trusted from bid time |
| **Settlement reliability** | **Built** | A match is not complete on acceptance — the ledger must balance and the reserve release must post |

---

## What we deliberately did not build

Naming these is not a weakness in the submission; being caught not knowing them
would be.

1. **Providers do not price dynamically.** Bids come from four frozen archetype
   mandates. They compete and differ — which is what produces a real frontier —
   but no provider computes `PD x LGD x exposure` against a hurdle rate per
   invoice. Say "each provider has fixed terms representing its archetype",
   never "agents price this deal".

2. **No learning loop.** `reliabilityScore` is a column nothing writes to.

3. **Synthetic invoices.** The corpus is generated. What is **real** is the
   ingestion path: it is emitted as Tally XML and parsed by the actual
   `TallyConnector` in `backend/app/connectors/tally/`, so a genuine Tally export
   would drop in unchanged. We attempted real Tally files; the format is
   undocumented binary and unreadable without Tally itself.

4. **Allocation concurrency is guarded but unproven against Postgres.**
   `commit.ts` uses a conditional update so two deals cannot draw the same
   rupees. The tests argue the shape; no test runs concurrent transactions
   against a real database.

5. **The lender dashboard's deal stream is not wired.** It displays an invented
   agent bid. Issues #50–#52. **Do not demo that screen.**
