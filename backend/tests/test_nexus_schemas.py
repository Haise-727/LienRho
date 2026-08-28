"""Contract validation for Track 3 NexusX schemas (no LLM / no other track needed)."""

from datetime import date

import pytest

from ai.nexus.schemas import (
    ClearingRequest,
    ClearingResult,
    DealExplainerRequest,
    DealExplainerResponse,
    LenderBid,
    LenderBidRequest,
    MatchResult,
    SignedUrlResponse,
    SupplierInput,
    UrgencyLevel,
    UrgencyVerdict,
)


def _verdict() -> UrgencyVerdict:
    return UrgencyVerdict(
        urgency_level=UrgencyLevel.HIGH,
        rationale="Due soon, high cash need.",
        confidence=0.8,
        factors=["due in 9d"],
    )


def test_supplier_input_camel_alias_and_roundtrip():
    raw = {
        "supplierId": "SUP-1",
        "invoiceId": "INV-1",
        "invoiceAmount": 120000.0,
        "dueDate": "2026-09-30",
        "creditDays": 45,
        "cashNeed": 90000.0,
    }
    obj = SupplierInput.model_validate(raw)
    assert obj.invoice_amount == 120000.0
    out = obj.model_dump(by_alias=True, mode="json")
    assert out["invoiceAmount"] == 120000.0
    assert out["dueDate"] == "2026-09-30"
    # snake_case also accepted (populate_by_name)
    alt = SupplierInput.model_validate(
        {
            "supplier_id": "SUP-1",
            "invoice_id": "INV-1",
            "invoice_amount": 1.0,
            "due_date": "2026-09-30",
            "credit_days": 1,
            "cash_need": 0.5,
        }
    )
    assert alt.supplier_id == "SUP-1"


def test_supplier_input_rejects_nonpositive_amount():
    with pytest.raises(Exception):
        SupplierInput(
            supplier_id="S",
            invoice_id="I",
            invoice_amount=0,
            due_date=date(2026, 1, 1),
            credit_days=1,
            cash_need=1,
        )


def test_urgency_enum_constrained():
    with pytest.raises(Exception):
        UrgencyVerdict(urgency_level="NOPE", rationale="x", confidence=0.5)
    with pytest.raises(Exception):
        UrgencyVerdict(urgency_level=UrgencyLevel.LOW, rationale="x", confidence=1.5)


def test_lender_bid_rates_bounded():
    with pytest.raises(Exception):
        LenderBid(
            provider_id="P",
            provider_name="Mock",
            advance_rate=2.0,
            apr=0.1,
            fees_bps=10,
            disbursal_latency_hours=1,
            tenor_days=5,
            confidence=0.9,
            simulated=True,
        )


def test_match_result_and_clearing_result_compose():
    bid = LenderBid(
        provider_id="P",
        provider_name="Mock",
        advance_rate=0.75,
        apr=0.14,
        fees_bps=120,
        disbursal_latency_hours=24,
        tenor_days=30,
        confidence=0.9,
        simulated=True,
    )
    match = MatchResult(
        match_id="M1", matched=True, matched_bid_ref="P", score=0.91, simulated=True
    )
    result = ClearingResult(
        opportunity_id="O1",
        supplier_verdict=_verdict(),
        lender_bid=bid,
        match=match,
        clearing_summary="ok",
        simulated=True,
    )
    dumped = result.model_dump(by_alias=True)
    assert dumped["opportunityId"] == "O1"
    assert dumped["lenderBid"]["advanceRate"] == 0.75
    assert dumped["match"]["matched"] is True


def test_lender_bid_request_nests_verdict():
    req = LenderBidRequest(
        opportunity_id="O1", verdict=_verdict(), advance_amount=90000, tenor_days=30
    )
    assert req.verdict.urgency_level == UrgencyLevel.HIGH


def test_clearing_request_nests_supplier():
    si = SupplierInput(
        supplier_id="S",
        invoice_id="I",
        invoice_amount=1000,
        due_date=date(2026, 1, 1),
        credit_days=30,
        cash_need=500,
    )
    cr = ClearingRequest(opportunity_id="O1", supplier_input=si)
    assert cr.supplier_input.invoice_amount == 1000


def test_voice_shapes():
    sur = SignedUrlResponse(simulated=True)
    assert sur.model_dump(by_alias=True) == {
        "signedUrl": None,
        "agentId": None,
        "expiresAt": None,
        "simulated": True,
    }
    der = DealExplainerRequest(
        deal_id="O1",
        clearing_request=ClearingRequest(
            opportunity_id="O1",
            supplier_input=SupplierInput(
                supplier_id="S",
                invoice_id="I",
                invoice_amount=1000,
                due_date=date(2026, 1, 1),
                credit_days=30,
                cash_need=500,
            ),
        ),
    )
    assert der.deal_id == "O1"
    resp = DealExplainerResponse(script="hi", simulated=True)
    assert resp.model_dump(by_alias=True)["simulated"] is True


