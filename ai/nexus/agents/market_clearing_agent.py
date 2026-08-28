from ai.nexus.agents.lender_bidding_agent import lender_task
from ai.nexus.agents.supplier_agent import supplier_task
from ai.nexus.config import NexusSettings
from ai.nexus import llm
from ai.nexus.matching import MatchingClient
from ai.nexus.prompts import CLEARING_SYSTEM_PROMPT
from ai.nexus.providers import DEFAULT_PROVIDERS, ProviderProfile
from ai.nexus.schemas import ClearingRequest, ClearingResult
from langgraph.func import entrypoint


@entrypoint()
def clearing_workflow(payload: dict) -> ClearingResult:
    request = payload["request"]
    matching = payload["matching"]
    providers = payload["providers"]
    settings = payload["settings"]
    # 1. supplier urgency (worker task)
    verdict = supplier_task(request.supplier, settings).result()
    # 2. gather lender bids (worker tasks). Workers never call each other (D1).
    #    Prefer caller-supplied bids; otherwise generate one bid per provider.
    bids = request.bids or [
        lender_task(request.supplier, p, settings).result() for p in providers
    ]
    # 3. clearing via Track 2 seam (D4)
    match = matching.match(request.opportunity_id, bids)
    # 4. human-readable summary (LLM optional, text only)
    llm_text = llm.complete(
        settings,
        CLEARING_SYSTEM_PROMPT,
        f"Opportunity {request.opportunity_id}: supplier urgency {verdict.level.value}, "
        f"matched={match.matched}, best bid {match.matched_bid_ref}.",
    )
    if llm_text:
        summary = llm_text.strip()
    elif not match.matched:
        summary = "No lender cleared the supplier's floor."
    else:
        summary = (
            f"Supplier urgency {verdict.level.value}. "
            f"Best match: {match.matched_bid_ref} (score {match.score})."
        )
    return ClearingResult(
        opportunity_id=request.opportunity_id,
        supplier_verdict=verdict,
        lender_bids=bids,
        match=match,
        clearing_summary=summary,
        simulated=not settings.llm_enabled,
    )


class MarketClearingAgent:
    def __init__(self, matching: MatchingClient, providers: list[ProviderProfile] | None = None):
        self._matching = matching
        self._providers = providers or DEFAULT_PROVIDERS
        self._wf = clearing_workflow

    def run(self, request: ClearingRequest, settings: NexusSettings | None = None) -> ClearingResult:
        settings = settings or NexusSettings()
        return self._wf.invoke(
            {
                "request": request,
                "matching": self._matching,
                "providers": self._providers,
                "settings": settings,
            }
        )
