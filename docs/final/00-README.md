# LienRho — final submission

**PS-5: Building a Competitive Capital Market for Supply-Chain Working Capital**
CSI ORIGIN 2026

---

## The one-sentence claim

A supplier's best financing offer is often **not** the cheapest one, and we can
prove it with arithmetic across 5000 invoices rather than assert it.

---

## The thirty-second version

Vertex Components delivers ₹10,00,000 of parts to Bharat Auto on 45-day terms.
Bharat Auto accepts the invoice. Vertex now holds a near-certain ₹10L asset and
still cannot make payroll on Friday.

Four capital providers bid. Two of them:

| | Meridian Bank | Rapidfin |
|---|---|---|
| Headline rate | **11.0%** | 13.5% |
| Cash to supplier | ₹7,86,650.68 | **₹9,34,188.36** |
| **True cost** | **13.76%** | **13.73%** |

The 11.0% offer is **dearer**. The fee is flat and therefore regressive, and
true cost is charges over the cash you actually received — not over the advance,
and not over face value.

Then the part that matters more. Vertex needs **₹9,00,000 by Friday**, derived
from their dated obligations rather than asked for. A third provider, Kaveri,
is the **cheapest in the market at 13.34%** — and loses, because it delivers
₹8.66L a day late.

**Any marketplace that ranks by price recommends Kaveri. Ours disqualifies it,
and says why in a sentence a person can read.**

---

## Why this is not a loan-comparison site

The problem statement is explicit that it is not asking for one. Three things
separate them:

**1. Gates, not weights.** Sufficiency and timing *disqualify*; cost ranks only
what survives. A weighted score would rank Kaveri first — it is cheapest. An
offer that cannot solve the supplier's problem is not "worse", it is out.

**2. The supplier's need is derived, not elicited.** Nobody can honestly report
that they value settlement speed at 0.3. We read current cash, dated
obligations and the buffer the business will not go below, then walk forward to
the first breach. That date is the deadline; the gap is the floor.

**3. It clears against a double-entry ledger.** A match is not complete because
an offer was accepted. The provider advances, a reserve is held, the buyer pays,
the provider is made whole, and only then does the reserve release.

---

## Measured, not asserted

Across a 5000-invoice corpus (2472 cleared):

| | |
|---|---|
| Gates changed the winner vs price-ranking | **13.5%** |
| Cheapest offer disqualified | **37.9%** |
| No acceptable offer — "do not finance" | **24.4%** |
| Winning effective cost | 11.50%–20.78%, median 17.08% |

**One deal in eight goes to a different lender than price-ranking would pick.**

These barely moved from the 280-invoice run (12.9% / 34.2% / 21.3%), which is
what makes them measurements rather than impressions.

---

## Verified at submission

```
frontend  npx tsc --noEmit     clean
          npm test             36/36
          npm run build        compiles
backend   uv run pytest -q     343 passed, 24 skipped
database  live Supabase        8 providers · 51 opportunities · 120 bids
                               ledger balanced
```

---

## If you read one more thing

`01-requirements-coverage.md` — every PS-5 requirement mapped to a file or a
measured figure, **including the five things we deliberately did not build**.

---

## Say this, not that

| Say | Not |
|---|---|
| "Each provider has fixed terms representing its archetype" | "Agents price each deal within their mandates" |
| "The invoices are synthetic; the parser and the engine are real" | "We ingest real Tally data" |
| "A model chooses posture; deterministic functions compute every figure" | "AI decides the financing" |
| "Settlement reliability is modelled; the learning loop is not built" | "The system learns from settlement" |

The first column is defensible under questioning. The second is not, and the
gap between them is where a good submission loses.
