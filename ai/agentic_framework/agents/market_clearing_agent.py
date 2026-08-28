from ai.agentic_framework.agents.lender_bidding_agent import lender_task
from ai.agentic_framework.agents.supplier_agent import supplier_task
from ai.agentic_framework.config import AgenticFrameworkSettings
from ai.agentic_framework import llm
from ai.agentic_framework.matching import MatchingClient, get_matching_client
from ai.agentic_framework.prompts import CLEARING_SYSTEM_PROMPT
from ai.agentic_framework.providers import DEFAULT_PROVIDERS, ProviderProfile
from ai.agentic_framework.schemas import ClearingRequest, ClearingResult
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
    def __init__(self, matching: MatchingClient | None = None, providers: list[ProviderProfile] | None = None):
        self._matching = matching
        self._providers = DEFAULT_PROVIDERS if providers is None else providers
        self._wf = clearing_workflow

    def run(self, request: ClearingRequest, settings: AgenticFrameworkSettings | None = None) -> ClearingResult:
        settings = settings or AgenticFrameworkSettings()
        matching = self._matching or get_matching_client(settings)
        return self._wf.invoke(
            {
                "request": request,
                "matching": matching,
                "providers": self._providers,
                "settings": settings,
            }
        )
