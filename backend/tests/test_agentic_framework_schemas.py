import pytest
from datetime import date, datetime
from pydantic import ValidationError

from ai.agentic_framework.schemas import (
    SupplierInput,
    UrgencyLevel,
    UrgencyVerdict,
    LenderBid,
    MatchResult,
    ClearingRequest,
    ClearingResult,
    SignedUrlResponse,
    DealExplainerRequest,
    DealExplainerResponse,
    AgentCard,
)


def test_supplier_input_camel_alias_and_roundtrip():
    raw = {
        "supplierId": "SUP-1",
        "invoiceId": "INV-1",
        "invoiceAmountPaise": 1200000000,
        "dueDate": "2026-09-30",
        "creditDays": 45,
        "cashNeedPaise": 900000000,
        "currency": "INR",
        "notes": "urgent",
    }
    obj = SupplierInput.model_validate(raw)
    assert obj.invoice_amount_paise == 1200000000
    out = obj.model_dump(by_alias=True, mode="json")
    assert out["invoiceAmountPaise"] == 1200000000
    assert out["dueDate"] == "2026-09-30"
    # snake also accepted (populate_by_name)
    alt = SupplierInput.model_validate({
        "supplier_id": "SUP-1",
        "invoice_id": "INV-1",
        "invoice_amount_paise": 100,
        "due_date": "2026-09-30",
        "credit_days": 10,
        "cash_need_paise": 50,
    })
    assert alt.invoice_amount_paise == 100


def test_bid_rate_bounds_reject():
    base = dict(
        providerId="P",
        providerName="Mock",
        advanceRate=0.8,
        apr=0.12,
        feesPaise=250000,
        disbursalLatencyHours=24,
        tenorDays=30,
        recourse=True,
        confidence=0.9,
    )
    with pytest.raises(ValidationError):
        LenderBid.model_validate({**base, "advanceRate": 2.0})
    with pytest.raises(ValidationError):
        LenderBid.model_validate({**base, "apr": -0.1})
    # fee must be an integer paise amount, never a float/rate
    with pytest.raises(ValidationError):
        LenderBid.model_validate({**base, "feesPaise": 2500.5})
    with pytest.raises(ValidationError):
        LenderBid.model_validate({**base, "feesPaise": -1})


def test_lender_bid_fee_is_absolute_amount():
    bid = LenderBid.model_validate(dict(
        providerId="P", providerName="Mock", advanceRate=0.8, apr=0.12,
        feesPaise=250000, disbursalLatencyHours=24, tenorDays=30,
        recourse=False, confidence=0.9,
    ))
    assert bid.model_dump(by_alias=True)["feesPaise"] == 250000


def test_recourse_and_expiry_present():
    bid = LenderBid.model_validate(dict(
        providerId="P", providerName="Mock", advanceRate=0.8, apr=0.12,
        feesPaise=250000, disbursalLatencyHours=24, tenorDays=30,
        recourse=True, expiresAt="2026-10-01T12:00:00", confidence=0.9,
    ))
    assert bid.recourse is True
    assert bid.expires_at == datetime(2026, 10, 1, 12, 0, 0)
    out = bid.model_dump(by_alias=True, mode="json")
    assert out["expiresAt"] == "2026-10-01T12:00:00"
    assert out["recourse"] is True


def test_match_result_and_clearing_result_compose():
    bid = LenderBid.model_validate(dict(
        providerId="P", providerName="Mock", advanceRate=0.8, apr=0.12,
        feesPaise=250000, disbursalLatencyHours=24, tenorDays=30,
        recourse=True, confidence=0.9,
    ))
    verdict = UrgencyVerdict(level=UrgencyLevel.HIGH, factor=0.9, rationale="cash gap")
    match = MatchResult.model_validate({
        "matchId": "M1", "matched": True, "matchedBidRef": "P",
        "score": 0.91, "notes": "ok", "simulated": True,
    })
    result = ClearingResult(
        opportunity_id="O1",
        supplier_verdict=verdict,
        lender_bids=[bid],
        match=match,
        clearing_summary="ok",
        simulated=True,
    )
    dumped = result.model_dump(by_alias=True)
    assert dumped["lenderBids"][0]["advanceRate"] == 0.8
    assert dumped["match"]["matched"] is True
    assert isinstance(dumped["lenderBids"], list)


def test_clearing_request_accepts_bid_list():
    req = ClearingRequest.model_validate({
        "opportunityId": "O1",
        "supplier": {
            "supplierId": "SUP-1", "invoiceId": "INV-1",
            "invoiceAmountPaise": 1200000000, "dueDate": "2026-09-30",
            "creditDays": 45, "cashNeedPaise": 900000000,
        },
        "bids": [{
            "providerId": "P", "providerName": "Mock", "advanceRate": 0.8,
            "apr": 0.12, "feesPaise": 250000, "disbursalLatencyHours": 24,
            "tenorDays": 30, "recourse": True, "confidence": 0.9,
        }],
    })
    assert len(req.bids) == 1
    assert req.supplier.invoice_amount_paise == 1200000000


def test_voice_signed_url_shape():
    r = SignedUrlResponse(url="https://x/y", provider="elevenlabs")
    d = r.model_dump(by_alias=True)
    assert d == {"url": "https://x/y", "expiresAt": None, "provider": "elevenlabs"}


def test_deal_explainer_shape():
    req = DealExplainerRequest.model_validate({"supplierId": "SUP-1", "opportunityId": "O1"})
    assert req.supplier_id == "SUP-1"
    resp = DealExplainerResponse(opportunity_id="O1", narrative="n")
    d = resp.model_dump(by_alias=True)
    assert d["narrative"] == "n"
    assert "generatedAt" in d


def test_agent_card_shape():
    card = AgentCard(id="supplier-agent", name="Supplier Agent", role="supplier",
                     model="gpt-4o", tools=["x"])
    d = card.model_dump(by_alias=True)
    assert d["id"] == "supplier-agent"
    assert d["tools"] == ["x"]
