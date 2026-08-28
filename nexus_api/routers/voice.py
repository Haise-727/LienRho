"""ElevenLabs webhook: invoice-financing clearing. Drop this into your backend."""

import os
from datetime import date

from fastapi import APIRouter, Header, HTTPException, Request

from ai.agents import PROVIDERS, clear_invoice

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/clearing")
async def voice_clearing(request: Request):
    """ElevenLabs webhook target. Accepts params under ``parameters`` or top-level.

    ElevenLabs sends:
        {"parameters": {"supplierId": "...", "invoiceAmount": 1200000, ...}}

    Returns:
        {"result": "Based on your invoice of rupees 12,00,000, ..."}
    """
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(400, "invalid JSON")

    params = data.get("parameters") or data
    try:
        invoice_amt = float(params["invoiceAmount"])
        cash_need = float(params["cashNeed"])
        due_date = date.fromisoformat(str(params["dueDate"]))
        credit_days = int(params.get("creditDays", 45))
    except (KeyError, ValueError, TypeError) as e:
        raise HTTPException(422, f"missing/invalid param: {e}")

    inv_paise = int(invoice_amt * 100)
    need_paise = int(cash_need * 100)
    result = clear_invoice(inv_paise, need_paise, due_date, credit_days)

    return {"result": result["result"]}