"""Pydantic v2 contracts for the NexusX agent layer (Track 3).

Contract note (issue #9, blocking): these are the single source of truth for
Track 3 I/O.
- Money crosses the seam as INTEGER PAISE (never float): IEEE-754 drift across
  advance -> discount -> net -> effective-cost can flip the 3-bps demo winner.
- Lender fee is an ABSOLUTE flat amount in paise (feesPaise), NOT a rate
  (feesBps). A proportional fee would erase the regressive-fee effect that the
  docs/01 worked example depends on.
- Rates (advanceRate, apr) stay float 0..1; Track 2 adapts them to bps.
- recourse + expiresAt are required for Track 2 scoring.
- MatchResult is an internal placeholder; Step 3 (MatchingClient seam) replaces
  it with a pass-through of Track 2's discriminated-union MatchResult (issue #9 #4).
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class UrgencyLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class SupplierInput(BaseModel):
    """Supplier side of a clearing opportunity. Money is integer paise."""
    model_config = ConfigDict(populate_by_name=True)

    supplier_id: str = Field(alias="supplierId")
    invoice_id: str = Field(alias="invoiceId")
    invoice_amount_paise: int = Field(alias="invoiceAmountPaise", gt=0)
    due_date: date = Field(alias="dueDate")
    credit_days: int = Field(alias="creditDays", gt=0)
    cash_need_paise: int = Field(alias="cashNeedPaise", gt=0)
    currency: str = Field(default="INR", alias="currency")
    notes: str = Field(default="", alias="notes")


class UrgencyVerdict(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    level: UrgencyLevel
    factor: float = Field(ge=0, le=1)
    rationale: str
    simulated: bool = False
    confidence: float = Field(default=1.0, ge=0, le=1)


class LenderBid(BaseModel):
    """One lender's offer.

    Fee is an ABSOLUTE paise amount (issue #9 #1). Rates are float 0..1; Track 2
    adapts to bps. recourse/expiresAt are needed for Track 2 scoring (issue #9 #3).
    """
    model_config = ConfigDict(populate_by_name=True)

    provider_id: str = Field(alias="providerId")
    provider_name: str = Field(alias="providerName")
    advance_rate: float = Field(alias="advanceRate", gt=0, le=1)
    apr: float = Field(alias="apr", gt=0, le=1)
    fees_paise: int = Field(alias="feesPaise", ge=0)
    disbursal_latency_hours: int = Field(alias="disbursalLatencyHours", ge=0)
    tenor_days: int = Field(alias="tenorDays", gt=0)
    recourse: bool = Field(alias="recourse")
    expires_at: Optional[datetime] = Field(default=None, alias="expiresAt")
    confidence: float = Field(alias="confidence", ge=0, le=1)
    notes: str = Field(default="", alias="notes")
    simulated: bool = Field(default=False, alias="simulated")


class MatchResult(BaseModel):
    """Internal placeholder. Step 3 replaces with Track 2's MatchResult
    pass-through (issue #9 #4)."""
    model_config = ConfigDict(populate_by_name=True)

    match_id: str = Field(alias="matchId")
    matched: bool = Field(alias="matched")
    matched_bid_ref: Optional[str] = Field(default=None, alias="matchedBidRef")
    score: float = Field(alias="score", ge=0, le=1)
    notes: str = Field(default="", alias="notes")
    simulated: bool = Field(default=False, alias="simulated")


class ClearingRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    opportunity_id: str = Field(alias="opportunityId")
    supplier: SupplierInput = Field(alias="supplier")
    bids: List[LenderBid] = Field(default_factory=list, alias="bids")


class ClearingResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    opportunity_id: str = Field(alias="opportunityId")
    supplier_verdict: UrgencyVerdict = Field(alias="supplierVerdict")
    lender_bids: List[LenderBid] = Field(alias="lenderBids")  # plural (issue #9 #5)
    match: MatchResult = Field(alias="match")
    clearing_summary: str = Field(alias="clearingSummary")
    simulated: bool = Field(default=False, alias="simulated")


class SignedUrlResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    url: str = Field(alias="url")
    expires_at: Optional[datetime] = Field(default=None, alias="expiresAt")
    provider: str = Field(default="elevenlabs", alias="provider")


class DealExplainerRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    supplier_id: str = Field(alias="supplierId")
    opportunity_id: str = Field(alias="opportunityId")
    audience: str = Field(default="borrower", alias="audience")


class DealExplainerResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    opportunity_id: str = Field(alias="opportunityId")
    narrative: str = Field(alias="narrative")
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="generatedAt")
    simulated: bool = Field(default=False, alias="simulated")


class AgentCard(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="id")
    name: str = Field(alias="name")
    role: str = Field(alias="role")
    model: str = Field(alias="model")
    tools: List[str] = Field(default_factory=list, alias="tools")
    description: str = Field(default="", alias="description")


