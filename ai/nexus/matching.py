from abc import ABC, abstractmethod
from datetime import date

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from ai.nexus.config import NexusSettings
from ai.nexus.schemas import LenderBid, MatchResult


# Small safety buffer subtracted from the time-to-due window so a bid that only
# *just* meets the deadline is not trusted to settle in time.
_TIMING_BUFFER_HOURS = 2.0


def effective_annual_cost(bid: LenderBid, invoice_paise: int) -> float:
    """Supplier's true annualized cost of taking a factoring bid (lower is better).

    Pure, deterministic math only -- never an LLM figure (D5). Mirrors the
    evaluation ground truth so the matcher and the scorecard cannot drift apart.
        cash_received = advance*invoice - fees
        if cash_received <= 0 -> +inf (non-viable)
        interest      = advance*invoice*apr*(tenor/365)
        cost          = fees + interest
        eac           = (cost / max(1, cash_received)) * (365 / max(1, tenor))
    """
    cash_received = bid.advance_rate * invoice_paise - (bid.fees_paise or 0)
    if cash_received <= 0:
        return float("inf")
    interest = bid.advance_rate * invoice_paise * bid.apr * (bid.tenor_days / 365.0)
    cost = (bid.fees_paise or 0) + interest
    eac = (cost / max(1, cash_received)) * (365.0 / max(1, bid.tenor_days))
    return eac


def _hours_to_due(supplier) -> float:
    return max(0.0, (supplier.due_date - date.today()).days * 24.0)


def _passes_sufficiency(bid: LenderBid, supplier, invoice_paise: int) -> bool:
    """A bid that under-funds the supplier's cash need is not a real option."""
    cash_received = bid.advance_rate * invoice_paise - (bid.fees_paise or 0)
    return cash_received >= supplier.cash_need_paise


def _passes_timing(bid: LenderBid, supplier) -> bool:
    """A bid must be able to settle before the invoice falls due (minus buffer)."""
    hours_to_due = _hours_to_due(supplier)
    return bid.disbursal_latency_hours <= max(0.0, hours_to_due - _TIMING_BUFFER_HOURS)


def is_survivor(bid: LenderBid, supplier, invoice_paise: int) -> bool:
    """A bid clears both the sufficiency and timing gates."""
    return _passes_sufficiency(bid, supplier, invoice_paise) and _passes_timing(bid, supplier)


def _disqualify_reason(bid: LenderBid, supplier, invoice_paise: int) -> str | None:
    if not _passes_sufficiency(bid, supplier, invoice_paise):
        return "under-funds your cash need"
    if not _passes_timing(bid, supplier):
        return "settles too slowly for the due date"
    return None


class MatchingClient(ABC):
    """Seam to Track 2's matching engine (D4).

    Step 2 defines the interface; Step 3 supplies the final MockMatchingClient and
    HttpMatchingClient. Agents depend only on this abstraction, never on Track 2 internals.
    """

    @abstractmethod
    def match(
        self,
        opportunity_id: str,
        bids: list[LenderBid],
        supplier,
        invoice_paise: int,
    ) -> MatchResult:
        raise NotImplementedError


def _gate_then_rank(opportunity_id: str, bids: list[LenderBid], supplier, invoice_paise: int) -> MatchResult:
    """Gate-then-rank (approved spec):

    - DISQUALIFY bids that under-fund the cash need (sufficiency) or cannot settle
      in time (timing). Disqualified bids are never merely lower-scored -- they are
      removed from consideration.
    - Among survivors, rank by effective annual cost ascending; tie-break by faster
      settlement, then non-recourse.
    - NO-MATCH if zero survivors.
    """
    survivors = [b for b in bids if is_survivor(b, supplier, invoice_paise)]
    if not survivors:
        return MatchResult(
            match_id=f"match-{opportunity_id}",
            matched=False,
            matched_bid_ref=None,
            score=0.0,
            notes="No bid meets sufficiency/timing — no-match.",
            simulated=True,
        )
    ranked = sorted(
        survivors,
        key=lambda b: (
            effective_annual_cost(b, invoice_paise),
            b.disbursal_latency_hours,
            b.recourse,  # False (non-recourse) sorts first
        ),
    )
    best = ranked[0]
    eac = effective_annual_cost(best, invoice_paise)
    score = round(1.0 / (1.0 + eac), 4)
    return MatchResult(
        match_id=f"match-{opportunity_id}",
        matched=True,
        matched_bid_ref=best.provider_id,
        score=score,
        notes=(
            f"Selected {best.provider_name} on effective annual cost "
            f"{eac * 100:.1f}% (lowest among qualifying bids)."
        ),
        simulated=True,
    )


class MockMatchingClient(MatchingClient):
    """In-memory ranking for development/tests (mirrors the D3 default path)."""

    def match(
        self,
        opportunity_id: str,
        bids: list[LenderBid],
        supplier,
        invoice_paise: int,
    ) -> MatchResult:
        if not bids:
            return MatchResult(
                match_id=f"match-{opportunity_id}",
                matched=False,
                matched_bid_ref=None,
                score=0.0,
                notes="No bid meets sufficiency/timing — no-match.",
                simulated=True,
            )
        return _gate_then_rank(opportunity_id, bids, supplier, invoice_paise)


class HttpMatchingClient(MatchingClient):
    """Real client for Track 2's matching engine, driven by NEXUS_MATCHING_MODE=http.

    Performs a tolerant best-effort mapping of the upstream response into our
    MatchResult placeholder (see issue #9 #4 - the real discriminated-union
    pass-through is deferred). The supplier + invoice context are forwarded so the
    upstream engine can apply the same gates.
    """

    def __init__(self, url: str, timeout: float = 5.0, api_key: str | None = None):
        self.url = url
        self.timeout = timeout
        self.api_key = api_key

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential_jitter(initial=0.5, max=2.0),
        retry=retry_if_exception_type(httpx.HTTPError),
    )
    def match(
        self,
        opportunity_id: str,
        bids: list[LenderBid],
        supplier,
        invoice_paise: int,
    ) -> MatchResult:
        payload = {
            "opportunity_id": opportunity_id,
            "bids": [b.model_dump(by_alias=True) for b in bids],
            "supplier": supplier.model_dump(by_alias=True) if supplier is not None else None,
            "invoicePaise": invoice_paise,
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        resp = httpx.post(self.url, json=payload, timeout=self.timeout, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return MatchResult(
            match_id=data.get("matchId", f"match-{opportunity_id}"),
            matched=bool(data.get("matched", False)),
            matched_bid_ref=data.get("matchedBidRef"),
            score=float(data.get("score", 0.0)),
            notes=data.get("notes", ""),
            simulated=False,
        )


def get_matching_client(settings: NexusSettings) -> MatchingClient:
    """Factory selecting the matching backend from settings (env flip)."""
    if settings.matching_mode == "http" and settings.matching_url:
        return HttpMatchingClient(
            settings.matching_url,
            settings.matching_timeout,
            settings.matching_api_key,
        )
    return MockMatchingClient()
