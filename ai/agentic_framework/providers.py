from dataclasses import dataclass


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


# Mock lender panel. fees_paise chosen to mirror docs/01's flat-fee example (2,500,000 paise = Rs 2,500).
DEFAULT_PROVIDERS: list[ProviderProfile] = [
    ProviderProfile("L1", "CapitalFirst", 0.80, 0.12, 2_500_000, 30, True, 24),
    ProviderProfile("L2", "QuickFund", 0.85, 0.135, 1_800_000, 15, False, 12),
    ProviderProfile("L3", "StableTrust", 0.75, 0.11, 3_000_000, 45, True, 48),
]
