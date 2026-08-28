# Commerce analysis

What this market actually is, how money moves through it, and where the
intelligence has to sit. Written for the team to argue with, not to agree with.

---

## 1. What kind of financing this is

Supply-chain finance has two broad structures, and PS-5 sits closer to the first:

**Receivables discounting (supplier-initiated).** The supplier holds an invoice,
wants cash before the buyer pays, and sells the receivable at a discount. The
supplier bears the financing cost. PS-5's framing — *"a supplier should be able
to present a verified invoice to a financing market"* — is this.

**Reverse factoring / approved payables finance (buyer-initiated).** The buyer
approves the invoice and a financier pays the supplier early, priced off the
**buyer's** credit rather than the supplier's. Usually cheaper, because large
buyers are stronger credits than their small suppliers.

The commercially critical variable sits between them: **whose credit is being
priced?**

- If the buyer has formally **accepted** the invoice (an irrevocable undertaking
  to pay), the provider is largely taking *buyer* credit risk. Cheaper.
- If not accepted, the provider also carries **dilution risk** — disputes,
  returns, short payments, set-offs — which is supplier-quality risk. Dearer.

This single distinction should be a first-class field in the data model, because
it moves pricing more than almost anything else and is a natural source of
genuinely differentiated offers.

---

## 2. Anatomy of an offer

For an invoice of face value **F** over tenor **T** days:

| Term | Meaning | Why it matters |
|---|---|---|
| **Advance rate** `a` | Share paid upfront (typically 80–95%) | Determines how much cash actually arrives. Dominates rate on small tenors |
| **Financing rate** `r` | Annualised discount charge, applied to the advance | The headline number, and the most over-weighted one |
| **Fees** | Platform/processing, often flat | A flat fee is regressive: it hurts small invoices disproportionately |
| **Reserve** `(1−a)·F` | Released after the buyer pays, less any dilution | Supplier's residual claim; delayed and not risk-free |
| **Tenor** | Days capital is deployed | Longer tenor = more total charge, but should match real buyer behaviour |
| **Settlement speed** | T+0 / T+1 / T+3 | Can be decisive. Cash that arrives after the deadline has failed |
| **Recourse** | Does the supplier repay if the buyer defaults? | Non-recourse transfers real risk and is worth paying for |
| **Repayment structure** | Bullet on buyer payment vs amortising vs revolving | Shapes the supplier's forward cash planning |

Roughly:

```
advance          = a × F
discount charge  = advance × r × T/365
net cash now     = advance − discount charge − fees
effective cost   = (discount charge + fees) / net cash × 365/T
```

**Effective cost is the honest comparator, and it is not the headline rate.**

---

## 3. The worked example — the spine of the whole product

One invoice: **₹10,00,000**, 45-day tenor. Two offers.

| | Offer A | Offer B |
|---|---|---|
| Headline rate | **11.0%** | 13.5% |
| Advance rate | 80% | **95%** |
| Fee | ₹2,500 | **₹0** |
| Settlement | T+3 | **T+0** |

Run the arithmetic:

| | Offer A | Offer B |
|---|---|---|
| Advance | ₹8,00,000 | ₹9,50,000 |
| Discount charge | ₹10,849.32 | ₹15,811.64 |
| Fee | ₹2,500 | ₹0 |
| **Cash in hand** | **₹7,86,650.68** | **₹9,34,188.36** |
| **Effective annualised cost** | **13.76%** | **13.73%** |

Offer B delivers **₹1,47,537.67 more cash, three days sooner — and is
*effectively cheaper*, 13.73% against 13.76%.**

The 2.5-point headline advantage is entirely erased by the lower advance rate
and the flat fee. A marketplace that sorts on rate does not merely give an
incomplete answer here; it gives the **wrong** one, and confidently.

Layer on situation: if this supplier needs **₹9,00,000 by Friday**, Offer A
fails on both count and clock — it delivers ₹7.87L, on day three. Its cheapness
is irrelevant, because it does not solve the problem the supplier has.

> This example is the demo. Everything else is scaffolding around making this
> moment legible.

---

## 4. Supplier utility — the part most teams will get wrong

Requirement 4 demands ranking by overall suitability. That requires knowing what
this supplier values *right now*, and the naive answers are all bad:

- **Fixed weights** — wrong for everyone, since urgency varies week to week.
- **Ask the supplier to set weights** — nobody can honestly state that they
  value settlement speed at 0.3. Elicited weights are noise dressed as data.

The better route: **infer weights from the supplier's observable cash
position.** If a shortfall is projected in *N* days for *₹X*, then:

- **Sufficiency** — does this offer's net cash actually cover ₹X? An offer that
  doesn't is not "worse", it is *disqualified* for this purpose.
- **Timing** — does it land before the shortfall date? Same logic.
- **Cost** — only once sufficiency and timing are met does price become the
  discriminator.

This is nearly **lexicographic** rather than a weighted sum: sufficiency and
timing act as gates, cost ranks the survivors. A pure weighted score would let a
very cheap, very slow offer beat a slightly dearer one that actually makes
payroll — which is precisely the failure mode PS-5 describes.

The old build's 30-day cash forecast is exactly the machinery for this, which is
the single most valuable carryover in the project.

---

## 5. The provider's side

A capital provider is not deciding "do I like this invoice". It is asking
whether deploying capital here beats its alternatives:

```
expected loss        = PD × LGD × exposure
net margin           = discount income − expected loss − cost of funds − opex
risk-adjusted return = net margin / capital employed
```

…then testing that against a **hurdle rate**, subject to:

- **available liquidity** — capital free to deploy today
- **risk appetite** — the credit floor it will touch at any price
- **concentration limits** — exposure caps per buyer, sector, supplier
- **ticket size** — minimum and maximum viable deal
- **tenor limits** — how long it will stay deployed

Concentration is what makes this an **allocation** problem rather than a series
of independent yes/no decisions: a provider that would happily fund five
invoices individually may refuse the fifth because it breaches a buyer cap.

---

## 6. Provider archetypes — and why the market must produce a Pareto frontier

For the marketplace to mean anything, offers must be **genuinely
non-dominated** — no single offer better on every axis. Differentiated provider
types produce that naturally:

| Archetype | Cost of funds | Risk appetite | Settlement | Advance | Capacity | Character |
|---|---|---|---|---|---|---|
| **Large bank** | Lowest | Conservative | Slow (T+2/3) | Moderate | Very high | Cheap but rigid and slow |
| **NBFC** | Moderate | Moderate–high | Fast (T+1) | High | Moderate | The middle of the market |
| **Fintech** | Highest | Moderate | Instant (T+0) | Highest | Small tickets | Pays for speed and convenience |
| **Credit fund** | Moderate | High | Slow | Moderate | Large tickets | Yield-seeking, takes weaker credits at a price |
| **Sector specialist** | Moderate | High *in its sector* | Moderate | High | Narrow | Prices its own sector better than generalists |

> **Design warning, carried from the previous build's hardest lesson.** If the
> synthetic providers' bids are generated by the same logic that later scores
> them, the market is theatre and any "intelligent matching" result is circular.
> Provider pricing must be driven by each provider's own cost of funds, appetite
> and constraints — and the scorer must not know those internals. This is the
> same discipline as not letting a data generator leak the label it is meant to
> teach a model to predict, and it applies here for the same reason.

A cheap validity check before trusting any demo output: **plot the offers. If
one offer dominates all others on every axis, the market generator is broken.**

---

## 7. Market design — how the auction should run

This is a **multi-attribute reverse auction** (providers compete to lend;
"best" is multidimensional). Options:

| Mechanism | For | Against |
|---|---|---|
| **Sealed-bid, scored** | Simple, explicable, one clean round, no gaming loop | Weaker price discovery than iterative formats |
| **Open / iterative** | Better discovery, providers can undercut | Collusion-prone, hard to narrate in three minutes |
| **Second-price (Vickrey)** | Truthful bidding is theoretically optimal | "Second price" is ambiguous on a multi-attribute bid; hard to explain |

**Recommendation: sealed-bid with a published scoring rule.**

The word *published* is doing real work. If providers cannot see how they will
be judged, they bid defensively and the supplier gets worse terms — an opaque
scorer actively harms the side it claims to serve. Publishing the rule is both
better economics and a much stronger story to a judge.

Two mechanisms worth building because they demonstrate judgement:

- **Reserve / no-match.** If no offer clears the supplier's minimum acceptable
  outcome, the correct result is *"do not finance"*, not "here is the least bad
  option". A market that always transacts is not exercising judgement.
- **Partial fill / syndication.** If no single provider has the liquidity or
  concentration headroom for the full amount, split it. This makes the
  constraint model visible rather than theoretical.

---

## 8. Information asymmetry — where verification earns its keep

The platform sees verified accounting data. Providers do not. That gap is the
market's central economic feature, and requirement 5 is really about it.

- **Adverse selection.** If providers suspect only bad invoices reach the
  market, they price defensively for the average — and good suppliers, unwilling
  to pay that premium, leave. The market unravels toward its worst participants.
- **Verification is the counter.** A ledger-verified, buyer-accepted invoice
  carries far less uncertainty than a supplier assertion, and providers can
  price the difference — *if* verification tiers are disclosed rather than
  flattened into a single "verified" flag.
- **Therefore: verification level must be an explicit, graded, disclosed field.**
  Not a boolean.

There is a sharper consequence for the risk model. Once providers price off the
platform's probability estimates, **calibration stops being a model-quality
metric and becomes market infrastructure.** A provider that trusts a stated 8%
default probability and repeatedly experiences 20% will widen its spreads or
leave — and it will be right to. Expected calibration error is now a
commercial liability, not a leaderboard number.

---

## 9. Settlement reliability — the requirement most teams will skip

The annexure is explicit: a match is not complete because an offer was accepted.
The lifecycle continues through disbursement, buyer payment, reserve release,
and reconciliation, and each step can fail:

- provider fails to disburse, or disburses late
- buyer pays late, short, or disputes
- dilution reduces the reserve below expectation

Commercially this means **a provider's quoted terms and its delivered terms are
different things**, and only the second one matters. A provider quoting T+0 and
settling T+3 has, in substance, made a worse offer than it advertised.

That gives the "Learn" step in PS-5's loop something concrete to do: **track
realised reliability per provider and feed it back into scoring.** Quoted speed
becomes an expectation adjusted by history rather than a claim taken at face
value. It is also a satisfying demo beat, because it visibly punishes a provider
for over-promising.

---

## 10. Regulatory reality — state this, don't dodge it

Competitive invoice discounting in India is a **regulated activity**, not an
open field:

- **TReDS** platforms operate under RBI authorisation, and existing licensed
  platforms (RXIL, M1xchange, Invoicemart) already run multi-financier bidding
  on MSME receivables.
- **Factoring** is governed by the Factoring Regulation Act, 2011, amended in
  2021 to widen NBFC participation.

*Confirm the current specifics before putting any of this on a slide — the
direction is right but the details move, and a judge from the sector will know
them better than we do.*

Two consequences:

1. **Build a simulated marketplace and label it as one.** No real money, no
   live provider integrations, no representation of being an operating market.
   The previous build held the same line on mocked financing and it was the
   right call; the same discipline applies at higher stakes here.
2. **Do not claim to have invented competitive invoice discounting.** TReDS
   already does multi-financier bidding. Claiming novelty there is the fastest
   way to lose credibility with anyone who knows the sector.

---

## 11. So what is actually novel?

Given TReDS exists, the differentiation has to be precise. Defensible claims:

| Claim | Why it holds |
|---|---|
| **Multi-attribute clearing, not rate auctions** | Existing platforms bid principally on rate. Scoring across advance rate, fees, speed, tenor and recourse *against derived supplier utility* is a materially different mechanism |
| **Utility inferred from the supplier's real cash position** | The system reads the accounting ledger and derives urgency, instead of asking a supplier to self-report weights they cannot honestly quantify |
| **Agentic on both sides** | Provider-side agents evaluating within their own mandates, not a passive listing that humans work through |
| **Delivered-terms accounting** | Provider reliability is measured against what was quoted, and feeds back into future allocation |
| **Auditable determinism** | Every rupee traces to a named function with a recorded call — genuinely uncommon, and directly relevant where priced capital is at stake |

*Weak* claims to avoid: "a marketplace for invoice financing" (exists), "AI for
supply-chain finance" (says nothing), "better rates" (unprovable in a
simulation, and inviting the one question with no good answer).
