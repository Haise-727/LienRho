# Carryover audit — what survives, what dies, what's new

Grounded in the actual module sizes of the existing backend (~8,700 lines of
application code, plus tests and a four-screen frontend), not on impressions.

Verdicts:
**KEEP** — lift with light edits · **REWORK** — the idea survives, the code
changes substantially · **DROP** — encodes collections logic, no place here

---

## Backend, module by module

| Module | LOC | Verdict | Reasoning |
|---|---:|---|---|
| `canonical/` | 88 | **KEEP + extend** | Invoice / Customer / Payment are the right primitives. Needs new entities (Provider, Offer, Opportunity, Match, Settlement) and new invoice fields (buyer acceptance status, verification tier) |
| `ml_core/` | 768 | **KEEP, repurpose** | The single most valuable asset. Delay prediction becomes **default/late-payment probability feeding provider pricing**. The forecast becomes **supplier urgency inference**. See below |
| `connectors/` | 867 | **KEEP, reframe** | Reading the ledger of record *is* a verification mechanism. The `AccountingConnector` seam and the Tally XML work transfer directly; what changes is that its output feeds a verification tier rather than a queue |
| `agents/` | **REWRITE** | Replacing legacy collections agents with LiteLLM Market Clearing, Supplier, and Lender agents.
| `db/` | **REWORK to Prisma** | Moving from SQLAlchemy to Prisma ORM. Adding Stitch-style Double-Entry Ledger models (Account, JournalEntry, Posting). |
| `auth/` | 376 | **KEEP + extend** | JWT/PBKDF2 machinery is fine. Needs **party types** — a provider must not see another provider's bids, which is a sharper isolation requirement than the current single-tenant model |
| `api/` | **DROP** | Legacy Python FastAPI routes are removed. Using Next.js API Routes/Server Actions. |
| `decision_engine/` | **REWRITE** | Implementing the CodeCrafters deterministic Multi-Attribute Pareto Algorithm instead of the old engine.
| `rules_engine/` | 209 | **MOSTLY DROP** | MSMED statutory threshold and interest are collections instruments. TReDS eligibility is the closest thing to a survivor and even that is superseded by real provider eligibility. **Keep the deterministic-function pattern; discard the specific rules** |
| `outreach/` | 915 | **DROP** | Reminder drafts, dossiers, mock TReDS submission — all collections or single-path financing. Nothing here maps onto a marketplace |
| `data/` | 1,140 | **REWORK — the discipline is the asset** | The synthetic invoice generator needs a **synthetic capital market** beside it. The anti-leakage lesson transfers directly and is the most important thing in this row. Pseudonymisation/calibration tooling stays useful unchanged |
| `sync/` | 437 | **KEEP** | Scheduled/on-demand ingestion with idempotency is infrastructure, indifferent to the product on top |

---

## The two highest-value carryovers

### 1. The risk model changes consumer, not purpose

Today it answers *"will this customer pay me late, so should I chase them?"*
Tomorrow it answers *"how likely is this receivable to pay, so how should
capital price it?"*

Same features, same training approach, same four-bucket structure — different
reader. Two consequences worth internalising:

- **Calibration becomes commercially load-bearing.** A miscalibrated probability
  now mis-prices real capital rather than mis-ordering a to-do list. The
  existing ECE gate stops being a quality metric and becomes market
  infrastructure (see `01-commerce-analysis.md` §8).
- **The model becomes a market participant.** Its output is public information
  that providers price against, which raises the bar on explainability: a
  provider needs to know *why* an invoice scored as it did before trusting it.

### 2. The cash forecast becomes the utility engine

This is the least obvious and possibly most important carryover.

Requirement 4 needs supplier weights. Asking suppliers to self-report them
produces noise. But the existing 30-day forecast already computes *"a ₹X
shortfall is projected in N days"* — which yields sufficiency and timing
thresholds directly, without asking anyone anything.

The forecast was built to warn. It turns out to be a **preference-elicitation
mechanism**, and that is a genuinely defensible differentiator against any
platform that makes suppliers fill in a weighting form.

---

## What is genuinely new

Everything below is new construction — it has no analogue in the current build:

| Area | Why it's new |
|---|---|
| **Capital provider model** | Liquidity, risk appetite, concentration limits, hurdle rates, capacity. No equivalent exists today |
| **Opportunity routing** | Deciding which providers even *see* an opportunity (requirement 2) |
| **Offer generation** | Provider-side agents pricing within their own mandates |
| **Multi-attribute scoring** | Effective-cost computation and utility-weighted ranking (requirement 4) |
| **Matching / allocation** | Winner selection under two-sided constraints; partial fills and syndication |
| **Settlement lifecycle** | States, transitions, failure modes, reconciliation (requirement 7) |
| **Learning loop** | Realised-vs-quoted reliability feeding future allocation |
| **Synthetic capital market** | Differentiated providers producing a real Pareto frontier — as essential here as the synthetic invoice set was there |
| **Two-sided UI** | A provider-facing surface has no precedent in the current four screens |

---

## Frontend

Four screens exist: action queue, invoice investigation, cash forecast,
approvals.

| Screen | Verdict |
|---|---|
| Action queue | **DROP as the primary surface.** "What should I do today" is supplier triage. The new home screen is an opportunity/market view |
| Invoice investigation | **REWORK.** Structure — headline decision, then reasoning, then evidence, then audit trail — is worth keeping. Content becomes offers and scoring |
| Cash forecast | **KEEP.** Still meaningful to a supplier, and it now visibly justifies the utility weights |
| Approvals | **REWORK, demote.** The annexure wants human intervention minimised; approvals become exception handling rather than the main flow |
| Login / shell / components | **KEEP.** Auth flow, layout, and component library transfer |

**New and unavoidable:** a **provider-side view** — opportunities surfaced to
me, my portfolio and constraints, my bids and their outcomes. Without it, the
"two-sided market" claim is unsupported, and a judge will notice.

---

## Principles that transfer unchanged

These are the parts worth protecting most, because they were expensive to learn:

1. **No LLM computes a financial figure.** Higher stakes here than before —
   priced capital and settlement obligations rather than a filing.
2. **Every value traces to a named function with a recorded call.** In a
   marketplace this is close to a regulatory expectation, not a nicety.
3. **Deterministic fallback behind every agent.** A dead API key must degrade
   the market, never halt it.
4. **Structured, validated agent I/O.** Unvalidated model output never reaches
   an allocation decision.
5. **Synthetic data must not leak what it is meant to teach.** Applies now to
   provider bids as much as to payment delays — see the design warning in
   `01-commerce-analysis.md` §6.
6. **Say plainly what is simulated.** Mocked financing was labelled as mocked
   before; a simulated market gets the same treatment.

---

## Bottom line

Roughly **a third** of the engineering value transfers (data model, risk model,
agent scaffolding, audit trail, auth, connector, infrastructure, and the
discipline above). Roughly **40%** is collections logic with no future here.
The remaining **half of the new system** — the entire market side — does not
exist yet.

The foundation is genuinely strong and worth reusing. It is also not close to
"most of the work is already done", and planning on that assumption is the
main way this goes wrong.
