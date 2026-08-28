# Implementation Plan: Track 4 (Frontend UI - CSI ORIGIN MVP)

## Goal Description
The objective of this track is to build the visual face and full-stack client dashboard for the LienRho platform using Next.js (App Router), TypeScript, and Tailwind CSS. The UI will adopt an ultra-clean, premium Apple product marketing aesthetic (pure white backgrounds, subtle frosted glass, crisp typography). We will implement a unified single-account model where users can toggle between Supplier, Buyer, and Capital Provider views instantly. We will also build the key sponsor components: ElevenLabs Voice Cockpit, Stitch Ledger Visualizer, and CodeCrafters live bid ticker.

## User Review Required
> [!IMPORTANT]
> **Dependencies:** I will need to install `framer-motion` (for the smooth layout transitions and ticker animations) and `@elevenlabs/react` (for the voice integration). 
> **Mock Data Strategy:** Since Track 1 & 2 backend endpoints may not be fully complete, this frontend track will include built-in fallback mock data so the UI remains fully interactive and demo-ready for the hackathon pitch regardless of backend status.

## Open Questions
> [!WARNING]
> Do you have a specific ElevenLabs Agent ID you want me to hardcode into the `.env.local`, or should I use a pure mock visual simulator for the Voice WebRTC component if the API key isn't provided?

## Proposed Changes

### 1. Dependencies & Configuration
I will add the necessary UI animation and voice packages.
#### [MODIFY] `frontend/package.json`
- Add `framer-motion` and `@elevenlabs/react`.
#### [MODIFY] `frontend/tailwind.config.ts` (or globals.css)
- Add custom Apple-style shadow classes, font-tracking variables, and standard neutral colors.

### 2. Core Layout & Navigation
#### [MODIFY] `frontend/src/app/layout.tsx`
- Implement a global frosted glass header (`backdrop-blur-xl bg-white/80`).
- Embed the ElevenLabs CFO Voice AI Trigger and the unified Role Switcher pill in the header.
#### [MODIFY] `frontend/src/app/page.tsx`
- Create a master state manager that toggles the main viewport between `SupplierView`, `BuyerView`, and `ProviderView` without reloading.

### 3. Supplier View Components (Auction Cockpit)
#### [NEW] `frontend/src/components/auction/UrgencySlider.tsx`
- A sleek, high-end range slider mapping "Instant Liquidity" to "Lowest Cost". Updates a React state weight which recalculates bid scores.
#### [NEW] `frontend/src/components/auction/BidTicker.tsx`
- A real-time animated feed of incoming institutional bids using `framer-motion` `AnimatePresence`.
#### [NEW] `frontend/src/components/cards/DittoDealCard.tsx`
- "Plain-English" breakdown cards. Includes "Play 30s Audio" button (TTS mock) and "Accept & Disburse" action button.
#### [NEW] `frontend/src/lib/scoring.ts`
- The Pareto Multi-Attribute scoring math that takes the Slider weight and live bids, ranking them deterministically.

### 4. Buyer & Provider View Components
#### [NEW] `frontend/src/components/verification/VoiceVerificationModal.tsx`
- A modal simulating the outbound procurement phone call (WebRTC visualizer) with a live transcript.
#### [NEW] `frontend/src/components/provider/PortfolioGauge.tsx`
- Risk and liquidity exposure progress bars for the Capital Provider view.

### 5. Multi-Agent & Ledger Audit Components
#### [NEW] `frontend/src/components/ledger/StitchLedgerTimeline.tsx`
- A collapsible Double-Entry ledger table (Debits/Credits) proving Day 0 to Day 90 reconciliation.
#### [NEW] `frontend/src/components/audit/AgentActivityLog.tsx`
- A sleek side-sheet or bottom-drawer streaming log of autonomous Agentic Framework and CodeCrafters actions.

---

## Verification Plan

### Automated Tests
Run the TypeScript compiler to ensure all interfaces and strict typings match:
```bash
cd frontend && npx tsc --noEmit
```

### Manual Verification
1. Open `http://localhost:3000`.
2. Toggle the Role Switcher in the top navigation between Supplier, Buyer, and Provider.
3. In Supplier mode, adjust the Urgency Slider and verify the Ditto Deal Cards instantly re-sort.
4. Click the ElevenLabs Voice trigger and verify the modal and animation open cleanly.
