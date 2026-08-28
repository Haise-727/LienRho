# Decisions Needed — LienRho

Open questions and decisions only the team can settle. Resolved items are kept
here (marked ✅) rather than deleted, so the reasoning behind them isn't lost.

---

## 1. Project Naming ✅ Resolved

**Decision:** staying **LienRho**. No find-and-replace needed — every doc
already uses the name directly rather than a placeholder.

---

## 2. Infrastructure (AWS) — ⏸ Deferred

**Decision (this session):** not now. Local/deterministic — FastAPI + Postgres
+ Docker Compose, the same posture as the transferred base — until the core
marketplace logic (phases 0–3 of `04-build-plan.md`) actually works. AWS
service selection is real, non-trivial work (ECS vs. Lambda, RDS vs. Aurora
Serverless, Bedrock vs. direct API routing) and none of it proves the thesis
in `01-commerce-analysis.md`. Revisit only if the core build is solid with time
still on the clock.

*If revisited, a candidate stack was proposed* (Route 53 + CloudFront,
ECS Fargate for the app layer, SQS→Lambda for async ingestion/verification
work, Aurora Serverless v2 Postgres, ElastiCache Redis for allocation locking,
S3+KMS for documents, Secrets Manager) — reasonable shape *if* cloud deployment
becomes a real goal, but treat "reasonable shape" and "worth building this
week" as separate questions.

---

## 3. Sponsor Integrations — ⏸ Deferred

**Decision (this session):** not alongside the core build. Revisit only once
phases 0–3 are solid. Recorded here with the sharper versions of each idea so
that if/when this is revisited, the team isn't starting from "what could we
even build":

### ElevenLabs (Voice / Audio)
- **Outbound verification call:** ring the buyer's procurement contact to
  confirm a supplier-asserted invoice, upgrading its verification tier. Speech-
  to-text transcript stored against the invoice as evidence.
- **Inbound decision cockpit:** a mic-driven query surface — "summarize my top
  bids for invoice #8042" — reading from already-computed scored offers. Note
  this is a *voice UI over existing data*, not a new decision-making capability;
  it doesn't reduce how much of phases 0–3 has to exist first.
- **Audio deal summaries:** TTS explainer of a scored offer, complementary to
  the plain-English breakdown already planned for the frontend.
- *Open:* which of these three, if any, given the time cost of each.

### Stitch — ⚠️ product identity unconfirmed
Two different, incompatible guesses have been made about what Stitch's product
actually is: cloud accounting-system connectivity (original guess) vs. a
data-pipeline / deterministic-state-transition tool (a later guess). **Neither
has been verified against Stitch's actual sponsor materials.** Don't design
an integration point until someone reads what Stitch actually offers — a
wrong guess here wastes real build time on plumbing for the wrong API shape.
Tally ingestion itself doesn't depend on this either way: the existing
`AccountingConnector` + Tally XML parser (kept from the old build) already
covers reading real ledger data, independent of whichever cloud connectivity
tool Stitch turns out to be.

### CodeCrafters
- **Proposed use:** a from-scratch, non-LLM deterministic matching/scoring
  engine — possibly in Rust or Go — as the systems-engineering showcase, plus
  explicit concurrency handling (see `03-system-design.md` Module 8) for
  concurrent allocation against the same provider's capacity.
- *Open:* whether a second language in the stack is worth the integration
  and demo-narration cost versus keeping the scoring engine in Python next to
  everything else it has to read from (canonical models, risk scores).

### NexusX
- **Still the least defined.** Candidate roles: provider/supplier identity
  verification, or a multi-agent routing/gateway layer (dispatching OCR
  extraction, constraint-checking, and scoring to different backends with
  unified cost/latency tracking).
- *Open:* same as Stitch — confirm what NexusX's product actually does before
  assigning it a role in the architecture.

---

## 4. Open Product Questions

- **Fallback posture:** if a provider's agent times out mid-auction, auto-
  decline that provider for this opportunity, or fall back to their last-known
  static bid parameters? (Auto-decline is simpler and matches the "degrade,
  never halt the market" principle already established for the LLM layer.)
- **Supplier UI:** show the full bid list, or only the winning offer? Full
  visibility proves the market is real and is closer to PS-5's spirit
  ("compete... under terms suited to the supplier's requirements"); showing
  only the winner is simpler to build and explain in a 3-minute demo.
  *Leaning toward showing all scored offers with the winner highlighted* —
  it's the same amount of backend work either way, and it's the more
  convincing demo.
- **Partial invoice listing:** can a supplier list *part* of an invoice's value
  (e.g. ₹40L of a ₹100L invoice) rather than the whole thing? Distinct from
  provider-side partial fill/syndication (`03-system-design.md` Module 8) —
  this is a seller-side scoping question. Not required for the phase-3 thesis
  demo; worth flagging as in-scope-later rather than deciding now.
- **Demo scenario for Phase 5:** which specific settlement failure (late buyer
  payment, dispute, non-disbursement) gets demoed to show the learning loop
  actually adjusting provider reliability. Decide once Phase 5 exists to demo.

*Decision needed on the first two before Phase 3/4 development starts; the
last two can wait.*
