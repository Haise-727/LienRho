# Executive Summary
The frontend currently violates the single-source-of-truth principle by calculating its own financial metrics (e.g., effective cost, net cash) in `frontend/src/lib/scoring.ts`. Critically, its math is incorrect (it divides by the advance instead of net cash). Furthermore, the Urgency Slider updates local state but never re-triggers a match against the backend engine, rendering it purely cosmetic. 

This plan details how to strip the frontend of all financial arithmetic, wire the urgency slider to `POST /api/match`, enforce exact rendering of server-provided logic (including timing gate explanations), and overhaul the visual aesthetics to a "Minimalist Corporate" high-trust financial style.

# Current Architecture
*   **Framework:** Next.js 16 (App Router) + React 19 + Tailwind CSS 4.
*   **Data Fetching:** Currently using `fetch` inside `useEffect` (via `api-client.ts`) but lacking a dedicated connection to `POST /api/match`.
*   **API Client Structure:** `frontend/src/lib/api-client.ts` fetches initial opportunities but relies heavily on local state processing.
*   **Styling:** A pseudo "Apple Light" theme with soft shadows (`shadow-[0_4px_20px_rgba(0,0,0,0.03)]`) and heavy corner rounding (`rounded-3xl`).

# Current Data Flow (BEFORE)
```text
User moves Urgency Slider
  ↓
Local component state (`urgencyWeight` 0 to 1)
  ↓
`useMemo` hook triggers in `page.tsx`
  ↓
Calls `computeDealMetrics()` locally in `scoring.ts`
  ↓
Frontend computes `effectiveCost` (incorrectly) and `netCash`
  ↓
`DittoDealCard` renders localized math.
```

# Required Data Flow (AFTER)
```text
User moves Urgency Slider
  ↓
State updates (`urgencyNudgeBps` 0 to 500)
  ↓
Data fetcher triggers `POST /api/match`
  ↓
JSON Payload: { opportunityId, urgencyNudgeBps }
  ↓
Backend Ledger/Scoring Engine runs exact math and lexicographic gates
  ↓
Server responds with `ScoredOffer[]` (including plain-English gate explanations)
  ↓
`DittoDealCard` strictly formats paise to INR and renders verbatim strings.
```

# Required Changes

## 1. Financial Logic Removal
The frontend must not calculate any numbers. It is a strict terminal for the backend.

### Target: `frontend/src/lib/scoring.ts`
*   **Current Responsibility:** Computing true cost, advance, reserve, and local Pareto utility scores.
*   **Required Change:** Delete `computeDealMetrics()`, the `ComputedDeal` interface, and all arithmetic formulas. 
*   **Allowed:** Keep purely presentational formatting functions like `formatINR()`. You must adapt `formatINR` to accept backend `Paise` (integers) and convert them to Rupee floats strictly for display, but never for computation.

## 2. Urgency Slider → API
### Target: `frontend/src/components/auction/UrgencySlider.tsx`
*   **Current Responsibility:** Ranges from 0 to 1, updating a floating point multiplier.
*   **Required Change:** 
    *   Change the slider's `min="0"` and `max="500"`.
    *   Update the visual label exactly to: **"Urgency Override (bps)"**.
    *   Change the type signature to pass an integer instead of a float.

### Target: `frontend/src/app/page.tsx`
*   **Current Responsibility:** Passes local `urgencyWeight` into `useMemo`.
*   **Required Change:** 
    *   Replace `useMemo` with a robust data-fetching action (or SWR/React Query hook if available, otherwise standard `useEffect` with debounce).
    *   Call `POST /api/match` with `{ opportunityId: string, urgencyNudgeBps: number }`.
    *   Set the returned `scoredOffers` directly into state.

## 3. Server Response Rendering
### Target: `frontend/src/components/cards/DittoDealCard.tsx`
*   **Current Responsibility:** Renders the locally calculated `ComputedDeal` props.
*   **Required Change:** 
    *   Accept the backend `ScoredOffer` interface (from `lib/market/types.ts`).
    *   Render the effective cost directly from `offer.effectiveAnnualCostBps` (formatting bps to a percentage string).
    *   **Disqualification Text:** If `!offer.passedGates`, render `offer.gates.timing.reason` and `offer.gates.sufficiency.reason` exactly as provided. Do not concatenate or modify the strings.

## 4. Visual System Redesign
We are moving to a **Minimalist Corporate** financial aesthetic. 
*   **Colors:**
    *   Primary Background: `#F8FAFC` (Pearl White)
    *   Text / Dark UI elements: `#0F172A` (Deep Navy)
    *   Borders: `#E2E8F0` (Slate-200)
    *   Primary Action: `#059669` (Emerald) - Hover: `#047857`
    *   Warning/Disqualified: `#D97706` (Amber)
*   **Global Structural Changes:**
    *   Remove all `rounded-3xl` and replace with crisp `rounded-md` or `rounded-none` bento boxes.
    *   Remove all soft drop shadows (`shadow-[...]`). Use 1px solid borders (`border-slate-200`) to define hierarchy.

## 5. Offer/Bid States
### Exact UI Requirements (Do not deviate)
1.  **Primary Action Button:** For winning/acceptable bids, the button text MUST be exactly `"Accept Terms & Disburse"`. 
    *   *Classes:* `bg-emerald-600 hover:bg-emerald-700 text-white`.
2.  **Secondary Action Button:** For viewing details, the button text MUST be exactly `"View Ledger Trail"`.
    *   *Classes:* `bg-transparent border border-slate-200 text-slate-900`.
3.  **Disqualified Badge:** Bids that fail the gates MUST display a badge containing exactly `"Disqualified"`.
    *   *Classes:* `bg-amber-600 text-white font-bold`.

---

# File-by-File Change Plan

### `frontend/src/lib/scoring.ts`
*   **Why it changes:** Contains forbidden client-side financial math.
*   **Required change:** Delete `computeDealMetrics` and its associated types. Keep `formatINR`.
*   **Validation:** A global repo search for `effectiveApr` or `advanceCash =` yields zero results in the `frontend` folder.

### `frontend/src/components/auction/UrgencySlider.tsx`
*   **Why it changes:** The slider has the wrong bounds and label.
*   **Required change:** Update `min`, `max`, exact label string, and strip the Apple-style drop shadows.

### `frontend/src/app/page.tsx`
*   **Why it changes:** Currently does not call `/api/match`.
*   **Required change:** Remove the local `useMemo` ranking. Implement a function to fetch from `POST /api/match` when the urgency slider changes (debounced by 300ms).

### `frontend/src/components/cards/DittoDealCard.tsx`
*   **Why it changes:** It expects the wrong data shape and has the wrong aesthetics.
*   **Required change:** Bind strictly to `ScoredOffer`. Implement the exact button strings ("Accept Terms & Disburse") and colors (Emerald/Amber/Slate).

### `frontend/tailwind.config.ts` (or `globals.css`)
*   **Why it changes:** Requires base variable overrides to enforce the Pearl White/Deep Navy themes.
*   **Required change:** Set the `body` background to `#F8FAFC`.

---

# Testing Plan
1. **Financial Correctness:** Assert that no JavaScript arithmetic is performed on interest rates in the frontend codebase.
2. **Slider Bounds:** Assert the slider goes from 0 to 500.
3. **Network Request:** Intercept `POST /api/match` and assert the JSON body contains `urgencyNudgeBps`.
4. **Verbatim Text:** Assert that exact strings `"Accept Terms & Disburse"`, `"View Ledger Trail"`, and `"Disqualified"` exist in the DOM.

# Gemini 3.7 Flash Execution Contract
*Dear Agent, adhere strictly to these rules:*
1. Do not invent API fields. Read exactly from `ScoredOffer` in `frontend/src/lib/market/types.ts`.
2. Do not perform financial arithmetic in frontend code. Division, multiplication of rates, and advance calculations are strictly banned.
3. Use the `/frontend-design` skill to inform your CSS and Tailwind choices, strictly adhering to the Minimalist Corporate palette provided.
4. Preserve exact server-provided disqualification messages without string manipulation.
5. Preserve exact required button/badge text.
6. Verify the actual network payload contains `urgencyNudgeBps` in your tests.
7. Do not declare completion until all acceptance criteria have been explicitly verified against the running application.
