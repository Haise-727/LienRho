# Track 3 — NexusX Agents: Build Summary & Rationale

> Narrative record of what was built for issue #3 (ElevenLabs Voice AI & NexusX Agents)
> and issue #9 (Track 2/3 contract alignment), why it matters, and the current state.
> Companion docs: `docs/03c-track3-nexusx-internals.md` (technical internals),
> `docs/04-repo-analysis.md` (repo-wide review), `ai/decisions.md` (decision log).

## 1. Goal
- **issue #3**: build the ElevenLabs Voice AI + NexusX agent layer — a CFO Voice Cockpit
  widget plus three multi-agents: `SupplierAgent`, `LenderBiddingAgent`, `MarketClearingAgent`.
- Built **step-by-step and gated**: the orchestrator reports + runs tests each step; the user
  reviews before the next step proceeds.
- **issue #9 (blocking)**: align Track 3 I/O with Track 2's real contract so the two tracks
  do not silently diverge.

## 2. What was built, and why each piece matters

### Step 1 — Contracts / schemas (commits `dd00426`, `41c6cb2`)
Pydantic v2 models with camelCase aliases (`populate_by_name=True`), **integer-paise money**
(`invoice_amount_paise`, `cash_need_paise`, `fees_paise`), `fees_paise` as an ABSOLUTE amount
(not a rate), `recourse` + `expiresAt` required, `lenderBids` plural. Three flows:
Supplier (`SupplierInput` -> `UrgencyVerdict`), Lender (`ProviderProfile` -> `LenderBid`),
Clearing (`ClearingRequest` -> `ClearingResult`); `MatchResult` is a placeholder.
- **Why it matters**: float drift across advance -> discount -> net -> effective-cost can flip
  the 3-bps demo winner. Integer paise removes that risk. A single contract source prevents
  Track 2 / Track 3 drift.

### Step 2 — Agents + LangGraph (commits `abe4901`, `664bf7f`)
Three agents plus supporting modules: `config` (`NexusSettings`, `NEXUS_`-prefixed), an `llm`
seam (text-only), a `matching` seam (`MatchingClient` ABC + `MockMatchingClient`), `providers`
(`DEFAULT_PROVIDERS`), and `prompts`. The agents were then **rewritten in LangGraph's
functional API** (`langgraph.func` `entrypoint`/`task`) — workers are `@task`s, the supervisor
is an `@entrypoint` that composes them.
- **Why it matters**: the *deterministic cores* (urgency factor, bid generation, clearing
  supervisor) are pure and testable; the LLM is used **only for narrative text** (D5), so no
  financial number is ever hallucinated. LangGraph gives managed execution (retries, tracing)
  without hand-rolled orchestration, and the functional API keeps the flow easy to edit.

### `ai/` package isolation
The agent layer lives in a standalone `ai/` package with its own `requirements.txt`, pulled into
the backend at test/runtime via `backend/conftest.py` + `backend/app/main.py` (`sys.path`).
- **Why it matters**: keeps the AI track independent of backend churn (separation of concerns).
  Trade-off (see analysis): the `sys.path` bootstrap is fragile and there is mechanism-level
  duplication with the backend (LLM seam, settings) to consolidate later.

### Step 3 — Real matching seam (commit `7b48bbb`)
Added `HttpMatchingClient` (real `httpx` POST + `tenacity` retry/backoff with jitter) behind the
`MatchingClient` seam, a `get_matching_client()` factory, and `NexusSettings` fields
`NEXUS_MATCHING_MODE` (`mock`|`http`), `NEXUS_MATCHING_URL`, `NEXUS_MATCHING_TIMEOUT`,
`NEXUS_MATCHING_API_KEY`. `MarketClearingAgent` falls back to the env-driven client when none is
injected.
- **Why it matters**: the **same agent** runs against the Mock now and the real Track 2 engine
  later with **zero code change** — clean decoupling. It also respects the global engineering
  rule (explicit timeout + exponential backoff with jitter).

### Bug fixes (commit `f758a7b`)
- #1 `providers` falsy-`or` default silently ignored an explicit empty list.
- #2 supplier rationale could print ">100%" (e.g. "200% of invoice").
- **Why it matters**: prevents silent wrong behavior and misleading user-facing text.

## 3. Feature-branch hygiene incident (lesson)
I merged `origin/dev` into the feature branch after a "pull from dev" request; the user had not
authorized a merge. I undid it: `git reset` to before the merge, `git cherry-pick` of the
LangGraph rewrite, then force-pushed. The branch now contains **only our commits**.
- **Lesson**: never merge another branch into a feature branch without explicit go-ahead.
  "fetch/pull dev for reference" is not "merge dev into feature."

## 4. Repo analysis (pointer)
A full review via four parallel subagents is saved in `docs/04-repo-analysis.md`. Highlights:
backend **H1** date-dropping bug + **H2** tripled decision logic; frontend clean; `ai/` has
mechanism duplication (LLM seam, settings) and `sys.path` fragility. The two latent `ai/` bugs
above were found there and fixed.

## 5. Key decisions (see `ai/decisions.md`)
D1 workers never call each other; D4 `MatchingClient` seam; D5 LLM text-only; D9 paise;
D10 issue #9 alignment; D12 LangGraph functional API; D13 Step 3 env flip.

## 6. Current status
- Step 1 ✅ · Step 2 ✅ (LangGraph) · Step 3 ✅ · Steps 4–6 pending (backend routers+config,
  audit persistence, frontend proxy) · Step 7 voice gated by **D6** (ElevenLabs secret A/B — still open).
- `MatchResult` is still a placeholder; its pass-through of Track 2's real discriminated union is
  deferred per issue #9 #4.
- Test suite: **18 passed** (9 schema + 9 agent). Branch `track3/nexus-agents` is dev-merge-free and pushed.

## 7. Next steps
- Step 4 backend routers + config; Step 5 audit persistence; Step 6 frontend proxy routes.
- Decide **D6** so Step 7 (voice server routes) can proceed.
- Optional consolidation: package `ai/` properly (kill `sys.path` hack) and unify the LLM/settings
  seams with the backend (M4/M5/M6 from the analysis).

## 8. How to verify
From `backend/`:
```
$env:PYTHONPATH = "C:\DevLearning\LienRho\backend"
.\.venv\Scripts\pytest tests/test_nexus_schemas.py tests/test_nexus_agents.py -q
```
Expect `18 passed`.
