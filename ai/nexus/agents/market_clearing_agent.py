from ai.nexus.agents.lender_bidding_agent import LenderBiddingAgent
from ai.nexus.agents.supplier_agent import SupplierAgent
from ai.nexus.config import NexusSettings
from ai.nexus import llm
from ai.nexus.matching import MatchingClient
from ai.nexus.prompts import CLEARING_SYSTEM_PROMPT
from ai.nexus.providers import DEFAULT_PROVIDERS, ProviderProfile
from ai.nexus.schemas import ClearingRequest, ClearingResult


class MarketClearingAgent:
    def __init__(self, matching: MatchingClient, providers: list[ProviderProfile] | None = None):
        self._supplier = SupplierAgent()
        self._lender = LenderBiddingAgent()
        self._matching = matching
        self._providers = providers or DEFAULT_PROVIDERS

    def run(self, request: ClearingRequest, settings: NexusSettings | None = None) -> ClearingResult:
        settings = settings or NexusSettings()
        # 1. supplier urgency (worker)
        verdict = self._supplier.assess(request.supplier, settings)
        # 2. gather lender bids (worker). Workers never call each other (D1).
        bids = request.bids or [
            self._lender.generate_bid(request.supplier, p, settings) for p in self._providers
        ]
        # 3. clearing via Track 2 seam (D4)
        match = self._matching.match(request.opportunity_id, bids)
        # 4. human-readable summary (LLM optional, text only)
        summary = self._summary(request, verdict, match, settings)
        return ClearingResult(
            opportunity_id=request.opportunity_id,
            supplier_verdict=verdict,
            lender_bids=bids,
            match=match,
            clearing_summary=summary,
            simulated=not settings.llm_enabled,
        )

    def _summary(self, request, verdict, match, settings) -> str:
        llm_text = llm.complete(
            settings,
            CLEARING_SYSTEM_PROMPT,
            f"Opportunity {request.opportunity_id}: supplier urgency {verdict.level.value}, "
            f"matched={match.matched}, best bid {match.matched_bid_ref}.",
        )
        if llm_text:
            return llm_text.strip()
        if not match.matched:
            return "No lender cleared the supplier's floor."
        return (
            f"Supplier urgency {verdict.level.value}. "
            f"Best match: {match.matched_bid_ref} (score {match.score})."
        )

