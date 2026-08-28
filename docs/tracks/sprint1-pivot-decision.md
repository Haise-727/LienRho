# Implementation Plan: Hackathon MVP Alignment (Option A)

## Goal Description
We need to fully align the LienRho repository with the CSI ORIGIN 2026 Problem Statement 5 and the requirements from all four sponsors (ElevenLabs, Stitch, CodeCrafters, Agentic Framework). We will transition the project's technical direction to **Option A** (Next.js Full-Stack, Prisma ORM, Redis, and ElevenLabs React SDK) and away from the legacy Python FastAPI + SQLAlchemy stack. We also need to embrace a high-end, Apple-style light mode aesthetic with marketing aspects for the UI.

Since this is a 24-hour hackathon and the goal is a super-fast MVP in 2 hours for a team of 4, we will:
1. Revise all planning docs to reflect this new unified architecture and sponsor commitments.
2. Create 4 parallel, non-conflicting task tracks (GitHub Issues) and map them to Project #3 (Sprint 1).

> [!CAUTION]
> **User Review Required:** This plan will rewrite the technical architecture decisions in your `docs/` folder and create live GitHub Issues on your repo. Please review the track breakdown below to ensure it matches your team's skills before I execute.

## Open Questions
- Do you have specific GitHub usernames for your 3 teammates so I can assign the newly created issues to them, or should I leave them unassigned for now so they can claim them via `/start-task`?

## Proposed Changes

### Documentation Updates
I will rewrite the following docs to remove the "deferred" status of sponsors and replace the FastAPI/SQLAlchemy legacy references with the new Next.js/Prisma/Redis stack:
- **`README.md` & `docs/README.md`:** Update the "Quickstart" and tech stack definitions.
- **`docs/00-brief.md` & `docs/02-carryover-audit.md`:** Document the complete removal of the Python legacy collections code in favor of the new TypeScript full-stack unified architecture.
- **`docs/03-system-design.md`:** Update to explicitly detail the Stitch Double-Entry Ledger, CodeCrafters Pareto Algorithm, ElevenLabs Voice AI, and Agentic Framework Multi-Agent integration.
- **`docs/04-build-plan.md` & `docs/05-decisions-needed.md`:** Change all sponsor integrations from "Deferred" to "Phase 1 MVP Core". Define the Apple-style marketing UI direction.
- **`docs/06-implementation-plan.md`:** Restructure the implementation plan into the 4 distinct tracks below to prevent merge conflicts.

### GitHub Issues & Project Board (Sprint 1)
I will run the GitHub CLI to create the following 4 issues (each labeled `P0` and sized `L`) and add them to the "In Progress" or "Ready" column of Project #3. They will be placed in a "Sprint 1 (MVP - 2 Hours)" milestone.

#### Track 1: Database & Stitch Ledger Backbone
- **Title:** `Setup Prisma schema, Stitch double-entry ledger & Next.js API`
- **Scope:** Create `schema.prisma` with `CapitalProvider`, `FinancingOpportunity`, `Match`, and Stitch-style ledger tables (`Account`, `JournalEntry`, `Posting`, `Escrow`). Scaffold the Next.js API routes for basic DB interactions.

#### Track 2: Core Matching Engine & CodeCrafters Algorithms
- **Title:** `Implement CodeCrafters Pareto algorithm & Redis concurrency locks`
- **Scope:** Build the deterministic Multi-Attribute Utility function (evaluating Advance Rate, APR, Disbursal Latency, Fees). Implement Redis locking for atomic bid matching to prevent double-spending.

#### Track 3: Voice AI & Agentic Framework Agent Logic
- **Title:** `Integrate ElevenLabs Voice UI & Agentic Framework Multi-Agent coordination`
- **Scope:** Add `@elevenlabs/react` widget for the CFO Voice Cockpit and Outbound Verification Bot. Scaffold the Market Clearing and Lender Bidding multi-agent logic.

#### Track 4: Frontend UI (Apple-style Light Theme)
- **Title:** `Build Apple-style Auction Dashboard & Live Bid Ticker`
- **Scope:** Overhaul the `frontend/` to use a major light background, Apple-style sleek marketing aesthetics. Implement the Ditto-style Deal Breakdown Cards, Stitch Ledger visualizer, and Urgency vs. Cost slider.

## Verification Plan
1. **Docs:** I will visually inspect the modified markdown docs to ensure all legacy Python/FastAPI references are gone.
2. **GitHub:** I will query the GitHub GraphQL API to confirm the 4 issues were successfully created and linked to Project #3 under the correct columns.
