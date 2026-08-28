# Agentic Framework Agent Layer — Internals Explained (Track 3, issue #3)

> Reference doc for the orchestrator/agents. Captures how the schemas, seams, and
> LangGraph agents fit together, and what the test suite actually proves.
> Source of truth for Track 3 I/O remains `ai/agentic_framework/schemas.py` (issue #9, blocking).

## 1. 10,000-ft view
Track 3's AI layer is contract-first: Pydantic schemas define the *shapes* of data,
agents consume/produce those shapes, and two "seams" (LLM + Track 2 matching) are
walled behind single interfaces so they can be mocked today and real tomorrow.
Everything lives in `ai/agentic_framework/` and imports only `ai.agentic_framework.*` (never `backend.app.*`).

## 2. Layer 1 — Schemas (the contracts) — `ai/agentic_framework/schemas.py`
Single source of truth for Track 3 I/O (issue #9 is blocking).

- **CamelCase at the boundary, snake_case in code.** Every field uses
  `Field(alias="supplierId")` + `model_config = ConfigDict(populate_by_name=True)`.
  JSON arrives as `supplierId`; Python uses `supplier_id`;
  `model_dump(by_alias=True)` emits `supplierId` back out. Both forms accepted.
- **Money is integer paise, never float.** `invoice_amount_paise`, `cash_need_paise`,
  `fees_paise` are `int`. Float drift across advance -> discount -> net -> effective-cost
  can flip the 3-bps demo winner. Rates (`advance_rate`, `apr`) are float 0..1.
- **Fee is an ABSOLUTE paise amount (`fees_paise`), not a rate (`feesBps`).**
- **`recourse` + `expiresAt` are required** for Track 2 scoring.

Three flows:

| Flow | Input | Output |
|------|-------|--------|
| Supplier | `SupplierInput` | `UrgencyVerdict` (level / factor / rationale) |
| Lender | `ProviderProfile` (dataclass in providers.py) | `LenderBid` (recourse, expiresAt, integer feesPaise) |
| Clearing | `ClearingRequest` (supplier + optional bids) | `ClearingResult` (verdict + lenderBids + match + summary) |

`MatchResult` is an **internal placeholder** until Step 3 replaces it with Track 2's
real discriminated-union pass-through (issue #9 #4).
`SignedUrlResponse`, `DealExplainer*`, `AgentCard` are stubs for later voice/explainer steps.

## 3. Layer 2 — Supporting modules (the seams)
- **`config.py` — `AgenticFrameworkSettings`**: `pydantic-settings` with `env_prefix="AGENTIC_FRAMEWORK_"`.
  Default `llm_enabled=False`. This one flag gates ALL LLM usage.
- **`llm.py` — `complete()` (the only LLM door)**: if `llm_enabled` is False -> returns
  `None` immediately, **no network call**. If True -> lazily imports `litellm` and calls it,
  returns text. **Financial values are never read from it** — only narrative text
  (`rationale`, `notes`, `summary`). Tests monkeypatch this one function.
- **`matching.py` — `MatchingClient` (the Track 2 door)**: ABC with
  `match(opportunity_id, bids) -> MatchResult`. Today only `MockMatchingClient` exists;
  it ranks by deterministic `_score = 1/(1 + apr*100 + fee_penalty + latency_penalty)`.
  Step 3 adds `HttpMatchingClient`. Agents depend on the abstraction, not Track 2 internals. (D4)
- **`providers.py` — `ProviderProfile` + `DEFAULT_PROVIDERS`**: 3 mock lenders
  (L1/L2/L3) with fixed terms; `fees_paise` mirror `docs/01` (Rs 2,500 = 2,500,000 paise).
- **`prompts.py`**: 3 system prompts, all strictly "explain only, never return numbers."

## 4. Layer 3 — Agents + LangGraph functional API
We use `from langgraph.func import entrypoint, task` — the **functional** API,
NOT the `StateGraph` class API (chosen for easy editing).

- `@task` turns a function into a managed *step* (node). Calling it inside an entrypoint
  schedules the step; `.result()` retrieves the value. LangGraph handles execution order,
  retries, tracing.
- `@entrypoint()` is the *workflow root*. Run it with `workflow.invoke(input)` (one
  argument — we pass a dict). The entrypoint unpacks the dict, orchestrates the tasks,
  returns the final result.

### SupplierAgent — `supplier_agent.py`
```
@task supplier_task:
    factor = 0.6*need_ratio + 0.4*time_pressure        # pure, no I/O
    level  = HIGH(>=.75) / MEDIUM(>=.45) / LOW(>=.2) / NONE
    rationale = llm.complete(...) or deterministic fallback string
    -> UrgencyVerdict
@entrypoint supplier_workflow: return supplier_task(...).result()
SupplierAgent.assess(): public API -> supplier_workflow.invoke({...})
```

### LenderBiddingAgent — `lender_bidding_agent.py`
```
@task lender_task:
    bid = LenderBid(...verbatim from ProviderProfile...)   # fees_paise = profile int, NEVER a rate
    notes = llm.complete(...) or default                   # LLM touches ONLY notes
    -> LenderBid
```
Rule **D5**: the supplier-urgency signal may influence the *note*, never the *financials*.

### MarketClearingAgent — `market_clearing_agent.py` (the orchestration)
```
@entrypoint clearing_workflow(payload):
    1. verdict = supplier_task(...).result()                    # urgency
    2. bids = request.bids or [lender_task(p).result() for p in providers]  # one bid per provider
    3. match  = matching.match(opportunity_id, bids)            # Track 2 seam (Mock today)
    4. summary = llm.complete(...) or deterministic fallback
    -> ClearingResult
```
Rule **D1**: workers never call each other — only the entrypoint composes them. That keeps
the graph acyclic and the supervisor in charge.

## 5. End-to-end flow
```
ClearingRequest
   |  clearing_workflow.invoke({request, matching, providers, settings})
   |-- supplier_task -------------> UrgencyVerdict
   |-- lender_task x N -----------> List[LenderBid]   (per DEFAULT_PROVIDERS)
   |-- matching.match(bids) ------> MatchResult       (MockMatchingClient now)
   +-- optional llm summary ------> clearing_summary
   v
ClearingResult (opportunityId, supplierVerdict, lenderBids, match, clearingSummary, simulated)
```
With `AGENTIC_FRAMEWORK_LLM_ENABLED=false` (default), `simulated=True` and every
`rationale`/`notes`/`summary` is the deterministic string — **zero external calls**.

## 6. Tests — what "pytest passed" actually means
Command run from `backend/` with `PYTHONPATH=C:\DevLearning\LienRho\backend`:
```
.\.venv\Scripts\pytest tests/test_agentic_framework_schemas.py tests/test_agentic_framework_agents.py -q
```
Exit code 0 + "15 passed" means **every assert in all 15 functions evaluated True**
(and every `pytest.raises(ValidationError)` actually raised). That is the evidence.

- **9 schema tests**: camelCase round-trip; `advanceRate=2.0` and `apr=-0.1` rejected;
  `feesPaise=2500.5` (float) and `-1` rejected; `recourse`/`expiresAt` present;
  `ClearingResult` composes; `ClearingRequest` accepts bids; voice/explainer/AgentCard shapes.
- **6 agent tests**: supplier -> HIGH when near-due + cash-heavy; -> LOW/NONE when far + low
  cash; lender bid valid (L1, int fee, recourse True, expires None); end-to-end clearing
  returns 3 bids + `match.matched=True`; LLM-disabled uses deterministic rationale;
  LLM-enabled path returns the monkeypatched text.

**Honesty / limits**: these are **unit + contract tests with mocks**. They prove the
internal math, the contracts, and the LangGraph wiring are correct. They do NOT prove:
integration with the *real* Track 2 API (MockMatchingClient), real LLM output quality
(llm off by default; LLM test injects a stub string), or performance/deployment.
"15 passed" = "the code does exactly what the spec encoded in these tests says" — not
"production-ready." Real validation lands at Step 3 (HttpMatchingClient) and when
`AGENTIC_FRAMEWORK_LLM_ENABLED=true` is flipped against a live model.

## 7. Status (as of this doc)
- Step 1 schemas (issue #9 aligned: paise, feesPaise absolute, recourse, expiresAt) — DONE
- Step 2 agents rewritten in LangGraph functional API — DONE (commit `664bf7f`)
- Step 3 MatchingClient Http + env flip — PENDING
- Steps 4-8 — PENDING
- A/B ElevenLabs-secret decision (D6) — PENDING (gates Step 7)
- Branch `track3/agentic_framework-agents` contains ONLY our commits (the dev merge was undone).
