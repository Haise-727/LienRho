# Hardcoded Technical Debts & Disconnected State

This document tracks all hardcoded data, mock state, and architectural shortcuts that must be resolved to make LienRho production-ready. These are explicitly referenced in the GitHub issues for the next sprint.

## 1. Frontend UI Mathematics (Critical)
*   **Location:** `frontend/src/lib/scoring.ts`
*   **The Debt:** The UI currently recomputes its own financial numbers (effective cost, advance, net cash) instead of using the API. Crucially, the UI's effective cost calculation divides by the *advance* rather than the *net cash*, understating the true cost.
*   **The Fix:** Delete the arithmetic in `scoring.ts`. The UI must call `POST /api/match` and blindly render the `scoredOffers` returned by the server. All plain-English gate reasons and math must come from the backend.

## 2. Hardcoded Pseudo-Login Personas
*   **Location:** `frontend/src/app/login/page.tsx`
*   **The Debt:** The login screen presents hardcoded buttons to switch between seeded organizations (e.g., Vertex Components, Meridian Bank) by setting a cookie or local state. There is no cryptographic session validation.
*   **The Fix:** Rip out the hardcoded personas. Implement **Supabase Auth with Google OAuth**. Upon successful OAuth callback, map the Google identity to a Prisma `Organization` and issue a real JWT.

## 3. Disconnected Urgency Weight
*   **Location:** `frontend/src/components/auction/UrgencySlider.tsx` (and `scoring.ts`)
*   **The Debt:** Supplier urgency is computed visually via a slider, but this `urgencyNudgeBps` parameter is never actually sent to the backend matcher. It is purely cosmetic right now.
*   **The Fix:** Wire the slider's state to the API client so it is included in the payload to `POST /api/match`.

## 4. Hardcoded Agent Provider Fees
*   **Location:** `ai/nexus/providers.py`
*   **The Debt:** The Python agent logic has a bug where `fees_paise = 2_500_000` is documented as "₹2,500" but is actually ₹25,000 (a rupee is 100 paise).
*   **The Fix:** Correct the constant to `250_000`.

## 5. Static Provider Bidding (No Dynamic Pricing)
*   **Location:** `ai/nexus/providers.py`
*   **The Debt:** Capital providers do not dynamically price risk. Their bids are copied from a frozen dataclass. Every provider quotes identically for every invoice and never declines.
*   **The Fix:** Implement the NVIDIA LiteLLM integration to allow providers to dynamically adjust their `annual_rate_bps` and `advance_rate_bps` based on the specific Buyer's credit profile and the Supplier's `VerificationTier`.
