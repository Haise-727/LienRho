# Testing & Verifying the NexusX Layer (Track 3)

## TL;DR
Everything runs **OFFLINE by default**. The LLM is off (`NEXUS_LLM_ENABLED=false`), so
`llm.complete()` returns `None` and all narrative text is deterministic. No API key, no network.
"Evaluation" = the deterministic pytest suite + manual scripts — **not** an AI judging the output.

## Why no LLM is needed
`ai/nexus/llm.py`:
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
- One test monkeypatches `llm.complete` to prove the LLM path would be used if enabled — still no
  real model is contacted.
- Manual repro scripts confirm behavior directly.

## A. Run the suite
From `C:\DevLearning\LienRho\backend`:
```
$env:PYTHONPATH = "C:\DevLearning\LienRho\backend"
.\.venv\Scripts\pytest tests/test_nexus_schemas.py tests/test_nexus_agents.py -q
```
Expect `18 passed`.

## B. Manual script
Save as `check.py` at the repo root (`C:\DevLearning\LienRho`), then run from the repo root:
```
PYTHONPATH=C:\DevLearning\LienRho backend\.venv\Scripts\python.exe check.py
```
```python
from ai.nexus.agents import SupplierAgent, LenderBiddingAgent, MarketClearingAgent
from ai.nexus.matching import MockMatchingClient
from ai.nexus.providers import DEFAULT_PROVIDERS
from ai.nexus.schemas import SupplierInput, ClearingRequest
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
You get a full `ClearingResult` with **no LLM and no Track 2** — just the Mock.

## C. Enable the real seams (optional, when ready)
- **Real LLM**: set `NEXUS_LLM_ENABLED=true`, `NEXUS_LLM_MODEL=gpt-4o-mini`, `NEXUS_LLM_API_KEY=sk-...`.
  Install `litellm` first (currently commented out in `ai/requirements.txt`); if absent, the call
  gracefully falls back to deterministic text on import error.
- **Real Track 2**: set `NEXUS_MATCHING_MODE=http`, `NEXUS_MATCHING_URL=http://localhost:PORT/match`.
  The same `MarketClearingAgent` then calls the live matching engine with **zero code change**.

## Mental model
An offline, contract-first agent skeleton. Today its "intelligence" is deterministic rules + a mock
marketplace. The LLM and the real Track 2 engine are **optional plug-ins** switched on via env vars.
It is validated by tests and scripts, not by an AI. See also `docs/05-track3-nexusx-summary.md` and
`docs/06-matching-explained.md`.

## D. Visualize the agents (Langfuse traces + LangGraph Studio)
These are OPTIONAL and OFF by default. They do not affect the test suite (20 passing).

### Langfuse (traces UI, open-source / self-hostable)
1. Get a free Langfuse project (cloud langfuse.com) or run it locally:
   docker compose up  (official Langfuse stack -> UI at http://localhost:3000)
2. Set env (in backend/.env or your shell):
   NEXUS_LANGFUSE_ENABLED=true
   NEXUS_LANGFUSE_HOST=http://localhost:3000
   NEXUS_LANGFUSE_PUBLIC_KEY=pk-...
   NEXUS_LANGFUSE_SECRET_KEY=sk-...
3. Run any agent (pytest or the manual script in section B). Open Langfuse -> Tracing to see
   clearing_workflow with supplier_task -> lender_task x N -> match spans, latency, tokens.

### LangGraph Studio (interactive graph UI)
Needs a FREE LangSmith key for login ONLY. Set LANGSMITH_TRACING=false so no data leaves your machine.
1. pip install "langgraph-cli[inmem]"
2. From repo root create a .env with at least:
   LANGSMITH_API_KEY=lsv2...
   LANGSMITH_TRACING=false
3. From repo root run: langgraph dev
4. Open the printed Studio URL
   (https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024)
   and interact with the nexus_clearing graph defined in langgraph.json.

See docs/08-observability.md for the full picture.
