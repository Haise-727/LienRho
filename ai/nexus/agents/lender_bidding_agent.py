from ai.nexus.config import NexusSettings
from ai.nexus import llm
from ai.nexus.prompts import LENDER_SYSTEM_PROMPT
from ai.nexus.schemas import LenderBid, SupplierInput
from ai.nexus.providers import ProviderProfile
from langgraph.func import entrypoint, task


@task
def lender_task(supplier: SupplierInput, profile: ProviderProfile, settings: NexusSettings) -> LenderBid:
    # Deterministic: lender terms are fixed by the profile. A supplier-urgency signal
    # may only influence the explanatory note, never the financials (D5).
    llm_text = llm.complete(
        settings,
        LENDER_SYSTEM_PROMPT,
        f"Lender {profile.provider_name} offering advance {profile.advance_rate}, "
        f"APR {profile.apr} to supplier {supplier.supplier_id}.",
    )
    notes = (
        llm_text.strip()
        if llm_text
        else f"{profile.provider_name} standard terms for {supplier.supplier_id}."
    )
    return LenderBid(
        provider_id=profile.provider_id,
        provider_name=profile.provider_name,
        advance_rate=profile.advance_rate,
        apr=profile.apr,
        fees_paise=profile.fees_paise,
        disbursal_latency_hours=profile.disbursal_latency_hours,
        tenor_days=profile.tenor_days,
        recourse=profile.recourse,
        expires_at=None,
        confidence=0.9,
        simulated=not settings.llm_enabled,
        notes=notes,
    )


@entrypoint()
def lender_workflow(payload: dict) -> LenderBid:
    return lender_task(payload["supplier"], payload["profile"], payload["settings"]).result()


class LenderBiddingAgent:
    def generate_bid(
        self,
        supplier: SupplierInput,
        profile: ProviderProfile,
        settings: NexusSettings | None = None,
    ) -> LenderBid:
        settings = settings or NexusSettings()
        return lender_workflow.invoke(
            {"supplier": supplier, "profile": profile, "settings": settings}
        )
