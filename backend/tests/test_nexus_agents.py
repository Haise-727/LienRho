import pytest
from datetime import date, timedelta

import httpx
from ai.nexus.agents import LenderBiddingAgent, MarketClearingAgent, SupplierAgent
from ai.nexus.config import NexusSettings
from ai.nexus.matching import HttpMatchingClient, MockMatchingClient, get_matching_client
from ai.nexus.providers import DEFAULT_PROVIDERS
from ai.nexus.schemas import ClearingRequest, LenderBid, SupplierInput, UrgencyLevel


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


def test_get_matching_client_default_mock():
    assert isinstance(
        get_matching_client(NexusSettings(matching_mode="mock")), MockMatchingClient
    )


def test_get_matching_client_http():
    assert isinstance(
        get_matching_client(NexusSettings(matching_mode="http", matching_url="http://x")),
        HttpMatchingClient,
    )


def test_http_matching_client_maps_response(monkeypatch):
    class _FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "matchId": "M1",
                "matched": True,
                "matchedBidRef": "P",
                "score": 0.9,
                "notes": "ok",
            }

    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResp())

    bid = LenderBid.model_validate({
        "providerId": "P",
        "providerName": "Lender P",
        "advanceRate": 0.8,
        "apr": 0.12,
        "feesPaise": 250000,
        "disbursalLatencyHours": 24,
        "tenorDays": 45,
        "recourse": True,
        "confidence": 0.9,
    })
    sup = _supplier()
    result = HttpMatchingClient("http://x").match("O1", [bid], sup, sup.invoice_amount_paise)
    assert result.matched is True
    assert result.matched_bid_ref == "P"
    assert result.score == 0.9
    assert result.simulated is False


def test_underfunded_provider_excluded_from_ranking():
    """Provider L3 advances only 72% but the supplier needs 80% of the invoice, so
    its gross advance does NOT cover the cash need. It must be flagged
    disqualified/ineligible and kept out of the ranking."""
    sup = _supplier(due_in_days=15, cash_ratio=0.8)
    req = ClearingRequest.model_validate({
        "opportunityId": "O-UNDER",
        "supplier": sup.model_dump(by_alias=True),
        "bids": [],
    })
    agent = MarketClearingAgent(matching=MockMatchingClient())
    result = agent.run(req)
    underfunded = next((c for c in result.ranked_bids if c.provider_id == "L3"), None)
    assert underfunded is not None
    assert underfunded.disqualified is True
    assert underfunded.disqualify_reason is not None
    assert "cash" in underfunded.disqualify_reason.lower()


def test_underfunded_provider_never_wins():
    """An under-funded provider (advance*invoice < cash_need) must never be selected
    as the winner, even though it may have a tempting headline APR."""
    sup = _supplier(due_in_days=15, cash_ratio=0.8)
    req = ClearingRequest.model_validate({
        "opportunityId": "O-NEVER",
        "supplier": sup.model_dump(by_alias=True),
        "bids": [],
    })
    agent = MarketClearingAgent(matching=MockMatchingClient())
    result = agent.run(req)
    assert result.match.matched is True
    # L3 (72% advance) cannot cover an 80% cash need -> must not win.
    assert result.match.matched_bid_ref != "L3"
    winner = next((c for c in result.ranked_bids if c.is_winner), None)
    assert winner is not None
    assert "advance does not cover" not in (winner.disqualify_reason or "")


def test_highest_advance_fallback_when_no_provider_covers_cash_need():
    """If NO provider's advance covers the cash need, the engine falls back to the
    single highest-advance funder and flags it in the result reasoning."""
    sup = _supplier(due_in_days=15, cash_ratio=0.99)
    req = ClearingRequest.model_validate({
        "opportunityId": "O-FALLBACK",
        "supplier": sup.model_dump(by_alias=True),
        "bids": [],
    })
    agent = MarketClearingAgent(matching=MockMatchingClient())
    result = agent.run(req)
    assert result.match.matched is True
    # L2 has the highest advance_rate (0.97) among the panel.
    assert result.match.matched_bid_ref == "L2"
    assert "fallback" in result.match.notes.lower()
    assert any("fallback" in t.lower() for t in result.agent_trace)
