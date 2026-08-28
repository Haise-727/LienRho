"""Simple invoice-financing clearing agent. Drop this into your backend."""

from datetime import date

# ── Lender panel (edit to add/remove lenders) ──────────────────────────
PROVIDERS = [
    {"id": "L1", "name": "CapitalFirst",  "advance": 0.80, "apr": 0.09, "fees_paise": 2_000_000, "tenor_days": 45},
    {"id": "L2", "name": "QuickFund",     "advance": 0.97, "apr": 0.16, "fees_paise": 2_500_000, "tenor_days": 15},
    {"id": "L3", "name": "StableTrust",   "advance": 0.72, "apr": 0.10, "fees_paise":   100_000, "tenor_days": 30},
    {"id": "L4", "name": "AegisCapital",  "advance": 0.92, "apr": 0.18, "fees_paise": 3_000_000, "tenor_days": 30},
    {"id": "L5", "name": "BalancedFinance","advance": 0.90, "apr": 0.12, "fees_paise": 1_500_000, "tenor_days": 30},
]


def effective_apr(fees_paise: int, advance_paise: int, tenor_days: int) -> float:
    """True annualised cost: (fees / cash advanced) * (365 / tenor)."""
    if advance_paise <= 0 or tenor_days <= 0:
        return float("inf")
    return (fees_paise / advance_paise) * (365 / tenor_days)


def clear_invoice(
    invoice_amount_paise: int,
    cash_need_paise: int,
    due_date: date | None = None,
    credit_days: int = 45,
) -> dict:
    """Run the clearing. Returns offers, best pick, and spoken result.

    Example:
        >>> result = clear_invoice(1_200_000_00, 900_000_00)
        >>> result["result"]
        "Based on your invoice of rupees 12,00,000, ..."
    """
    offers = []
    for p in PROVIDERS:
        advance_paise = int(invoice_amount_paise * p["advance"])
        eac = effective_apr(p["fees_paise"], advance_paise, p["tenor_days"])
        eligible = advance_paise >= cash_need_paise
        offers.append({
            "provider": p["name"],
            "advance_rate": p["advance"],
            "advance_rupees": advance_paise / 100,
            "apr": p["apr"],
            "effective_apr_pct": round(eac * 100, 2),
            "eligible": eligible,
        })

    eligible_offers = [o for o in offers if o["eligible"]]
    best = min(eligible_offers, key=lambda o: o["effective_apr_pct"]) if eligible_offers else max(offers, key=lambda o: o["advance_rate"])

    invoice_amt = invoice_amount_paise / 100
    cash_need = cash_need_paise / 100

    if not eligible_offers:
        result = f"No lender can fully cover your cash need of rupees {cash_need:,.0f}. {best['provider']} offers the highest advance at {best['advance_rupees']:,.0f} rupees."
    else:
        result = (
            f"Based on your invoice of rupees {invoice_amt:,.0f}, "
            f"the best match is {best['provider']} at a true annual cost of "
            f"{best['effective_apr_pct']:.1f} percent, advancing "
            f"rupees {best['advance_rupees']:,.0f} to meet your cash need of "
            f"rupees {cash_need:,.0f}."
        )

    return {"offers": offers, "best": best, "result": result}