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


# Mock lender panel, mirroring the flat-fee example in docs/01-commerce-analysis.md §3.
#
# fees_paise is an ABSOLUTE amount in paise, and a rupee is 100 paise. Write it
# as `<rupees> * 100` rather than as a literal: every one of these was ten times
# too large (#17), because `2_500_000` reads as "2,500" at a glance and nothing
# downstream complains — a fee of Rs 25,000 on a Rs 1,00,000 invoice is 25% of
# face value, which is absurd, and it still produced a plausible-looking bid.
#
# Fees feed effective cost directly, so a wrong constant here mis-prices every
# agent-generated bid and makes the agent path disagree with the database path
# about the same offer. See test_provider_fees_are_in_paise.
DEFAULT_PROVIDERS: list[ProviderProfile] = [
    ProviderProfile("L1", "CapitalFirst", 0.80, 0.12, 2_500 * 100, 30, True, 24),
    ProviderProfile("L2", "QuickFund", 0.85, 0.135, 1_800 * 100, 15, False, 12),
    ProviderProfile("L3", "StableTrust", 0.75, 0.11, 3_000 * 100, 45, True, 48),
]
