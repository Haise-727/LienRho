# Decisions Needed — LienRho

Open questions and decisions only the team can settle. Resolved items are kept
here (marked ✅) rather than deleted, so the reasoning behind them isn't lost.

---

## 1. Project Naming ✅ Resolved

**Decision:** staying **LienRho**. No find-and-replace needed — every doc
already uses the name directly rather than a placeholder.

---

## 2. Infrastructure (AWS) — ✅ Decided

**Decision:** Next.js full-stack, Prisma ORM, Redis. The Python FastAPI +
SQLAlchemy base is retired; all API surface moves into Next.js route handlers.

**Deployment target** (aspirational, not built during the sprint): Route 53 +
CloudFront, ECS Fargate for the app layer, Aurora Serverless v2 Postgres,
ElastiCache Redis for allocation locking, S3+KMS for documents, Secrets Manager.

Worth keeping separate: choosing this shape is not the same as building it.
Nothing in the AWS service selection proves the thesis in
`01-commerce-analysis.md`, so it stays behind a working local stack. Local
development runs Postgres and Redis under Docker Compose.

---

## 3. Sponsor Integrations — ✅ Decided (Phase 1 MVP)

**Decision:** ALL SPONSORS are mandatory for the 2-hour hackathon MVP.

### ElevenLabs (Voice / Audio)
- **Interactive CFO Voice Cockpit**
- **Outbound verification call bot (WebRTC)**
- **Audio Deal Explainer**

### Stitch
- **Lending & Credit Origination**
- **KYB & Account Verification**
- **Double-Entry Ledger & Reconciliation**

### CodeCrafters
- **Multi-Attribute Utility / Pareto Matching Algorithm**
- **Redis atomic distributed locking**

### Agent layer — ✅ Changed: NexusX dropped, LiteLLM retained
- **Autonomous multi-agent coordination** (Supplier, Lender, Market Clearing),
  on LangGraph, with model access through **LiteLLM**.

**Decision:** NexusX is dropped as a sponsor integration. Model access goes
through **LiteLLM**, which is what the code already used.

Worth being clear that this is a **claims change, not an architecture change** —
`ai/nexus/llm.py` already does `from litellm import completion` behind a single
seam, so no agent logic moves. What changes is what we say we are using, and
therefore what we have to be able to defend.

Scope of the follow-through:
- Doc and pitch language across `03-system-design.md`, `README.md` and the track
  docs. Do this first; it is the part that affects the submission.
- The `ai/nexus/` package name and `nexus` prefix appear in ~12 Python files.
  Renaming is mechanical and purely cosmetic — it can wait, and should not block
  anything.
- Nothing in `frontend/` is affected beyond doc text.

The discipline that made this layer sound is unchanged and stays: the model
chooses posture, deterministic functions compute every number, and
`llm.complete()` returns `None` on failure with a deterministic fallback at
every call site.

---

### Detail and still-open questions per sponsor

The decision above settles *that* each sponsor is in scope. It does not settle
*what* each one does, and two of the four are still genuinely undefined.

**ElevenLabs.** Three candidate surfaces: an outbound verification call to the
buyer's procurement contact (upgrading an invoice's verification tier, with the
transcript stored as evidence); an inbound mic-driven cockpit reading from
already-computed scored offers; a TTS explainer of a scored offer. Note the
second and third are *voice UI over existing data*, not new decision-making
capability — they don't reduce how much of the scoring core has to exist first.
- *Open:* which of the three, given the time cost of each.

**Stitch — ⚠️ product identity still unconfirmed.** Issue #1 asserts Stitch is a
double-entry ledger product. That has **not** been verified against Stitch's
actual sponsor materials, and two incompatible guesses have been made previously
(cloud accounting-system connectivity vs. a data-pipeline / state-transition
tool). Read what Stitch actually offers before building plumbing for it — a
wrong guess wastes real build time on the wrong API shape.
- *Open:* someone confirm this from the sponsor materials, not from inference.

**CodeCrafters.** The deterministic matching/scoring engine, plus explicit
concurrency handling for concurrent allocation against the same provider's
capacity (`03-system-design.md` Module 8).
- *Settled:* the earlier "second language, Rust or Go" question is closed — the
  engine is TypeScript alongside the rest of the Next.js stack.
- *Worth stating in the pitch:* the multi-attribute clearing and Pareto
  frontier logic **is** the deterministic-algorithms showcase. The Redis lock is
  supporting infrastructure, not the demonstration.

**Agent layer (was NexusX).** The sponsor slot is dropped; what remains is the
thing that was always doing the work — LangGraph for coordination, LiteLLM for
model access. Candidate roles previously sketched for the sponsor (identity
verification, a routing/gateway layer with unified cost and latency tracking)
are now just optional features, not an integration we owe anyone.
- *Settled:* no product-identity question remains here, because there is no
  longer a third-party product to identify.

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
