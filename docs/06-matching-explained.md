# Matching in NexusX — what it is and why it is here

## 1. "Matching" in this product
LienRho is an invoice-financing marketplace. A supplier has an unpaid invoice and needs cash
now; lenders (L1/L2/L3) offer to fund it at various advance rates, APRs, fees, tenors, and
recourse terms. **Matching** = taking those lender offers for one invoice opportunity and
**picking the winning bid** ("which lender funds this supplier, and on what terms"). This
selection step is also called **market clearing**.

## 2. What `ai/nexus/matching.py` contains
It is the **seam / adapter** to the marketplace engine: one contract, two implementations, one factory.
- `MatchingClient` (ABC): `match(opportunity_id, bids) -> MatchResult`.
- `MockMatchingClient`: in-memory stand-in for dev/tests. Ranks bids by a simple placeholder
  `_score` (lower APR + lower fee + faster settlement = higher score), returns a `MatchResult`
  with `simulated=True`.
- `HttpMatchingClient` (Step 3): the real call. POSTs bids to Track 2's matching endpoint via
  `httpx` (explicit timeout + tenacity retry/backoff with jitter), then maps the response into a
  `MatchResult` with `simulated=False`.
- `get_matching_client(settings)`: returns Mock or Http based on `NEXUS_MATCHING_MODE`
  (`mock` | `http`). One env var flips the whole agent from fake to real.

## 3. Where it sits in the flow
```
SupplierAgent        -> UrgencyVerdict
LenderBiddingAgent  -> list[LenderBid]
                    matching.match(opportunity_id, bids)   <-- matching.py
                            -> MatchResult (who won, score)
MarketClearingAgent -> ClearingResult
```
The agent **orchestrates**; the "who wins" decision is delegated to `matching.match(...)`.

## 4. Why it is part of this work
The agent's purpose is to clear the market, and clearing *is* matching. Two rules forbid the AI
from doing the financial selection itself:
- **D5**: the LLM only writes text, never computes money.
- **D4**: agents must not reach into Track 2 internals — they depend on an abstraction.
So `matching.py` is the clean door to the marketplace. The same agent runs against the Mock now
and the real Track 2 engine later with **zero code change** (`NEXUS_MATCHING_MODE=http`).

## 5. Honest caveat
`MockMatchingClient._score` is a **placeholder**, not the real economics — it exists so the flow
works end-to-end in dev. The genuine ranking lives in Track 2. `MatchResult` is still a
placeholder too (issue #9 #4 deferred its pass-through). When Track 2's real `MatchResult` shape
is locked, `HttpMatchingClient` just maps it in — no agent logic changes.

See also `docs/05-track3-nexusx-summary.md` for the full build narrative.
