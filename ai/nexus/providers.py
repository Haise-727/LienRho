from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ProviderProfile:
    provider_id: str
    provider_name: str
    advance_rate: float
    apr: float
    fees_paise: int
    tenor_days: int
    recourse: bool
    disbursal_latency_hours: int


# Mock lender panel with genuinely differentiated mandates so the clearing can
# surface real trade-offs (cheap headline APR that under-funds vs. pricier that
# truly wins). fees_paise are ABSOLUTE paise amounts (issue #9 #1). At least one
# high-advance provider must survive a typical 80%-cash-need supplier after the
# deterministic risk loading in lender_bidding_agent.
DEFAULT_PROVIDERS: list[ProviderProfile] = [
    # Low-APR / slow settlement, full recourse.
    ProviderProfile("L1", "CapitalFirst", 0.80, 0.09, 2_000_000, 45, True, 48),
    # High advance / fast / pricier, non-recourse -- the "gets you funded" option.
    ProviderProfile("L2", "QuickFund", 0.97, 0.16, 2_500_000, 15, False, 6),
    # Cheap fees / low advance, full recourse.
    ProviderProfile("L3", "StableTrust", 0.72, 0.10, 100_000, 30, True, 36),
    # Non-recourse premium: high advance, high APR.
    ProviderProfile("L4", "AegisCapital", 0.92, 0.18, 3_000_000, 30, False, 24),
    # Mid: balanced advance/APR, full recourse.
    ProviderProfile("L5", "BalancedFinance", 0.90, 0.12, 1_500_000, 30, True, 18),
]


def load_providers(path: str | None = None) -> list[ProviderProfile]:
    """Load the funder panel from a JSON config via the registry pattern.

    The file is expected to be a JSON array of objects whose keys match the
    ``ProviderProfile`` fields (provider_id, provider_name, advance_rate, apr,
    fees_paise, tenor_days, recourse, disbursal_latency_hours).

    Falls back to ``DEFAULT_PROVIDERS`` when *path* is omitted or the file does
    not exist, so the engine stays operable without external config (no live
    figures are hardcoded at call sites).

    Relative paths are resolved against the current working directory first, then
    against the repo root (this module's grandparent), so the config is located
    regardless of the process CWD (the API server vs. the test runner).
    """
    if path is None:
        return list(DEFAULT_PROVIDERS)
    p = Path(path)
    candidates: list[Path] = (
        [p]
        if p.is_absolute()
        else [Path.cwd() / p, Path(__file__).resolve().parents[2] / p]
    )
    for candidate in candidates:
        if candidate.is_file():
            return _parse_providers(candidate)
    return list(DEFAULT_PROVIDERS)


def _parse_providers(file_path: Path) -> list[ProviderProfile]:
    with file_path.open("r", encoding="utf-8") as fh:
        raw = json.load(fh)
    if not isinstance(raw, list):
        raise ValueError(f"Provider config {file_path} must be a JSON array")
    return [ProviderProfile(**entry) for entry in raw]
