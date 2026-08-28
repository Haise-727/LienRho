from datetime import date

from ai.agentic_framework.config import AgenticFrameworkSettings
from ai.agentic_framework import llm
from ai.agentic_framework.prompts import SUPPLIER_SYSTEM_PROMPT
from ai.agentic_framework.schemas import SupplierInput, UrgencyLevel, UrgencyVerdict
from langgraph.func import entrypoint, task


def _days_until(d: date) -> int:
    return (d - date.today()).days


def _deterministic_factor(supplier: SupplierInput) -> float:
    """0..1 urgency factor from cash-need ratio and time-to-due.

    Pure function: higher cash need relative to invoice, and sooner due date,
    yield higher urgency. No LLM, no I/O.
    """
    need_ratio = min(1.0, supplier.cash_need_paise / max(1, supplier.invoice_amount_paise))
    days = _days_until(supplier.due_date)
    if days <= 0:
        time_pressure = 1.0
    else:
        time_pressure = max(0.0, 1.0 - days / max(1, supplier.credit_days * 2))
    factor = 0.6 * need_ratio + 0.4 * time_pressure
    return round(max(0.0, min(1.0, factor)), 4)


def _level_from_factor(factor: float) -> UrgencyLevel:
    if factor >= 0.75:
        return UrgencyLevel.HIGH
    if factor >= 0.45:
        return UrgencyLevel.MEDIUM
    if factor >= 0.2:
        return UrgencyLevel.LOW
    return UrgencyLevel.NONE


@task
def supplier_task(supplier: SupplierInput, settings: AgenticFrameworkSettings) -> UrgencyVerdict:
    factor = _deterministic_factor(supplier)
    level = _level_from_factor(factor)
    llm_text = llm.complete(
        settings,
        SUPPLIER_SYSTEM_PROMPT,
        f"Supplier {supplier.supplier_id}, invoice {supplier.invoice_id}, "
        f"urgency level {level.value}, factor {factor}.",
    )
    if llm_text:
        rationale = llm_text.strip()
    else:
        need_ratio = min(1.0, supplier.cash_need_paise / max(1, supplier.invoice_amount_paise))
        rationale = (
            f"Cash need is {need_ratio:.0%} "
            f"of invoice; due in {_days_until(supplier.due_date)} days -> {level.value} urgency."
        )
    return UrgencyVerdict(
        level=level,
        factor=factor,
        rationale=rationale,
        simulated=not settings.llm_enabled,
        confidence=0.9,
    )


@entrypoint()
def supplier_workflow(payload: dict) -> UrgencyVerdict:
    return supplier_task(payload["supplier"], payload["settings"]).result()


class SupplierAgent:
    def assess(self, supplier: SupplierInput, settings: AgenticFrameworkSettings | None = None) -> UrgencyVerdict:
        settings = settings or AgenticFrameworkSettings()
        return supplier_workflow.invoke({"supplier": supplier, "settings": settings})
