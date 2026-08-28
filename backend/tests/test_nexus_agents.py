import pytest
from datetime import date, timedelta

from ai.nexus.agents import LenderBiddingAgent, MarketClearingAgent, SupplierAgent
from ai.nexus.config import NexusSettings
from ai.nexus.matching import MockMatchingClient
from ai.nexus.providers import DEFAULT_PROVIDERS
from ai.nexus.schemas import ClearingRequest, SupplierInput, UrgencyLevel


def _supplier(due_in_days=20, cash_ratio=0.9):
    inv = 10_000_00_00  # 100,000 INR in paise
    return SupplierInput.model_validate({
        "supplierId": "SUP-1",
        "invoiceId": "INV-1",
        "invoiceAmountPaise": inv,
        "dueDate": (date.today() + timedelta(days=due_in_days)).isoformat(),
        "creditDays": 45,
        "cashNeedPaise": int(inv * cash_ratio),
    })


def test_supplier_agent_high_urgency_when_near_due_and_cash_heavy():
    sup = _supplier(due_in_days=5, cash_ratio=0.95)
    v = SupplierAgent().assess(sup)
    assert v.level == UrgencyLevel.HIGH
    assert 0.0 <= v.factor <= 1.0
    assert "HIGH" in v.rationale.upper()


def test_supplier_agent_low_urgency_when_far_and_low_cash():
    sup = _supplier(due_in_days=80, cash_ratio=0.1)
    v = SupplierAgent().assess(sup)
    assert v.level in (UrgencyLevel.LOW, UrgencyLevel.NONE)


def test_lender_bidding_agent_produces_valid_bid():
    sup = _supplier()
    bid = LenderBiddingAgent().generate_bid(sup, DEFAULT_PROVIDERS[0])
    assert bid.provider_id == "L1"
    assert isinstance(bid.fees_paise, int) and bid.fees_paise >= 0
    assert bid.recourse is True
    assert bid.expires_at is None
    assert bid.advance_rate > 0
    assert isinstance(bid.notes, str)


def test_market_clearing_end_to_end():
    sup = _supplier(due_in_days=15, cash_ratio=0.8)
    req = ClearingRequest.model_validate({
        "opportunityId": "O1",
        "supplier": sup.model_dump(by_alias=True),
        "bids": [],
    })
    agent = MarketClearingAgent(matching=MockMatchingClient())
    result = agent.run(req)
    assert result.opportunity_id == "O1"
    assert len(result.lender_bids) == len(DEFAULT_PROVIDERS)
    assert result.match.matched is True
    assert result.supplier_verdict.level is not None
    assert result.clearing_summary


def test_llm_disabled_uses_deterministic_rationale():
    settings = NexusSettings(llm_enabled=False)
    sup = _supplier()
    v = SupplierAgent().assess(sup, settings)
    assert "HIGH" in v.rationale.upper()  # deterministic, not LLM text


def test_llm_path_uses_returned_text(monkeypatch):
    settings = NexusSettings(llm_enabled=True)
    monkeypatch.setattr(
        "ai.nexus.llm.complete",
        lambda s, sys, usr: "LLM-generated explanation.",
    )
    sup = _supplier()
    v = SupplierAgent().assess(sup, settings)
    assert v.rationale == "LLM-generated explanation."
