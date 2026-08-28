from __future__ import annotations

import re


def build_spoken(
    result,
    invoice_amount_paise: int,
    cash_need_paise: int,
) -> str:
    """Backend-authored, deterministic spoken sentence using exact figures.

    The LLM presenter may re-tone this sentence, but every number and provider
    name must survive verbatim (guarded by ``_llm_keeps_facts``).  This is the
    source of truth for all monetary wording.
    """
    winner = next((b for b in result.ranked_bids if b.is_winner), None)
    if winner is None:
        return (
            f"Your invoice of rupees {invoice_amount_paise/100:,.0f} "
            f"could not be matched. No lender meets your cash need of "
            f"rupees {cash_need_paise/100:,.0f} and the required timing."
        )

    cash_advanced = int(winner.advance_rate * invoice_amount_paise)
    ineligible = [b for b in result.ranked_bids if b.disqualified]
    note = ""
    if ineligible:
        reasons = ", ".join(
            f"{b.provider_name} ({b.disqualify_reason})" for b in ineligible[:2]
        )
        extra = len(ineligible) - 2
        if extra > 0:
            reasons += f" and {extra} other"
        note = f" {reasons} were not eligible."

    return (
        f"Based on your invoice of rupees {invoice_amount_paise/100:,.0f}, "
        f"the best match is {winner.provider_name} at a true annual cost of "
        f"{winner.effective_annual_cost_pct:.1f} percent, advancing "
        f"rupees {cash_advanced/100:,.0f} to meet your cash need of "
        f"rupees {cash_need_paise/100:,.0f}.{note}"
    )


def clean_llm_text(text: str | None) -> str | None:
    """Extract the spoken sentence from an LLM response.

    Expects the sentence in double quotation marks.  Returns ``None`` if the
    response is not usable (no quoted span, or the response is empty).
    """
    if not text:
        return None
    m = re.search(r'"([^"]+)"', text.strip())
    if m:
        return m.group(1).strip()
    # No quotes — maybe the LLM ignored instructions.  Return None so the caller
    # falls back to the deterministic sentence.
    return None