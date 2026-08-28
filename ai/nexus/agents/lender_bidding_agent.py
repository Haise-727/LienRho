from ai.nexus.config import NexusSettings
from ai.nexus import llm
from ai.nexus.prompts import LENDER_SYSTEM_PROMPT
from ai.nexus.schemas import LenderBid, SupplierInput
from ai.nexus.providers import ProviderProfile
from langgraph.func import entrypoint, task


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


@task
def lender_task(
    supplier: SupplierInput,
    profile: ProviderProfile,
    settings: NexusSettings,
    urgency_factor: float,
) -> LenderBid:
    # Deterministic risk loading: the supplier's urgency (a pure function of their
    # cash-need ratio and time-to-due) drives the financial terms, NEVER an LLM (D5).
    # Higher urgency => pricier capital (higher APR, lower advance, risk surcharge).
    apr_eff = _clamp(profile.apr + 0.04 * urgency_factor, 0.01, 1.0)
    advance_eff = _clamp(profile.advance_rate - 0.10 * urgency_factor, 0.3, 0.99)
    fees_eff = int(profile.fees_paise + 500000 * urgency_factor)  # risk surcharge, still int paise

    llm_text = llm.complete(
        settings,
        LENDER_SYSTEM_PROMPT,
        f"Lender {profile.provider_name} offering advance {advance_eff}, "
        f"APR {apr_eff} to supplier {supplier.supplier_id}.",
    )
    notes = (
        llm_text.strip()
        if llm_text
        else f"{profile.provider_name} terms for {supplier.supplier_id} (urgency {urgency_factor:.2f})."
    )
    return LenderBid(
        provider_id=profile.provider_id,
        provider_name=profile.provider_name,
        advance_rate=advance_eff,
        apr=apr_eff,
        fees_paise=fees_eff,
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
    return lender_task(
        payload["supplier"],
        payload["profile"],
        payload["settings"],
        payload["urgency_factor"],
    ).result()


class LenderBiddingAgent:
    def generate_bid(
        self,
        supplier: SupplierInput,
        profile: ProviderProfile,
        settings: NexusSettings | None = None,
        urgency_factor: float = 0.0,
    ) -> LenderBid:
        settings = settings or NexusSettings()
        return lender_workflow.invoke(
            {
                "supplier": supplier,
                "profile": profile,
                "settings": settings,
                "urgency_factor": urgency_factor,
            }
        )
