# LienRho: Production-Ready Sprint Plan & Gap Analysis (v1)

## 1. Current Repository Progress
Based on the `dev` branch analysis, here is what the team has accomplished:
- **Backend (Track 1):** Merged and stable. Ragav completed the Prisma schema, Stitch double-entry ledger, seed data (Vertex, Rapidfin, etc.), and the core API routes (`/api/opportunities`, `/api/ledger`).
- **Frontend (Track 4):** 40-50% complete. PR #21 is open. The 2-way role model (Supplier vs Provider) is established.
- **CI/CD Basics:** The team added a basic GitHub Actions pipeline and a `demo.sh` script for end-to-end walkthroughs.

## 2. Gap Analysis (What's Missing)
To make this a complete, production-ready application, we are missing the following standard features:
1. **Authentication & User Management:** No active session management. Currently relying on hardcoded personas.
2. **AI Chat Integration:** Missing the Vercel AI SDK and LiteLLM/NVIDIA LiteLLM integrations for real-time user assistance.
3. **Proper Voice Agent:** The ElevenLabs `@elevenlabs/react` widget is not fully wired to a conversational backend.
4. **Document Verification Agent:** A missing capability to parse uploaded KYB (Know Your Business) and financial documents to upgrade a user's verification tier.

## 3. Frontend Redesign: Professional Color Palette
To pivot from the "Apple Light" theme to a professional, high-trust financial marketplace, we adopt the **"Minimalist Corporate"** palette based on color psychology:
*   **Primary (Trust & Security): Deep Navy (`#0F172A`) or Slate Blue (`#1E3A8A`).** Blue lowers heart rates and universally signifies financial stability and corporate trust.
*   **Background (Clarity): Pearl White (`#F8FAFC`).** Stark white can cause eye strain. A subtle cool gray/off-white looks expensive and reduces fatigue.
*   **Action / Success (Growth): Emerald Green (`#059669`).** Used strictly for "Accept Bid", "Funds Disbursed", or positive yield.
*   **Warning / Urgency (Action): Amber/Gold (`#D97706`).** Used for expiring bids or missing documentation.
*   *Design Style:* Flat bento grids, tight typography (Inter/Geist), and muted pastels.

## 4. Multi-Agent Architecture Plan
We will implement the following agents to fulfill the problem statement requirements:
1. **Document Verification Agent (New):** A backend AI agent that accepts PDF uploads (Invoices, Tax IDs), extracts the text, and verifies it against the counterparty (Buyer). Upgrades the `VerificationTier` in the database.
2. **Platform Copilot (New - Vercel AI SDK):** A persistent chat drawer for Suppliers and Providers. Uses LiteLLM/NVIDIA LiteLLM to explain yield calculations, negotiate bids, or answer questions about the marketplace.
3. **Voice Cockpit (ElevenLabs):** A voice-activated command center for the Capital Provider to quickly approve bulk trades or get daily portfolio briefings.

---

## 5. Sprint Implementation Plan

### Sprint 1: Core Foundation & Trust (Next 2-4 Hours)
*Focus: Getting the application secure and wired up.*
- **Task 1.1 [Auth]:** Implement **Supabase Auth** (Email/Password & OAuth). Create a secure Next.js middleware to protect `/dashboard` routes.
- **Task 1.2 [Data Wiring]:** (Harsha's Issue #22) Connect the real Prisma API payloads to the frontend state (removing mock data).
- **Task 1.3 [Frontend Redesign]:** (Yuvaraj's Issue #23) Apply the new Deep Navy / Emerald color palette. Replace the Apple aesthetic with the new professional styling.

### Sprint 2: AI & Agent Integration (Next 4-8 Hours)
*Focus: Fulfilling the AI requirements of the hackathon.*
- **Task 2.1 [Chat UI]:** Install `ai` (Vercel AI SDK) and build the chat interface components.
- **Task 2.2 [Doc Agent]:** Build an API route `/api/verify-document` that uses an LLM to parse uploaded invoices/KYB docs and update the Prisma database.
- **Task 2.3 [Voice Agent]:** Implement the ElevenLabs conversational widget tied to a webhook that can read the current user's ledger balance.

### Sprint 3: AWS Deployment & CI/CD
*Focus: Going live. You should start this sprint **as soon as Sprint 1 is stable**, do not wait until the end.*
- **Task 3.1 [Database]:** (If applicable) Migrate Supabase PostgreSQL to AWS RDS/Aurora as planned in Track 1, or keep Supabase for the demo and deploy the compute to AWS.
- **Task 3.2 [Compute Pipeline]:** Set up **AWS Amplify Gen 2** or **AWS ECS/Fargate**. Amplify is highly recommended for Next.js apps as it handles SSR and provides out-of-the-box CI/CD connected directly to your GitHub `main` branch.
- **Task 3.3 [Automation]:** Update the existing GitHub Actions to run `npm test` and `npm run lint` before allowing merges to `main`.
