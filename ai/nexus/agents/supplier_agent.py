from datetime import date

from ai.nexus.config import NexusSettings
from ai.nexus import llm
from ai.nexus.prompts import SUPPLIER_SYSTEM_PROMPT
from ai.nexus.schemas import SupplierInput, UrgencyLevel, UrgencyVerdict


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


class SupplierAgent:
    def assess(self, supplier: SupplierInput, settings: NexusSettings | None = None) -> UrgencyVerdict:
        settings = settings or NexusSettings()
        factor = _deterministic_factor(supplier)
        level = _level_from_factor(factor)
        rationale = self._rationale(supplier, level, factor, settings)
        return UrgencyVerdict(
            level=level,
            factor=factor,
            rationale=rationale,
            simulated=not settings.llm_enabled,
            confidence=0.9,
        )

    def _rationale(self, supplier, level, factor, settings) -> str:
        llm_text = llm.complete(
            settings,
            SUPPLIER_SYSTEM_PROMPT,
            f"Supplier {supplier.supplier_id}, invoice {supplier.invoice_id}, "
            f"urgency level {level.value}, factor {factor}.",
        )
        if llm_text:
            return llm_text.strip()
        return (
            f"Cash need is {supplier.cash_need_paise / supplier.invoice_amount_paise:.0%} "
            f"of invoice; due in {_days_until(supplier.due_date)} days -> {level.value} urgency."
        )

