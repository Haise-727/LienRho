# LienRho: Production-Ready Sprint Plan (v2)

## 1. Document Alignment & Handoff Consistency
This document reconciles the prior `v1` sprint plan with the architectural truths established in `docs/10-handoff.md`. Crucially:
- The Python backend agents reach models through **LiteLLM**. We are deprecating all "NexusX" language across the repository: NexusX was a sponsor label, while LiteLLM is the implementation that actually drives the multi-agent graph.
- The matching engine's core thesis—**gates, not weights**—must remain intact. Offers must clear a sufficiency floor and a timing deadline before they are even ranked.

## 2. Gap Analysis (What's Missing)
To evolve LienRho from a hackathon MVP into a production-ready application hosted on AWS, the following are absolutely required:

1. **Authentication & User Management (Google OAuth):**
   * *The Problem:* The application currently relies on hardcoded pseudo-login personas.
   * *The Fix:* We will implement **Supabase Auth with Google OAuth** as the primary identity provider. This provides production-grade security, session management, and JWTs that our Next.js middleware can use to protect the `/dashboard`.

2. **Document Verification Agent (KYC/KYB/AML):**
   * *The Problem:* Identity verification is assumed or skipped. Real capital markets require rigorous counterparty checks.
   * *The Fix:* We will build a Document Verification Agent using **LiteLLM**. This agent will parse uploaded documents (Tax IDs, GST certificates, Incorporation papers, and Invoices) to verify both the **Seller/Distributor** and the **Bank (Credit Provider)**. Successfully parsed and cross-checked documents will upgrade the user's `VerificationTier` in the database, allowing them to transact.

3. **Platform Copilot (Vercel AI SDK + LiteLLM):**
   * *The Problem:* Users have no contextual help when evaluating complex bids.
   * *The Fix:* A persistent chat drawer built with Vercel AI SDK. It will use LiteLLM to answer questions about the marketplace, explain why a specific bid was disqualified by the timing gate, and assist with yield calculations.

4. **Proper Voice Agent (ElevenLabs):**
   * *The Problem:* The ElevenLabs `@elevenlabs/react` widget is a disconnected frontend component.
   * *The Fix:* Wire the voice cockpit to a conversational backend that can read the current user's ledger balance and execute bulk approvals.

---

## 3. Multi-Sprint Implementation Plan

### Sprint 1: Security, Wiring, and Verification (Next 2-4 Hours)
*Focus: Resolving hardcoded UI debts, implementing real Auth, and parsing KYC.*

- **Task 1.1 [Auth]:** Integrate **Supabase Google OAuth**. Create a Next.js middleware to enforce authenticated sessions.
- **Task 1.2 [Data Wiring & UI Debt]:** (Frontend Issue) Rip out the client-side math in `frontend/src/lib/scoring.ts` which incorrectly computes true cost. The frontend MUST call `POST /api/match` and render the exact `scoredOffers` returned by the server. Update the UI to a professional color palette (Deep Navy & Pearl White).
- **Task 1.3 [Verification Agent]:** Build an API route `/api/verify-document` that uses LiteLLM to extract entities from uploaded KYC documents, verifying both Sellers and Credit Providers against registered state data.

### Sprint 2: AI Capabilities & Communication (Next 4-8 Hours)
*Focus: Fulfilling the intelligent marketplace requirements.*

- **Task 2.1 [Chat UI]:** Build the Vercel AI SDK chat interface components, powered by LiteLLM.
- **Task 2.2 [Voice Agent]:** Connect the ElevenLabs conversational widget to the real backend data, allowing voice-activated ledger checks.

### Sprint 3: AWS Deployment & CI/CD
*Focus: Going live. Start this sprint as soon as Sprint 1 is stable.*

- **Task 3.1 [Database Pipeline]:** We are currently pointing `DATABASE_URL` directly to a Supabase pooler on AWS AP-Northeast-1. Ensure migrations run cleanly via GitHub Actions.
- **Task 3.2 [Compute Pipeline]:** Deploy the Next.js frontend and API routes to **AWS Amplify Gen 2** or **AWS ECS/Fargate**. Amplify will handle SSR, connect to our GitHub `main` branch, and provide instant CI/CD rollouts.
