# Testing & Verifying the Agentic Framework Layer (Track 3)

## TL;DR
Everything runs **OFFLINE by default**. The LLM is off (`AGENTIC_FRAMEWORK_LLM_ENABLED=false`), so
`llm.complete()` returns `None` and all narrative text is deterministic. No API key, no network.
"Evaluation" = the deterministic pytest suite + manual scripts -- **not** an AI judging the output.

## Why no LLM is needed
`ai/agentic_framework/llm.py`:
```
def complete(settings, system, user):
    if not settings.llm_enabled:
        return None
    ...
```
When it returns `None`, every agent falls back to a templated f-string for its text
(`rationale`, `notes`, `clearing_summary`). The **financials** (urgency factor, bids, match
selection) are always computed deterministically and are **identical** whether or not the LLM is on.

## How it is actually verified
- **pytest (18 passing)**: tests the math, bid generation, mock matching, and LangGraph wiring.
  No provider needed.
- One test monkeypatches `llm.complete` to prove the LLM path would be used if enabled -- still no
  real model is contacted.
- Manual repro scripts confirm behavior directly.

## A. Run the suite
From `C:\DevLearning\LienRho\backend`:
```
$env:PYTHONPATH = "C:\DevLearning\LienRho\backend"
.\.venv\Scripts\pytest tests/test_agentic_framework_schemas.py tests/test_agentic_framework_agents.py -q
```
Expect `18 passed`.

## B. Manual script
Save as `check.py` at the repo root (`C:\DevLearning\LienRho`), then run from the repo root:
```
PYTHONPATH=C:\DevLearning\LienRho backend\.venv\Scripts\python.exe check.py
```
```python
from ai.agentic_framework.agents import SupplierAgent, LenderBiddingAgent, MarketClearingAgent
from ai.agentic_framework.matching import MockMatchingClient
from ai.agentic_framework.providers import DEFAULT_PROVIDERS
from ai.agentic_framework.schemas import SupplierInput, ClearingRequest
from datetime import date, timedelta

sup = SupplierInput.model_validate({
    "supplierId":"SUP-1","invoiceId":"INV-1","invoiceAmountPaise":10_000_000,
    "dueDate":(date.today()+timedelta(days=10)).isoformat(),"creditDays":45,"cashNeedPaise":8_000_000})

print("URGENCY :", SupplierAgent().assess(sup).model_dump(by_alias=True))
print("BID L1   :", LenderBiddingAgent().generate_bid(sup, DEFAULT_PROVIDERS[0]).model_dump(by_alias=True))

req = ClearingRequest(opportunity_id="O1", supplier=sup, bids=[])
res = MarketClearingAgent(matching=MockMatchingClient()).run(req)
print("MATCHED  :", res.match.matched, "| WINNER:", res.match.matched_bid_ref)
print("SUMMARY  :", res.clearing_summary)
```
You get a full `ClearingResult` with **no LLM and no Track 2** -- just the Mock.

## C. Enable the real seams (optional, when ready)
- **Real LLM**: set `AGENTIC_FRAMEWORK_LLM_ENABLED=true`, `AGENTIC_FRAMEWORK_LLM_MODEL=gpt-4o-mini`, `AGENTIC_FRAMEWORK_LLM_API_KEY=sk-...`.
  Install `litellm` first (currently commented out in `ai/requirements.txt`); if absent, the call
  gracefully falls back to deterministic text on import error.
- **Real Track 2**: set `AGENTIC_FRAMEWORK_MATCHING_MODE=http`, `AGENTIC_FRAMEWORK_MATCHING_URL=http://localhost:PORT/match`.
  The same `MarketClearingAgent` then calls the live matching engine with **zero code change**.

## D. Visualize the workflow offline (no LLM, no external services)
You do NOT need LangSmith / Langfuse / Studio to see the agent work. Run the bundled tracer:
```
backend\.venv\Scripts\python.exe scripts/run_clearing.py
```
It prints each step's real inputs/outputs and timing (supplier verdict, the 3 lender bids, the
match result). The LLM only writes `clearing_summary`; every financial decision is deterministic and
shown regardless of `AGENTIC_FRAMEWORK_LLM_ENABLED`.

## Mental model
An offline, contract-first agent skeleton. Today its "intelligence" is deterministic rules + a mock
marketplace. The LLM and the real Track 2 engine are **optional plug-ins** switched on via env vars.
It is validated by tests and scripts, not by an AI. See also `docs/05-track3-agentic_frameworkx-summary.md` and
`docs/06-matching-explained.md`.
