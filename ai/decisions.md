# Track 3 - AI Decisions Log (LienRho)

> Living record of architecture decisions for Track 3 (ElevenLabs Voice AI & Agentic Framework Agents).
> Maintained so teammates can follow the reasoning without a meeting.
> Full design: docs/03b-track3-agent-architecture.md

## D1 - Multi-agent topology: Supervisor pattern
MarketClearingAgent = supervisor/coordinator; SupplierAgent + LenderBiddingAgent = workers.
- Why: production default across LangGraph/CrewAI/OpenAI. One traceable control point,
  debuggable, swappable workers. Workers NEVER call each other; control returns to supervisor.
- Source: issue #3 semantics + 2026 multi-agent pattern research.

## D2 - Single source of truth for contracts
All agent I/O lives in ai/agentic_framework/schemas.py (Pydantic v2).
- Why: FastAPI serialises these into openapi.json -> frontend/src/lib/api-types.ts, so
  frontend types stay in lockstep with zero hand-maintenance. Future TS/Option-A port maps 1:1 to Zod.

## D3 - Graceful degradation (rule-based fallback)
Each agent = deterministic core + optional LLM, gated by settings.llm_enabled.
- Why: mirrors existing RuleBasedStrategist/LLMStrategist. Layer runs fully with NO LLM key.
  Acceptance "mock/echo OK" is the DEFAULT, not a degraded mode.

## D4 - Track 2 decoupling seam
MarketClearingAgent reaches Track 2 only through MatchingClient (ABC).
- MockMatchingClient now (canned match); HttpMatchingClient later (env flip
  matching_client=http + matching_service_url). Nothing else changes.

## D5 - No LLM-computed financial values (repo non-negotiable #1)
Bids come from a deterministic generator; clearing price comes from MatchingClient.
Models may only emit interpretation/summary text.

## D6 - Secret ownership: PENDING (A vs B)
Architect assumed Next.js server routes own BOTH signed-URL issuance + TTS
(single ElevenLabs secret, single SDK - cleaner). Alt B: Python FastAPI owns signed-URL.
Either is a one-route swap. Awaiting user choice (gates Step 7).

## D7 - Branching & gating
- Branch: track3/agentic_framework-agents off dev. Each step = its own commit.
- Gate: after each major step, orchestrator reports HOW it was done + test results;
  user tests; only then next step proceeds.

## D8 - Audit by construction
Every agent returns a trace: list[str]; supervisor persists a ClearingRun to the existing
durable store. simulated flag recorded so reviewers can tell mock from real (repo #6).

## D9 - Wire types (superseded by D10 / issue #9)
Wire schemas use integer PAISE for monetary amounts and date for dates.
- Earlier draft used float; changed via issue #9 because IEEE-754 drift across
  advance->discount->net->effective-cost is the same order as the 3-bps demo gap, so float
  money can silently flip the demo winner. Track 2 enforces integer paise at its boundary.

## Structure (added)
Agentic Framework agent code is a standalone package at `ai/agentic_framework/` (importable as `ai.agentic_framework`),
kept separate from `backend/app/` for separation of concerns. The backend imports it
across the package boundary; its dependencies are declared in `ai/requirements.txt`.


## D10 - Track 2 contract alignment (issue #9, blocking)
Track 3's LenderBid/Offer mapping was mismatched with Track 2's `Offer`. Resolved:
- Lender fee = ABSOLUTE paise amount (`fees_paise: int`), NOT a bps rate. A rate would break
  the flat-fee regressive effect that docs/01's worked example depends on.
- Money across the seam = integer paise (invoice_amount_paise, cash_need_paise, fees_paise).
- LenderBid gains `recourse: bool` + `expires_at` (needed for Track 2 scoring).
- ClearingResult.lender_bids is plural (marketplace needs many competing bids to rank).
- MatchResult pass-through (Track 2's discriminated union) deferred to Step 3 MatchingClient
  seam; until then it is an internal placeholder.
- Unit conversions (advanceRate 0..1 -> bps, apr -> bps, hours -> days) owned by Track 2
  adapter (owner's offer); Track 3 keeps float rates / hours.


## D11 - Step 2 agents implemented (deterministic core + optional LLM)
SupplierAgent (urgency verdict), LenderBiddingAgent (deterministic bid generator),
MarketClearingAgent (supervisor). Each has a deterministic core; the LLM (gated by
AGENTIC_FRAMEWORK_LLM_ENABLED, default OFF) emits ONLY interpretation/narrative text - never
financials (D5). The single LLM seam is `ai.agentic_framework.llm.complete` (lazy litellm import,
so ai/ stays dependency-light). MatchingClient is an ABC; MockMatchingClient ranks bids
by effective cost until Step 3 wires HttpMatchingClient. Provider terms live as frozen
profiles in `ai/agentic_framework/providers.py`; flat fees mirror docs/01's Rs 2,500 example.

## D12 - Step 2 agents rewritten in LangGraph (functional API)
The three Agentic Framework agents now use LangGraph's FUNCTIONAL API (`from langgraph.func import
entrypoint, task`) instead of hand-rolled classes. Worker steps are `@task`s; the supervisor
is an `@entrypoint` workflow. The public class wrappers (SupplierAgent / LenderBiddingAgent /
MarketClearingAgent) are preserved so the test suite is unchanged (15 passing). Chosen over the
StateGraph/Graph API deliberately, for easy iteration. langgraph added to ai/requirements.txt.

## D13 - Step 3: HttpMatchingClient + env flip
Added a REAL HTTP matching client behind the existing `MatchingClient` seam (D4).
- `HttpMatchingClient` POSTs `{opportunity_id, bids:[...]}` to the configured URL with
  `Content-Type: application/json` and an optional `Authorization: Bearer <key>` header.
  The POST is wrapped in a tenacity retry (`stop_after_attempt(3)`,
  `wait_exponential_jitter(initial=0.5, max=2.0)`) on `httpx.HTTPError`.
  NOTE: the original design used `wait_exponential(..., jitter=True)`; the installed
  tenacity is 9.1.4, which removed that kwarg, so `wait_exponential_jitter` is used
  (same exponential-backoff-with-jitter intent, capped at 2.0s).
  The upstream JSON is mapped tolerantly into `MatchResult` (`simulated=False`).
- `get_matching_client(settings)` factory selects the backend from settings:
  `AGENTIC_FRAMEWORK_MATCHING_MODE=http` + `AGENTIC_FRAMEWORK_MATCHING_URL` set -> `HttpMatchingClient`;
  otherwise `MockMatchingClient` (the default). `AGENTIC_FRAMEWORK_MATCHING_TIMEOUT` (default 5.0)
  and `AGENTIC_FRAMEWORK_MATCHING_API_KEY` are also honoured.
- `MarketClearingAgent.__init__` now accepts `matching: MatchingClient | None = None`;
  when no client is injected, `run()` resolves the env-driven client via
  `get_matching_client(settings)`, so existing callers (passing `MockMatchingClient`
  explicitly) are unchanged and all prior tests stay green.
- `httpx>=0.27` and `tenacity>=8.0` added to `ai/requirements.txt`.
- `MatchResult` remains the internal PLACEHOLDER (issue #9 #4): the pass-through of
  Track 2's real discriminated-union MatchResult is still deferred (issue #9 #4).
  `HttpMatchingClient` does a best-effort map rather than a strict contract.
