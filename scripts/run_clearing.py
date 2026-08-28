"""Offline workflow tracer for the NexusX MarketClearingAgent.

Run from repo root:
    backend/.venv/Scripts/python.exe scripts/run_clearing.py

No LLM, no network, no external services. Prints each step's real inputs/outputs and
timing so you can SEE the agent work even with NEXUS_LLM_ENABLED=false.
"""
from __future__ import annotations

import sys
import time
from datetime import date, timedelta

from ai.nexus.agents import LenderBiddingAgent, MarketClearingAgent, SupplierAgent
from ai.nexus.matching import MockMatchingClient
from ai.nexus.providers import DEFAULT_PROVIDERS
from ai.nexus.schemas import ClearingRequest, SupplierInput


def _ms(t0: float) -> str:
    return f"{1000 * (time.perf_counter() - t0):.1f} ms"


def main() -> int:
    sup = SupplierInput.model_validate({
        "supplierId": "SUP-1",
        "invoiceId": "INV-1",
        "invoiceAmountPaise": 10_000_000,
        "dueDate": (date.today() + timedelta(days=10)).isoformat(),
        "creditDays": 45,
        "cashNeedPaise": 5_000_000,
    })

    print("=" * 72)
    print("NEXUSX MARKET-CLEARING WORKFLOW  (offline trace, no LLM)")
    print("=" * 72)

    t0 = time.perf_counter()
    print("\n[1] SupplierAgent.assess")
    print("    input :", sup.model_dump(by_alias=True))
    verdict = SupplierAgent().assess(sup)
    print("    output:", verdict.model_dump(by_alias=True))
    print("    took  :", _ms(t0))

    print("\n[2] LenderBiddingAgent.generate_bid  (one bid per provider, risk-loaded)")
    bids = []
    for p in DEFAULT_PROVIDERS:
        tb = time.perf_counter()
        bid = LenderBiddingAgent().generate_bid(sup, p, urgency_factor=verdict.factor)
        bids.append(bid)
        print(f"    - {p.provider_name:24s} -> {bid.model_dump(by_alias=True)}  ({_ms(tb)})")

    print("\n[3] MarketClearingAgent.run  (mock matching)")
    req = ClearingRequest(opportunity_id="O1", supplier=sup, bids=[])
    tr = time.perf_counter()
    res = MarketClearingAgent(matching=MockMatchingClient()).run(req)
    print("    match       :", res.match.model_dump(by_alias=True))
    print("    lender_bids :", [b.provider_id for b in res.lender_bids])
    print("    summary     :", res.clearing_summary)
    print("    simulated   :", res.simulated)
    print("    took        :", _ms(tr))

    print("\n" + "=" * 72)
    print("DONE. Every value above is deterministic math -- no LLM involved.")
    print("The LLM (if enabled) only writes `clearing_summary`; all real decisions")
    print("are computed and printed here regardless of NEXUS_LLM_ENABLED.")
    print("=" * 72)
    return 0


if __name__ == "__main__":
    sys.exit(main())
