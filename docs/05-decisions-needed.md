# Decisions Needed — «PROJECT»

This document tracks the open questions and critical decisions that only the team can settle before or during the build phase. Resolving these early prevents blocking the engineering work.

---

## 1. Project Naming

The placeholder `«PROJECT»` is used throughout the documentation. We need a final name before we initialize the new repository.

**Name Candidates:**
- **CapitalClear** - Focuses on the clearing agent and capital allocation.
- **YieldRoute** - Highlights the routing of opportunities to capital providers.
- **LedgerFund** - Grounded in ledger-verified working capital.
- **FlowMarket** - Emphasizes cash flow and the marketplace aspect.

*Decision needed:* Pick a name so we can run a find-and-replace across all docs.

---

## 2. Infrastructure (AWS)

We are committing to AWS as our cloud provider. We need to decide on the exact architecture stack to balance speed of development during the hackathon with demonstrating a production-grade setup.

**Key Architecture Decisions:**
- **Compute:** ECS (Fargate) for containerized microservices vs. Lambda for event-driven serverless functions? Given the multi-agent nature and long-running settlement loops, ECS is likely a safer bet for the core, while Lambda could handle ingestion events.
- **Database:** RDS (PostgreSQL) is the natural fit for the relational entities (Opportunities, Matches, Settlements). Do we need DynamoDB for high-volume audit logs and agent traces?
- **AI/Agents Hosting:** Are we hosting local LLMs (e.g. via SageMaker/EC2) or just routing API calls to external providers via AWS Bedrock or direct APIs?

*Decision needed:* Finalize the AWS service stack for Compute, DB, and AI routing.

---

## 3. Sponsor Integrations

We have specific sponsors for this hackathon: CodeCrafters, Stitch, ElevenLabs, and NexusX. We need to explicitly integrate their tools into our architecture to maximize judging score and utility.

### ElevenLabs (Voice / Audio)
- **Proposed Use Case:** A Voice Agent for verification or notifications.
  - *Verification Call:* The platform automatically calls a buyer to verify a "supplier-asserted" invoice, upgrading its verification tier to "buyer-accepted" using ElevenLabs' conversational AI.
  - *Settlement Alerts:* Urgent voice notifications to suppliers when a critical capital match occurs or a deadline is approaching.
- *Decision needed:* Do we build the inbound/outbound voice agent flow for verification, or stick to simple notifications?

### Stitch (Financial Data / Ingestion) & Tally Integration
- **Proposed Use Case:** The `AccountingConnector`. Stitch provides APIs for cloud accounting integrations.
- **Tally Ingestion Strategy:** Since raw Tally database files cannot be natively parsed on Linux without a running Tally instance (which requires Windows), we will perform a **one-time export of real company data to Tally XML** on Windows. The Linux build will ingest these exported XML files using our existing Tally XML parser via `AccountingConnector`.
- *Decision needed:* Confirm Stitch API coverage for cloud systems, while using the local Tally XML files for real MSME ledger data.

### CodeCrafters
- **Proposed Use Case:** Developer tooling and algorithmic rigor. We could leverage CodeCrafters' platform to optimize the deterministic matching and scoring engine, showcasing high-performance code (e.g., in Rust or Go) for the clearing agent.
- *Decision needed:* Determine the exact integration point for CodeCrafters (e.g., using their infrastructure for the clearing engine).

### NexusX
- **Proposed Use Case:** Depending on NexusX's core offering (often security, identity, or data exchange), we should use them for provider authentication, identity verification of the suppliers, or secure data enclaves for the capital provider mandates.
- *Decision needed:* Clarify NexusX's API offering and assign it to the Auth or Provider Registry module.

---

## 4. Open Product Questions

- **Fallback Posture:** If a capital provider's agent goes down or times out during the auction, do we auto-decline, or use their historical default bid?
- **Supplier UI:** Does the supplier see the full list of bids, or only the "winning" bid that the utility engine selects? Revealing all bids proves the market exists, but might confuse a supplier who just wants the best option.
- **Demo Scenario:** Which specific invoice dispute or failure mode will we demo for Phase 5 (Settlement & Learning)?

*Decision needed:* Review and finalize these product behaviors before Phase 3 and 4 development.
