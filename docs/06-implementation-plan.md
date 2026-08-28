# Implementation plan — phase 1 (Setup/Framework)

What was transferred, why it wasn't pruned first, and what each of the four of
you can pick up right now without stepping on each other.

---

## The decision this plan is built on

**Goal for this phase: a working stack, not a clean one.** The whole backend
and frontend were copied over as-is — not the git history, just the working
tree — and verified in place (see below). Nothing was pre-pruned.

That's deliberate. `02-carryover-audit.md` already says which modules die
(`outreach/`, most of `rules_engine/`) and which get reworked
(`agents/`, `decision_engine/`, `api/`, most of the frontend). Doing that
surgery *before* anyone starts risks handing four people a stripped, possibly
broken app on day one. Doing it *as tracked issues* means the removal work is
visible, assignable, and doesn't block anyone from starting today.

## What's here and verified working

```
LienRho/
├── docs/                — 00-brief through 05-decisions-needed, this file, the PDF
├── backend/              — [BEING DEPRECATED] Transitioning to Next.js Full-Stack
└── frontend/             — Next.js, unchanged from source
```

Verified in this location, today:
- `cd backend && uv sync && uv run pytest -q` → **324 passed, 24 skipped**
  (skips are Postgres-gated — run `docker compose up -d && uv run alembic
  upgrade head` first to get all 348)
- `cd frontend && npm ci && npx tsc --noEmit && npm run build` → clean

Nothing here has been renamed or rewritten. It's the identical codebase, just
relocated and confirmed to still boot.

---

## Per-module fate (from `02-carryover-audit.md`, made actionable)

| Module | Fate | What that means concretely |
|---|---|---|
| `canonical/` | **Keep, extend** | Add Provider/Offer/Opportunity/Match/Settlement entities alongside the existing Invoice/Customer/Payment |
| `db/`, `auth/`, `sync/` | **Keep** | Infra is domain-indifferent. Auth needs a **party-type** concept added (supplier org vs. provider org) — see issue list |
| `connectors/` (incl. `tally/`) | **Keep, reframe** | The connector *is* a verification mechanism now, not a queue feed. No code change needed to start |
| `ml_core/` | **Keep, repurpose** | Same model, new consumer: PD feeding provider pricing instead of a collections queue. Calibration becomes commercial infrastructure — treat the existing ECE gate as load-bearing, not cosmetic |
| `data/synthetic.py` | **Rework** | Generator pattern and the anti-leakage discipline (`ADR-004` equivalent) carry over; the *content* needs a synthetic capital-provider population alongside the invoice set |
| `data/sanitize.py`, `calibration.py`, `calibrate.py` | **Keep as-is** | The CP4 privacy pipeline. Directly reusable for real Tally data per `05-decisions-needed.md` §3 |
| `data/communications.py` | **Leave behind for now** | Payment-promise detection is collections-specific. Not deleted, just not on the phase-1 critical path |
| `agents/` | **Keep scaffolding, replace logic** | `schemas.py`'s structured-I/O pattern, `tools.py`'s `ToolBox` + recorded-call pattern, `llm_client.py`'s mock/real split: all reusable untouched. `investigator.py` and `strategy.py`'s actual business logic (promise credibility, escalation tracks) gets replaced by provider-agent and clearing-agent logic |
| `decision_engine/` | **Keep shape, replace logic** | `store.py` (durable audit trail) is pure infra, keep as-is. `engine.py`/`service.py`'s scoring and ranking *pattern* carries over; the specific rules (statutory/dispute/promise) don't |
| `api/` | **Keep infra, replace endpoints** | `main.py` (app wiring, CORS), `schemas.py` (camelCase convention), `health.py` (audit-store status pattern): keep. `routes.py`'s endpoints are all supplier-collections-shaped and get replaced |
| `outreach/` | **Remove once replaced** | Reminders, dossiers, mock TReDS submission — no marketplace equivalent. Not urgent to delete, but don't extend it |
| `rules_engine/` | **Remove once replaced** | MSMED/TReDS-single-path logic is collections-specific. The *deterministic-function-behind-a-recorded-tool-call* pattern is what survives — rebuilt fresh for provider eligibility/pricing rules |
| Frontend: `layout.tsx`, `login/`, `AppShell.tsx`, `components/ui/`, `lib/session.ts`, `lib/utils.ts`, `lib/format.ts`, `proxy.ts` | **Keep** | Layout, auth flow, component primitives — domain-indifferent |
| Frontend: `page.tsx`, `approvals/`, `invoice/`, `ActionQueueCard.tsx`, `ApprovalPanel.tsx` | **Replace** | Supplier-triage-shaped. New home screen is an opportunity/market view (see `02-carryover-audit.md`) |
| Frontend: `forecast/`, `ForecastChart.tsx` | **Keep** | Cash forecast stays meaningful — it becomes the supplier-utility justification, not just a warning screen |
| Frontend: `AuditTrail.tsx`, `Badge.tsx`, `StatCard.tsx`, `DelayBucketBar.tsx` | **Keep** | Generic enough to reuse for offer scoring / risk display |

---

## What doesn't exist yet (all of phase 2)

No code for any of this exists in the transferred base — see
`03-system-design.md` for the design and `04-build-plan.md` for phasing:

- Capital Provider registry (differentiated mandates — get this wrong and
  everything downstream inherits a broken market)
- Opportunity routing (eligibility + suitability filtering)
- Offer generation (provider-side pricing, deterministic-tool-boundary pattern)
- Supplier Utility Engine (sufficiency/timing/cost from the cash forecast —
  the actual thesis, see `01-commerce-analysis.md` §3–4)
- Scoring & comparison (effective-cost computation, the worked example)
- Matching & allocation (winner selection, partial fill/syndication)
- Settlement lifecycle & the learning loop
- Provider-facing UI (no precedent in the transferred frontend)

---

## Splitting phase 1 across four people

Structured so each stream can start immediately against the verified-working
base above, without waiting on another stream to finish first.

| Stream | Owns | First concrete tasks |
|---|---|---|
| **Track 1: Database & Ledger** | Prisma schema | Setup Prisma Double-Entry Ledger (Stitch) & Base Next.js API |
| **Track 2: Core Matching Engine** | Algorithm | CodeCrafters Pareto Matching Algorithm & Redis Locks |
| **Track 3: Voice AI & Agents** | ElevenLabs/LiteLLM | CFO Voice Cockpit, Call Simulator, Market Clearing Agents |
| **Track 4: Frontend UI** | Next.js App | Apple-style light theme Dashboard, Live Bid Ticker, Deal Cards |

Cross-cutting, whoever's free: start the `agents/` and `decision_engine/`
rework once the data model stream has the new entities in place — those two
streams are structurally blocked on the models existing first.

---

## Non-negotiables, restated for this phase

From `00-brief.md` — copy these into `CONTRIBUTING.md` verbatim once it's written:

1. No LLM computes a financial figure. Ever. Higher stakes here than in the
   old build — priced capital and a settlement obligation, not a filing.
2. Every priced value traces to a named function with a recorded call.
3. Deterministic fallback behind every agent — a dead API key degrades the
   market, never halts it.
4. Structured, validated agent I/O only.
5. Synthetic data (invoices *and* now provider bids) must not leak what it's
   meant to teach.
6. State plainly what's simulated. No real money, no live provider
   integrations, said out loud, always.

---

## All sponsor integrations (ElevenLabs, Stitch, CodeCrafters, LiteLLM) ARE in this MVP phase.

Per your call: AWS/cloud infra and the three sponsor integrations (voice
verification, the Rust/Go clearing engine, LiteLLM) are **not** part of getting
to a working base. They stay in `05-decisions-needed.md` as open questions to
revisit only once phases 0–3 of `04-build-plan.md` are solid.
