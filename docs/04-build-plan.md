# Build plan — «PROJECT»

Scope, phasing, and a demo narrative. Same checkpoint discipline as before:
**every phase ends with something demoable**, so an interruption never leaves
the project looking unfinished.

---

## MVP scope

**In scope** — the smallest system that proves the thesis in
`01-commerce-analysis.md` (multi-attribute clearing beats rate-only comparison):

- Verified invoices with a graded tier (buyer-accepted / ledger-verified /
  supplier-asserted)
- Risk scoring reused from the existing model, repurposed for pricing
- 4–6 synthetic capital providers with genuinely differentiated mandates
- Deterministic offer generation, or agent-chosen posture over deterministic
  pricing
- Supplier utility derived from the cash forecast (sufficiency + timing + cost)
- Deterministic scoring, ranking, and a "no acceptable offer" outcome
- Single-provider matching (syndication is a stretch goal, not MVP)
- A settlement lifecycle model — states and transitions, doesn't need to be deep
- Two screens minimum: supplier opportunity view, provider opportunity/bid view
- Full audit trail: every priced figure traces to a named function

**Explicitly out of scope:**

- Live provider integrations, real settlement, real money
- Full syndication / partial-fill logic across arbitrary N providers
- Iterative or open-auction mechanics (sealed-bid only)
- Buyer-side product surface (buyer is a data input, not a user)
- Anything from the old build's collections path (statutory escalation, mock
  TReDS as previously scoped, outreach drafting)
- Multi-currency, multi-jurisdiction

---

## Phases

Same principle as before: each phase is independently demoable. If time runs
out, the last completed phase is the demo — nothing half-built goes on stage.

### Phase 0 — Foundation
Extend the canonical model with the new entities (`03-system-design.md`).
Stand up the provider registry with genuinely differentiated mandates — get
this wrong and every later phase inherits a broken market.
**Demo:** "Here are five providers and why they're different."

### Phase 1 — Verification & Risk
Wire graded verification tiers. Repurpose the existing risk model to emit a PD
usable for pricing rather than for collections. Confirm calibration explicitly
— it's commercial infrastructure now, not a leaderboard number.
**Demo:** "Here's an invoice, its verification tier, and its risk grade."

### Phase 2 — Supplier Utility
Build sufficiency/timing/cost derivation from the existing cash-forecast
machinery.
**Demo:** "Here's what this supplier actually needs, and why — read off their
own cash position, not asked for."

### Phase 3 — Offers & Scoring ← **the thesis lands here**
Deterministic offer generation from provider mandates. Deterministic scoring
against supplier utility. This phase must produce the `01-commerce-analysis.md`
§3 result: **a cheaper-looking offer that is worse, and the system saying so.**
**Demo:** the two-offer comparison, cash amounts and effective cost both
computed live, not hand-typed into a slide.

### Phase 4 — Matching & Two-Sided UI
Winner selection. Build the provider-facing screen — the piece with no
precedent in the old build and the one most likely to be skipped under time
pressure precisely because it's unfamiliar.
**Demo:** the same opportunity shown from both sides — supplier's ranked offers,
provider's queue and win/loss.

### Phase 5 — Settlement & Learning
Lifecycle state machine, quoted-vs-realised tracking, a visible feedback effect
on provider reliability scoring.
**Demo:** an offer that under-delivers on its quoted terms, and the system
adjusting that provider's standing because of it.

### Phase 6 — Agentic Layer
LLM-driven pricing posture and clearing judgement over the deterministic core,
with the fallback discipline carried over from the old build. This is
additive — a working deterministic market must exist before this phase starts,
exactly as before.
**Demo:** the tool-call trace on a priced offer — the new product's version of
"the agent decided; it never touched the arithmetic."

### Phase 7 — Polish & Rehearsal
Same discipline as before: freeze, tag, rehearse the click path out loud,
time it.

---

## Demo narrative (draft — refine once the build exists)

1. **The hook.** A supplier holds a verified invoice and needs cash. Multiple
   providers can fund it. Today that's one phone call to one bank. Here, it's a
   market.
2. **The thesis moment.** Show the two-offer comparison from
   `01-commerce-analysis.md` §3 live: the cheaper headline rate that is
   actually the worse — and more expensive — deal, computed on stage.
3. **Both sides.** Flip to the provider view: the same opportunity, this
   provider's own mandate, its bid, its position in the ranking.
4. **Judgement, not just matching.** Either a no-match case (nothing clears the
   supplier's floor) or a split/syndicated fill — proof the system reasons
   about constraints rather than always transacting.
5. **The defensibility line, carried forward.** The agent chose the pricing
   posture; the number came from a named function. Same structure, same payoff,
   now protecting priced capital instead of a legal filing.
6. **Close.** Multi-attribute clearing against inferred supplier need,
   deterministic and auditable throughout, minimal human intervention by
   design.

---

## What "done for the hackathon" looks like

- Phases 0–3 solid and correct — this is where the thesis is proven or isn't.
- Phase 4 present even if thin — the two-sided claim needs visible evidence.
- Phase 5 present in outline — the lifecycle exists even if shallow.
- Phase 6 present for at least one flow, with the same "explain what's real"
  honesty from before: if the LLM path is off by default, say so plainly rather
  than imply it's live.
- Everything through Phase 3 has to be airtight, because it's the answer to the
  one question a judge is certain to ask: *why is this not just a
  loan-comparison table?*
