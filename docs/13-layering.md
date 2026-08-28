# What data does, what algorithms do, what models do

A clean division, and the test for deciding which layer a new piece of work
belongs in. Written because the boundary has already been crossed by accident
twice, both times in a plan rather than in code — which is the cheap place to
catch it.

---

## The three layers

### Data — what is true, and when it was true

Postgres, through Prisma. Invoices, bids, cash positions, providers, journal
entries, opportunity status.

**Owns:** facts of record. The audit trail. What a given party actually
committed to at a given moment.

**Never:** decides anything. Never holds a derived figure as the source of
truth. Columns like `Bid.effectiveAnnualCost` exist as a **cache of a
computation**, not as an authority — if the engine and the column disagree, the
column is stale and the engine is right.

There is one important consequence of that rule already live in the schema:
`FinancingOpportunity.sufficiencyFloor` and `timingDeadline` are **null by
design**. The supplier's gates are derived at clearing time from their cash
position, so storing them would be storing an opinion as a fact.

### Algorithms — every number and every decision

Deterministic TypeScript in `frontend/src/lib/market/`. Offer economics, the
sufficiency and timing gates, ranking, dominance, allocation, business-day
settlement, the ledger's double-entry postings.

**Owns:** anything with a right answer. Money, dates, ordering, eligibility,
capacity.

**Never:** calls a model. Never uses randomness or wall-clock behaviour that
makes a rerun differ.

Everything here is reproducible, named, and testable. That is not an
engineering preference — invoice discounting is a regulated activity, and
"which offer did this supplier get, and why" has to be answerable with a
function name, its inputs, and its output.

### Models and agents — judgement where there is no formula, and language

LiteLLM for model access, LangGraph for coordination, ElevenLabs for voice.

**Owns:** posture under ambiguity (aggressive / conservative / decline),
explanation in prose, extraction from unstructured input, conversation.

**Never:** produces a figure. Never decides who wins. Never sits on the only
path — every call has a deterministic fallback, and `llm.complete()` returning
`None` must leave the system fully functional.

---

## The test

When something new arrives and it is not obvious where it goes, ask:

> **If two runs disagree, is that a bug?**

| Answer | Layer |
|---|---|
| Yes — the data changed underneath, or something is broken | **Data** |
| Yes — same inputs must give the same output, always | **Algorithm** |
| No — variation is expected and acceptable | **Model** |

That last row is the whole argument. Non-determinism is a *feature* of a
language model and a *defect* in a marketplace. So anything whose disagreement
would be a defect cannot live in the model layer, no matter how convenient it
would be to put it there.

A second test, useful for the pitch as much as the code:

> **Could you defend this to a regulator with a printout?**

A named function, its inputs, and its output — yes. "The model judged it" — no.

---

## A worked example of getting it wrong

From `11-hardcoded-debts.md`, before correction:

> *Implement the LiteLLM integration to allow providers to dynamically adjust
> their `annual_rate_bps` and `advance_rate_bps`.*

That is a model setting interest rates. It reads perfectly reasonable and it
breaches the project's first non-negotiable.

The same feature, correctly layered:

- **Model** picks a posture for this provider on this opportunity — aggressive,
  standard, conservative, or decline. That is a genuine judgement call under
  ambiguity, which is what models are for.
- **Algorithm** takes that posture plus the provider's mandate
  (`costOfFunds`, `hurdleRate`, `riskAppetiteFloor`) and the opportunity's
  `probabilityOfDefault`, and computes the rates — or returns a decline when
  the risk-adjusted return misses the hurdle.
- **Data** records the resulting bid, and the posture that produced it, so the
  decision is reconstructable later.

Same feature, same behaviour to a user, and now defensible.

---

## Should an LLM do the ranking?

No, and it is worth being explicit because it is a tempting shortcut — one
prompt could replace the gates, the ranking and the explanations.

**1. It is the non-negotiable, directly.** Ranking offers *is* computing a
financial outcome. Not adjacent to it.

**2. The demo depends on determinism.** The strongest moment we have is Kaveri
Capital being the cheapest offer in the market at 13.34% and losing anyway. A
model asked to rank might well pick it — it *is* the cheapest, and the reason it
loses requires holding two constraints simultaneously. If that answer varies
between runs, the pitch cannot be rehearsed.

**3. The audit trail is the product.** "Why this offer?" must be answerable in
terms a supplier can check. `netCash 934,188.36 ≥ floor 900,000` is checkable.
"The model weighed the factors" is not.

**4. It reintroduces the exact failure we exist to fix.** PS-5's complaint is
that platforms collapse incommensurable offers into one fuzzy score. An LLM
ranker is a fuzzy scorer with better prose. Building the thing we criticise, and
then criticising it, is not a position that survives a question.

**5. Cost and latency, incidentally.** Microseconds and free, versus seconds and
metered, per clearing.

**Where a model genuinely helps around ranking:** explaining a result in a
supplier's own words, answering follow-up questions about a decision already
made, and reading unstructured input into structured facts. All downstream of
the number, never upstream.

---

## Is the Pareto frontier worth building?

Partly. Being honest about which parts earn their place.

### What it will not do: change who wins

With lexicographic gates, the winner is already determined — offers failing
sufficiency or timing are out, and the cheapest survivor wins. A Pareto frontier
does not alter that outcome. Any doc implying that "Pareto matching" is *how the
winner is chosen* is overstating it; the gates choose, and cost breaks the tie.

### What it does earn: two things

**1. A degeneracy guard — the most valuable ~30 lines available.**

If one offer dominates every other on every axis — cheaper *and* more cash *and*
faster — then the bid set is broken, not the market competitive. That is what a
mispriced generator produces, and we have already shipped exactly that bug: the
agent fees were 10× too large (#17), which distorts every effective cost in the
same direction.

A guard that fails loudly on a degenerate frontier catches a whole class of
"the numbers look plausible and are all wrong" problems that no unit test will
find, because each individual calculation is correct.

**2. It justifies showing more than one offer.**

An offer that is dominated — worse on every axis than some other offer — is
noise on the screen. The non-dominated set is the set worth a person's
attention. That gives a principled answer to the open question in
`05-decisions-needed.md` §4 about whether to show all bids or just the winner:
show the frontier, highlight the winner, drop the dominated.

### What to build, then

- `pareto.ts`: `nonDominated(offers)` over (net cash, effective cost, arrival
  date), plus `isDegenerate(offers)`.
- Surface `dominatedBy` on `ScoredOffer` so the UI can collapse noise.
- Call the guard during clearing and log loudly when it trips.

Roughly an hour, and the guard alone justifies it. What it is **not** is the
ranking mechanism, and the docs should stop implying otherwise.

---

## Quick reference

| Question | Layer |
|---|---|
| What did this provider bid? | Data |
| What is this offer's true cost? | Algorithm |
| Does it clear the supplier's floor? | Algorithm |
| Which offer wins? | Algorithm |
| Can this provider still fund it? | Algorithm |
| Should this provider bid aggressively today? | Model |
| Explain to the supplier why the cheap offer lost | Model |
| Read this PDF invoice into fields | Model |
| Answer a spoken question about a cleared result | Model |

The pattern in that table: **models sit at the edges — input and explanation —
and never in the middle where the money is.**
