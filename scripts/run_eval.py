import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ai.nexus.evaluation import run_evaluation

sc = run_evaluation()
print("=== NexusX Agent Evaluation Scorecard ===")
print(f"Scenarios evaluated       : {sc.n_scenarios}")
print(f"Match accuracy (vs indep) : {sc.match_accuracy:.1%}")
print(f"Mean selection regret     : {sc.mean_regret:.1%}")
print(f"Internal consistency      : {'OK' if sc.internal_consistency_ok else 'FAIL'}")
print(f"Bid validity ranges       : {'OK' if sc.bid_validity_ok else 'FAIL'}")
print(f"Urgency monotonicity      : {'OK' if sc.urgency_monotonic_ok else 'FAIL'}")
print(f"Risk-sensitive pricing    : {'OK' if sc.risk_sensitivity_ok else 'GAP (terms ignore supplier risk)'}")
for n in sc.notes:
    print("  -", n)