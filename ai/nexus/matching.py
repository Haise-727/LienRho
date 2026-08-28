from abc import ABC, abstractmethod

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from ai.nexus.config import NexusSettings
from ai.nexus.schemas import LenderBid, MatchResult


class MatchingClient(ABC):
    """Seam to Track 2's matching engine (D4).

    Step 2 defines the interface; Step 3 supplies the final MockMatchingClient and
    HttpMatchingClient. Agents depend only on this abstraction, never on Track 2 internals.
    """

    @abstractmethod
    def match(self, opportunity_id: str, bids: list[LenderBid]) -> MatchResult:
        raise NotImplementedError


def _score(bid: LenderBid) -> float:
    """Deterministic stand-in for Track 2's effective-cost ranking.

    Lower APR, lower absolute fee, faster settlement -> higher score (0..1).
    """
    fee_penalty = (bid.fees_paise or 0) / 10_000_000.0
    latency_penalty = (bid.disbursal_latency_hours or 0) / 24.0 * 0.1
    raw = 1.0 / (1.0 + bid.apr * 100.0 + fee_penalty + latency_penalty)
    return max(0.0, min(1.0, raw))


class MockMatchingClient(MatchingClient):
    """In-memory ranking for development/tests (mirrors the D3 default path)."""

    def match(self, opportunity_id: str, bids: list[LenderBid]) -> MatchResult:
        if not bids:
            return MatchResult(
                match_id=f"match-{opportunity_id}",
                matched=False,
                matched_bid_ref=None,
                score=0.0,
                notes="No bids submitted.",
                simulated=True,
            )
        ranked = sorted(bids, key=_score, reverse=True)
        best = ranked[0]
        return MatchResult(
            match_id=f"match-{opportunity_id}",
            matched=True,
            matched_bid_ref=best.provider_id,
            score=round(_score(best), 4),
            notes=f"Selected {best.provider_name} on effective cost.",
            simulated=True,
        )


class HttpMatchingClient(MatchingClient):
    """Real client for Track 2's matching engine, driven by NEXUS_MATCHING_MODE=http.

    Performs a tolerant best-effort mapping of the upstream response into our
    MatchResult placeholder (see issue #9 #4 - the real discriminated-union
    pass-through is deferred).
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
    def match(self, opportunity_id: str, bids: list[LenderBid]) -> MatchResult:
        payload = {
            "opportunity_id": opportunity_id,
            "bids": [b.model_dump(by_alias=True) for b in bids],
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
