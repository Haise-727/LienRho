from abc import ABC, abstractmethod

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
