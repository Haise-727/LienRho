from ai.nexus.evaluation import run_evaluation


def test_evaluation_invariants():
    sc = run_evaluation()
    # These invariants MUST hold for the agents to be trustworthy:
    assert sc.bid_validity_ok, "bids violate basic financial ranges"
    assert sc.urgency_monotonic_ok, "urgency is not monotonic in cash-need / time-pressure"
    assert sc.internal_consistency_ok, "matcher did not pick its own highest-scoring bid"
    # Informational metrics (printed, not gated -- known gaps are surfaced, not hidden):
    print(f"\n[eval] match_accuracy={sc.match_accuracy:.1%} mean_regret={sc.mean_regret:.1%} "
          f"risk_sensitivity={sc.risk_sensitivity_ok}")
    for n in sc.notes:
        print(f"[eval] {n}")