from ai.nexus.agents.lender_bidding_agent import lender_task
from ai.nexus.agents.supplier_agent import supplier_task
from ai.nexus.config import NexusSettings
from ai.nexus import llm
from ai.nexus.matching import (
    MatchingClient,
    effective_annual_cost,
    get_matching_client,
    is_survivor,
    _disqualify_reason,
)
from ai.nexus.prompts import CLEARING_SYSTEM_PROMPT
from ai.nexus.providers import load_providers, ProviderProfile
from ai.nexus.schemas import BidComparison, ClearingRequest, ClearingResult, MatchResult
from langgraph.func import entrypoint


@entrypoint()
def clearing_workflow(payload: dict) -> ClearingResult:
    request = payload["request"]
    matching = payload["matching"]
    providers = payload["providers"]
    settings = payload["settings"]
    # 1. supplier urgency (worker task) -> deterministic factor drives risk loading
    verdict = supplier_task(request.supplier, settings).result()
    # 2. gather lender bids (worker tasks). Workers never call each other (D1).
    #    Prefer caller-supplied bids; otherwise generate one bid per provider, with
    #    the supplier's urgency factor applied as deterministic risk loading.
    bids = request.bids or [
        lender_task(request.supplier, p, settings, verdict.factor).result() for p in providers
    ]
    invoice_paise = request.supplier.invoice_amount_paise
    cash_need = request.supplier.cash_need_paise

    # 3a. ELIGIBILITY PRE-FILTER (industry SCF clearing): only funders whose advance
    #     actually covers the supplier's cash need are real candidates for the win.
    #     A funder whose advance_rate*invoice_amount < cash_need cannot fund the
    #     supplier, so it is kept out of ranking entirely.
    eligible_bids = [b for b in bids if b.advance_rate * invoice_paise >= cash_need]
    if eligible_bids:
        candidate_bids = eligible_bids
        used_fallback = False
    else:
        # No funder's advance covers the cash need: fall back to the single
        # highest-advance offer so the supplier still gets the best-available
        # option, clearly flagged in the result.
        candidate_bids = [max(bids, key=lambda b: b.advance_rate)]
        used_fallback = True

    # 3b. clearing via Track 2 seam (D4) -- gate-then-rank on true cost. Only the
    #     eligible candidates are presented to the matcher.
    match = matching.match(request.opportunity_id, candidate_bids, request.supplier, invoice_paise)
    if used_fallback:
        # Matcher may have no-match'd the lone candidate (it still fails the net
        # sufficiency/timing gates); force the highest-advance fallback as the winner.
        best = candidate_bids[0]
        eac = effective_annual_cost(best, invoice_paise)
        score = round(1.0 / (1.0 + eac), 4) if eac != float("inf") else 0.0
        match = MatchResult(
            match_id=f"match-{request.opportunity_id}",
            matched=True,
            matched_bid_ref=best.provider_id,
            score=score,
            notes=(
                f"No provider advance covers the cash need ({cash_need} paise); "
                f"selected {best.provider_name} as the highest-advance fallback "
                f"(advance {best.advance_rate:.2f})."
            ),
            simulated=True,
        )

    # Audit trail by construction (hard constraint): every agent run returns agent_trace.
    agent_trace: list[str] = [
        f"supplier.assess supplier={request.supplier.supplier_id} -> "
        f"level={verdict.level.value} factor={verdict.factor:.4f}",
    ]
    for b in bids:
        agent_trace.append(
            f"lender.bid provider={b.provider_id} -> "
            f"advance={b.advance_rate:.4f} apr={b.apr:.4f} fees={b.fees_paise}"
        )
    agent_trace.append(
        f"clearing.eligibility opportunity={request.opportunity_id} -> "
        f"eligible={len(eligible_bids)}/{len(bids)}"
        + (" fallback=highest-advance" if used_fallback else "")
    )
    agent_trace.append(
        f"matching.match opportunity={request.opportunity_id} -> "
        f"matched={match.matched} winner={match.matched_bid_ref} score={match.score}"
    )
    # 4. per-bid comparison rows (deterministic, every bid). Ineligible (gross
    #    advance < cash need) bids are flagged disqualified and kept out of ranking.
    ranked: list[BidComparison] = []
    for b in bids:
        eac = effective_annual_cost(b, invoice_paise)
        covers_cash_need = b.advance_rate * invoice_paise >= cash_need
        survivor = is_survivor(b, request.supplier, invoice_paise)
        disq = (not covers_cash_need) or (not survivor)
        if not covers_cash_need:
            reason = "advance does not cover your cash need"
        elif not survivor:
            reason = _disqualify_reason(b, request.supplier, invoice_paise)
        else:
            reason = None
        eac_pct = round(eac * 100.0, 2) if eac != float("inf") else 0.0
        ranked.append(
            BidComparison(
                provider_id=b.provider_id,
                provider_name=b.provider_name,
                advance_rate=b.advance_rate,
                apr=b.apr,
                fees_paise=b.fees_paise,
                effective_annual_cost_pct=eac_pct,
                disqualified=disq,
                disqualify_reason=reason,
                is_winner=(b.provider_id == match.matched_bid_ref),
            )
        )
    # survivors first, then by effective annual cost ascending
    ranked.sort(key=lambda c: (c.disqualified, c.effective_annual_cost_pct))
    # 5. deterministic thesis note: the "cheaper-looking but worse" call-out
    thesis_note = match.notes if used_fallback else _build_thesis_note(ranked, match.matched_bid_ref)
    agent_trace.append(f"clearing.thesis -> {thesis_note}")
    # 6. human-readable summary (LLM optional, text only)
    llm_text = llm.complete(
        settings,
        CLEARING_SYSTEM_PROMPT,
        f"Opportunity {request.opportunity_id}: supplier urgency {verdict.level.value}, "
        f"matched={match.matched}, best bid {match.matched_bid_ref}.",
    )
    if llm_text:
        summary = llm_text.strip()
    elif not match.matched:
        summary = "No lender cleared the supplier's cash-need and timing floors."
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
        ranked_bids=ranked,
        thesis_note=thesis_note,
        agent_trace=agent_trace,
    )


def _build_thesis_note(ranked: list[BidComparison], winner_id: str | None) -> str:
    """Deterministic plain-English line surfacing a cheaper-looking-but-worse bid."""
    winner = next((c for c in ranked if c.is_winner), None)
    if winner is None:
        return "No lender meets your cash-need and timing floors, so no match is recommended."
    cheaper_disq = next(
        (c for c in ranked if c.disqualified and c.apr < winner.apr), None
    )
    if cheaper_disq:
        return (
            f"Provider {cheaper_disq.provider_name} has a lower headline APR "
            f"({cheaper_disq.apr:.2f}) but {cheaper_disq.disqualify_reason}, "
            f"so Provider {winner.provider_name} wins on true cost "
            f"{winner.effective_annual_cost_pct:.1f}%."
        )
    return (
        f"Provider {winner.provider_name} wins on true cost "
        f"{winner.effective_annual_cost_pct:.1f}% "
        f"(lowest effective annual cost among qualifying bids)."
    )


class MarketClearingAgent:
    def __init__(self, matching: MatchingClient | None = None, providers: list[ProviderProfile] | None = None):
        self._matching = matching
        # providers=None => load from JSON config at run time (registry pattern).
        # An explicit list is honoured (used by tests / callers that inject bids).
        self._providers = providers
        self._wf = clearing_workflow

    def run(self, request: ClearingRequest, settings: NexusSettings | None = None) -> ClearingResult:
        settings = settings or NexusSettings()
        matching = self._matching or get_matching_client(settings)
        providers = self._providers if self._providers is not None else load_providers(settings.providers_path)
        return self._wf.invoke(
            {
                "request": request,
                "matching": matching,
                "providers": providers,
                "settings": settings,
            }
        )
