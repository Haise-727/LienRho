"""Typed I/O contracts for the Track 3 NexusX agents (issue #3).

Single source of truth for every agent's input and output. FastAPI serialises
these into openapi.json, which regenerates frontend/src/lib/api-types.ts - so the
frontend stays in lockstep with zero hand-maintenance, and a future TS/Option-A
rewrite maps 1:1 to Zod.

Convention (matches api/schemas.py): camelCase on the wire via serialization_alias,
populate_by_name=True so snake_case is also accepted, float for money, date for dates.
Every agent output is a validated object - free text from an LLM is never passed
through (repo non-negotiable #1: no model computes a financial figure).
"""

from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class UrgencyLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# --------------------------------------------------------------------------- #
# SupplierAgent
# --------------------------------------------------------------------------- #


class SupplierInput(BaseModel):
    """A supplier working-capital request for the urgency interpreter."""

    model_config = ConfigDict(populate_by_name=True)

    supplier_id: str = Field(alias="supplierId")
    invoice_id: str = Field(alias="invoiceId")
    invoice_amount: float = Field(alias="invoiceAmount", gt=0)
    due_date: date = Field(alias="dueDate")
    credit_days: int = Field(alias="creditDays", ge=0)
    cash_need: float = Field(alias="cashNeed", ge=0)
    currency: str = Field(default="INR", alias="currency")
    notes: str = Field(default="", alias="notes")


class UrgencyVerdict(BaseModel):
    """SupplierAgent output: how urgent is this request."""

    model_config = ConfigDict(populate_by_name=True)

    urgency_level: UrgencyLevel = Field(alias="urgencyLevel")
    rationale: str = Field(alias="rationale")
    confidence: float = Field(ge=0.0, le=1.0, alias="confidence")
    factors: list[str] = Field(default_factory=list, alias="factors")
    fallback_reason: str | None = Field(
        default=None, alias="fallbackReason"
    )
    trace: list[str] = Field(default_factory=list, alias="trace")


# --------------------------------------------------------------------------- #
# LenderBiddingAgent
# --------------------------------------------------------------------------- #


class LenderBidRequest(BaseModel):
    """Input to the lender bidding agent: the opportunity + supplier verdict."""

    model_config = ConfigDict(populate_by_name=True)

    opportunity_id: str = Field(alias="opportunityId")
    verdict: UrgencyVerdict
    advance_amount: float = Field(alias="advanceAmount", gt=0)
    tenor_days: int = Field(alias="tenorDays", ge=1)
    risk_tier: str = Field(default="B", alias="riskTier")


class LenderBid(BaseModel):
    """LenderBiddingAgent output: a (mock) capital-provider bid.

    The numbers come from a deterministic generator, never an LLM.
    """

    model_config = ConfigDict(populate_by_name=True)

    provider_id: str = Field(alias="providerId")
    provider_name: str = Field(alias="providerName")
    advance_rate: float = Field(ge=0.0, le=1.0, alias="advanceRate")
    apr: float = Field(ge=0.0, le=1.0, alias="apr")
    fees_bps: float = Field(ge=0.0, alias="feesBps")
    disbursal_latency_hours: int = Field(
        alias="disbursalLatencyHours", ge=0
    )
    tenor_days: int = Field(alias="tenorDays", ge=1)
    confidence: float = Field(ge=0.0, le=1.0, alias="confidence")
    simulated: bool = Field(alias="simulated")
    fallback_reason: str | None = Field(
        default=None, alias="fallbackReason"
    )
    trace: list[str] = Field(default_factory=list, alias="trace")


# --------------------------------------------------------------------------- #
# MatchingClient (Track 2 seam)
# --------------------------------------------------------------------------- #


class MatchResult(BaseModel):
    """Outcome of a market-clearing match, produced by MatchingClient (Track 2)."""

    model_config = ConfigDict(populate_by_name=True)

    match_id: str = Field(alias="matchId")
    matched: bool = Field(alias="matched")
    matched_bid_ref: str | None = Field(
        default=None, alias="matchedBidRef"
    )
    score: float = Field(ge=0.0, le=1.0, alias="score")
    notes: str = Field(default="", alias="notes")
    simulated: bool = Field(alias="simulated")


# --------------------------------------------------------------------------- #
# MarketClearingAgent (supervisor)
# --------------------------------------------------------------------------- #


class ClearingRequest(BaseModel):
    """Supervisor entry point: clear one financing opportunity."""

    model_config = ConfigDict(populate_by_name=True)

    opportunity_id: str = Field(alias="opportunityId")
    supplier_input: SupplierInput = Field(alias="supplierInput")
    market_context: dict = Field(
        default_factory=dict, alias="marketContext"
    )


class ClearingResult(BaseModel):
    """MarketClearingAgent output: the aggregated clearing decision."""

    model_config = ConfigDict(populate_by_name=True)

    opportunity_id: str = Field(alias="opportunityId")
    supplier_verdict: UrgencyVerdict = Field(alias="supplierVerdict")
    lender_bid: LenderBid = Field(alias="lenderBid")
    match: MatchResult
    clearing_summary: str = Field(alias="clearingSummary")
    agent_trace: list[str] = Field(
        default_factory=list, alias="agentTrace"
    )
    simulated: bool = Field(alias="simulated")


# --------------------------------------------------------------------------- #
# Voice / ElevenLabs (Next.js owns the secret; these are the JSON shapes)
# --------------------------------------------------------------------------- #


class SignedUrlResponse(BaseModel):
    """Response from GET /api/voice/signed-url."""

    model_config = ConfigDict(populate_by_name=True)

    signed_url: str | None = Field(default=None, alias="signedUrl")
    agent_id: str | None = Field(default=None, alias="agentId")
    expires_at: str | None = Field(default=None, alias="expiresAt")
    simulated: bool = Field(alias="simulated")


class DealExplainerRequest(BaseModel):
    """POST /api/voice/deal-explainer body (passed through to /api/nexus/clear)."""

    model_config = ConfigDict(populate_by_name=True)

    deal_id: str = Field(alias="dealId")
    clearing_request: ClearingRequest = Field(alias="clearingRequest")


class DealExplainerResponse(BaseModel):
    """POST /api/voice/deal-explainer response."""

    model_config = ConfigDict(populate_by_name=True)

    script: str
    audio_url: str | None = Field(default=None, alias="audioUrl")
    simulated: bool = Field(alias="simulated")


# --------------------------------------------------------------------------- #
# Agent card (A2A / MCP seam - GET /api/nexus/agents)
# --------------------------------------------------------------------------- #


class AgentCard(BaseModel):
    """A discoverable capability description for a future A2A/MCP wrapper."""

    model_config = ConfigDict(populate_by_name=True)

    agent_id: str = Field(alias="agentId")
    role: str
    input_schema: str = Field(alias="inputSchema")
    output_schema: str = Field(alias="outputSchema")
    endpoint: str
    is_supervisor: bool = Field(alias="isSupervisor")
    workers: list[str] = Field(default_factory=list, alias="workers")

