# Research: ElevenLabs Voice "Explaining" Agent for the NexusX Market-Clearing System (Track 3)

> **Purpose.** How have other teams built ElevenLabs voice agents that *explain* things
> (advisory / financial / invoice explainers), and how should we wire one to our Nexus
> clearing agents? Compiled from web research on 2026-08-28 via three parallel research
> subagents. No ElevenLabs-specific entry was found in the local ForbiddenKnowledge
> `atomic-capabilities` index, so this is web-sourced (per the knowledge protocol:
> "websearch ONLY to fill gaps the KB doesn't cover").

---

## 1. TL;DR for our build

- **ElevenLabs Conversational AI** is a managed real-time `STT -> LLM -> TTS` shell with a
  proprietary turn-taking model. It should own the *conversation*, **not the math**.
- Our `ai/nexus` clearing agents already compute offers, effective annual cost, and the
  winning match **deterministically**. Keep them as the **authoritative backend**; the voice
  agent only *explains* their output. This directly satisfies our hard rule:
  **"No LLM computes a financial figure."**
- Canonical pattern: **Voice agent -> webhook tool -> `ai/nexus` (or a Next.js route that
  calls it) -> structured JSON -> voice agent speaks it back, citing a source.**
- Drop-in UI: `@elevenlabs/react` "CFO Voice Cockpit" in Next.js, with a server route that
  mints a **signed URL** so `XI_API_KEY` never reaches the browser.
- Ground explanations in a **RAG knowledge base** of invoice-financing explainers (advance %,
  fee structure, who-pays-whom) plus source attribution, so the agent explains terms without
  inventing them.

---

## 2. ElevenLabs Conversational AI — architecture

**Building blocks**
- **Agent / System prompt** — the "personality + policy blueprint": role, goals, tone,
  guardrails. Best-practice structure = six blocks: Personality, Environment, Tone, Goal,
  Guardrails, Tools. Has *no* control over turn-taking or language (platform-level).
- **LLM layer** — pluggable (ElevenLabs default, GPT-5.2, Claude Sonnet 4/4.5, Gemini-2.5-Flash,
  custom, or **LLM cascading**). For tool-calling use high-intelligence models; avoid Gemini-2.0-Flash
  (known high turn latency).
- **TTS / Voice** — 5,000+ voices, 31+ languages; voice design, speed 0.7x–1.2x, expressive mode.
- **Knowledge base (RAG)** — per-agent docs/URLs; `Full context` (small docs) or `RAG`
  (indexed chunks). Reduces hallucination. Keep prompts < 2,000 tokens; push reference
  material into the KB.
- **Tools** — four types (see §4): Client, Webhook, MCP, System.
- **Turn-taking** — Eager / Normal / Patient modes; VAD-based interruption handling.

**Tool taxonomy**
- **Client tools** — run in the browser (DOM/UI events). Good for opening modals, navigation.
- **Webhook tools** — server-side HTTP to your REST API (fetch live data / take actions).
  Auth via OAuth2/JWT/Basic/Bearer.
- **MCP tools** — Model Context Protocol servers (hosted MCP available); supports approval flows.
- **System tools** — built-in: `end_call`, `language_detection`, `agent_transfer`,
  `transfer_to_number`, `skip_turn`, etc.

**Client SDKs / connection modes**
- `@elevenlabs/react` (re-exports `@elevenlabs/client`) — web. `ConversationProvider` +
  hooks (`useConversation`, `useConversationControls`, `useConversationStatus`). Voice uses
  **WebRTC** by default; text-only uses WebSocket. Requires mic permission.
- `Conversation.startSession({ agentId | signedUrl | conversationToken, clientTools })`.
- `elevenlabs` Python SDK — `Conversation` + `ClientTools` + `conversation.start_session()`.
- Embeddable **widget**: `<elevenlabs-convai agent-id="...">`.
- **Agents CLI** — "agents as code": `elevenlabs agents push`, `elevenlabs tools add`.

---

## 3. How others built "explaining" voice agents (real examples)

| # | Example | Stack | What made "explaining" work | URL |
|---|---------|-------|------------------------------|-----|
| 1 | ElevenLabs Finance Chatbot | Conversational AI + RAG KB | RAG over product/policy docs; routes advice to humans; disclaimers | https://elevenlabs.io/chatbot/finance |
| 2 | Ministry of Banking support | ElevenLabs + Claude Sonnet 4.5 + webhook tools | Prompt split into personality/goals/guardrails/tool-usage; dynamic vars = "working memory"; number/date formatting rules | https://ministryofprogramming.com/blog/building-conversational-voice-ai-agents-with-elevenlabs-a-practical-guide-to-customer-support-automation |
| 3 | Monet microcredit educator | ElevenLabs + Qwen3-30B + Firecrawl tool | "CRAFT" framework: Acknowledge -> Explain -> Reinforce -> Suggest; 2–3 ideas max, no jargon | https://github.com/jcortizleon/monet-elevenlabs-firecrawl-challegne |
| 4 | Banking-Assistant "Mr. Monopoly" | Twilio + ElevenLabs STT/TTS + Gemini + Nessie API | **Live figures from API, not the LLM** ("authoritative numbers from backend, not invented") | https://github.com/brightstarchetan/Banking-Assistant |
| 5 | Conversational Insurance / Investors | ElevenLabs SDK + Node/Express | Persona-driven experts; SEBI/disclaimer compliance; "information ≠ advice" | https://github.com/Finance-LLMs/Conversational-Insurance-Agents , https://github.com/Finance-LLMs/Finance-Investors-Dashboard |
| 6 | Peakflo AR voice agent | ERP/CRM (NetSuite/SAP/QuickBooks) + Stripe | Bi-directional ERP sync; reads invoice status live, writes back outcomes; escalates complex cases | https://peakflo.co/blog/ai-voice-agents-accounts-receivable-collection |
| 7 | ElevenLabs Procurement / Invoice chatbot | Conversational AI + ERP/S2P | 24/7 supplier invoice-status Q&A; connected to real-time AP data | https://elevenlabs.io/chatbot/procurement |
| 8 | Digiqt vendor-management voice bot | RAG (policy) + ERP tools | "Supplier calls about invoice 78432 -> verify -> pull AP -> explain net-30 + scheduled date -> offer remittance copy" | https://digiqt.com/blog/voice-bot-in-vendor-management/ |
| 9 | ElevenLabs multimodal invoice review | Vision-capable LLM + `file_input` | User uploads PDF invoice *during the call*; agent reads amounts/vendor and answers verbally | https://elevenlabsmagazine.com/elevenlabs-multimodal-agents-guide-2026/ |

**Common patterns for explainability**
- RAG over a curated knowledge base; small docs injected, large docs retrieved (~250ms overhead).
- **Tool-calling to a backend for live numbers** (webhook/client tools); "pre-tool speech"
  ("Let me check that for you") kills dead air.
- Clarifying questions + multi-turn context (dynamic variables persist extracted facts).
- **Source attribution** (`source_attribution: true`) — prompt must say "attribute to the
  source title" or the agent retrieves but doesn't cite.
- Low temperature (0.1–0.3), scoped prompts ("use only the KB; if not there, say so"),
  explicit "I don't know / escalate" path.
- Compliance: "this is informational, not advice" disclaimers; human escalation.

**Grounding content for our offers** (load into the KB so the agent explains terms accurately):
NetSuite invoice-financing explainer, Drip Capital guide, readtreasury supply-chain-finance
explainer. These give citable mechanics (advance 70–90%, fee structure, who pays whom).

---

## 4. Integration: voice <-> backend multi-agent

**Canonical three-tier cascade**
1. **Voice layer (ElevenLabs Agent)** — owns STT/LLM/TTS + turn-taking; *not* business logic.
2. **Tool boundary** — when the LLM needs data, ElevenLabs issues an HTTP (or client JS) call
   and waits for the result before speaking.
3. **Backend (your server / agent framework)** — owns data, computation, sub-agent orchestration.
   Returns structured JSON that becomes the agent's "tool result."

**Tool execution modes**
| Tool | Runs | Use |
|------|------|-----|
| Webhook | Server HTTP | DB/secure computation, calls to backend APIs |
| Client | Browser JS | UI updates, navigation |
| Code | ElevenLabs sandbox JS | Light logic, no secrets |
| MCP | Your MCP server | Expose many backend tools |

Webhook invocation: LLM generates params -> ElevenLabs POSTs to your URL (path/query/body per
`api_schema`) -> your endpoint computes -> returns JSON. Options: `response_timeout_secs`
(5–120, def 20), `execution_mode` (`immediate`/`post_tool_speech`/`async`),
`tool_error_handling_mode` (`auto`/`summarized`/`passthrough`/`hide`), `pre_tool_speech`,
`interruption_mode`.

**Next.js + `@elevenlabs/react` (Voice Cockpit)**
- Wrap app in `<ConversationProvider>`; drive with `useConversation` / `useConversationControls`.
- Auth: a Next.js route `app/api/get-signed-url/route.ts` calls `GET /v1/convai/conversation/
  get-signed-url` server-side, returns `signedUrl`; `startSession({ signedUrl })`. **Never ship
  `XI_API_KEY` to the client.**
- Client tools run in the browser (cockpit UI actions). **Authoritative backend calls must be
  webhook tools** that hit your Next.js Route Handler / backend, which authenticates (HMAC
  `ElevenLabs-Signature`) and calls `ai/nexus`.

**Keeping the backend authoritative for numbers ("no LLM computes a financial figure")**
- Webhook tool = single source of truth. Prompt: "Never calculate. Call `get_clearing_result`
  and read the returned value verbatim."
- `response_filter` on the tool: `mode:"allow"` with `filters:["data.winner","data.effectiveCostPct"]`
  (or `hide_all`) to strip raw payloads from LLM context.
- Dynamic variable `assignments` + `sanitize:true`: extract the backend-computed number into
  `{{winner}}`; `sanitize` removes it from the tool text the LLM/transcript sees, so the model
  speaks the variable, **not a number it derived**. `preserve_native_type` keeps it numeric.
- `allowed_values_dynamic_variable`: when user picks from a set, runtime rejects anything not on
  the server-verified list (prevents LLM inventing an ID).
- ElevenLabs' own guidance: "Narrow tool access is a guardrail enforced by architecture, instead
  of hoping the prompt holds true."

**Multi-agent voice coordination**
- **Agent Workflows** — directed graph of subagents (`start`, `override_agent`, `dispatch_tool`
  with success/failure edges, `agent_transfer`, `end`). Subagents get *scoped* tools. Use for
  deterministic sequencing / specialization.
- **`transfer_to_agent` / `run_subagent`** system tools — hand off live conversation by condition.
- **Custom-LLM external orchestrator** (our "NexusX" pattern) — bring your own orchestrator
  (LangGraph/CrewAI/LlamaIndex) behind a Chat-Completions-compatible endpoint; a **stateful proxy**
  maps ElevenLabs sessions <-> orchestrator sessions. Reference: LangGraph 11-node graph + FastAPI
  SSE bridge (https://github.com/Automaticare/Government-Citizen-Services-Voice-Agent).
- Rule of thumb: independent agent + webhook tools for simple cases; Workflows for deterministic
  sequencing/specialization; Custom-LLM external orchestrator for your own graph/state machine.

---

## 5. Recommended architecture for NexusX (our system)

```
                  ┌──────────────────────────────────────────┐
   Supplier (CFO) │  Next.js "CFO Voice Cockpit"             │
        │ mic     │  - @elevenlabs/react widget             │
        │────────>│  - signed-url route (server-side key)   │
                  └───────────────────┬──────────────────────┘
                                       │ WebRTC/WebSocket
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │  ElevenLabs Conversational AI Agent       │
                  │  - system prompt: explains offers, NEVER  │
                  │    computes; cites KB source              │
                  │  - Knowledge Base (RAG): invoice-financing│
                  │    explainers                            │
                  │  - tools: get_clearing_result (webhook)  │
                  └───────────────────┬──────────────────────┘
                                       │ webhook POST /api/nexus/clear
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │  Next.js Route Handler  (HMAC verify)     │
                  │         │                                 │
                  │         ▼                                 │
                  │  ai/nexus  MarketClearingAgent           │
                  │   - SupplierAgent (urgency)             │
                  │   - LenderBiddingAgent (risk pricing)   │
                  │   - matching: gate-then-rank on EAC     │
                  │   - returns rankedBids + winner +        │
                  │     thesisNote  (deterministic)          │
                  └──────────────────────────────────────────┘
```

**Component responsibilities**
- **Voice shell (ElevenLabs agent):** conversational only. Explains the winning offer and *why*
  (e.g., "CapitalFirst has the lowest headline rate but under-funds your cash need, so
  StableTrust wins on true cost 13.5%"). Never produces a number itself.
- **Knowledge base:** invoice-financing explainer docs (advance %, fees, recourse, tenor) for
  term explanations; `source_attribution: true`.
- **Webhook tool `get_clearing_result`:** body = `ClearingRequest` (supplier + optional bids);
  returns the `ClearingResult` JSON (rankedBids, winner, thesisNote). This is the *only* place
  financials are computed.
- **CFO Voice Cockpit:** Next.js + `@elevenlabs/react`; server route mints signed URL.
- **Hard-rule enforcement:** `response_filter` + dynamic variable + `sanitize` so the LLM never
  sees a raw figure it could reinterpret; system prompt says relay-only.

**Multi-agent note:** our Nexus already has 3 agents (supplier / lender / market) behind one
clearing endpoint. The voice agent can orchestrate a simple sequence ("clarify intent -> run
clearing -> explain") either via a flat webhook call or, if we want deterministic branching,
via ElevenLabs **Agent Workflows** (clarify -> `dispatch_tool` -> explain). We do **not** need a
heavy external orchestrator for the MVP.

---

## 6. Pitfalls & mitigations (from practitioners)

- **Latency is the whole game.** Human budget ~300–500ms; >1.5s they hang up. Model choice
  matters as much as TTS. Mitigate: stream at every stage, co-locate regions, pick sub-300ms
  first-token LLM, use `post_tool_speech` to mask tool waits.
- **Cost at scale.** ElevenLabs is the most expensive TTS component (~60–80% of pipeline cost),
  per-character; concurrency caps are a hard wall. Plan tiers; cache warm-up.
- **Hallucinated numbers.** Root cause = no grounding. Fix: webhook tool for live data + RAG with
  source attribution + low temp + strict "only answer from X" prompts.
- **Webhook fragility.** Wrong response format = silence, no error. Add validation + fallback
  utterances; make handlers idempotent (ElevenLabs retries post-call webhooks).
- **Long spoken answers.** Voice can't carry a full analysis report. Tune prompts to "headline +
  key insight + recommendation"; cap spoken length.
- **Compliance.** Finance deployments add "informational, not advice" disclaimers + human
  escalation. Our `thesisNote` is an explanation, not advice — surface that distinction.

---

## 7. Concrete reference implementations

- Official quickstart: https://elevenlabs.io/docs/eleven-agents/quickstart
- `@elevenlabs/react` SDK: https://elevenlabs.io/docs/eleven-agents/libraries/react
- Docs agent "Alexis" (canonical explaining-agent walkthrough): https://elevenlabs.io/docs/eleven-agents/guides/elevenlabs-docs-agent
- elevenlabs/examples (runnable templates): https://github.com/elevenlabs/examples
- elevenlabs/ui (composable components): https://github.com/elevenlabs/ui
- ASHR12 conversational-ai-agents (Next.js + signed URL): https://github.com/ASHR12/elevenlabs-conversational-ai-agents
- AmerSarhan agent-toolkit (prompts + webhook examples): https://github.com/AmerSarhan/elevenlabs-agent-toolkit
- Conversational AI 2.0 (turn-taking/RAG): https://elevenlabs.io/blog/conversational-ai-2-0
- Agent Workflows: https://elevenlabs.io/docs/eleven-agents/customization/agent-workflows
- Custom-LLM external orchestrator (LangGraph + FastAPI SSE): https://github.com/Automaticare/Government-Citizen-Services-Voice-Agent
- Integrations deep-dive: https://elevenlabs.io/blog/integrating-complex-external-agents
- Webhook security: https://elevenlabs.io/docs/eleven-api/resources/webhooks
- Next.js quickstart: https://elevenlabs.io/docs/eleven-agents/guides/quickstarts/next-js

---

## 8. Open decisions for us

1. **Agent core location:** keep `ai/nexus` as a Python service behind a Next.js route (fastest,
   reuses verified code), or port the logic to TypeScript inside the Next.js app (matches Option A
   "no Python"). The research shows the webhook-tool pattern works either way.
2. **Voice provider:** sponsor is **ElevenLabs** (committed). (ForbiddenKnowledge notes offline
   alternatives like `piper`/`faster-whisper`, but those are not the sponsor deliverable.)
3. **Orchestration depth:** flat webhook call vs ElevenLabs Agent Workflows for the
   clarify->run->explain sequence. MVP can ship with the flat call; Workflows are a Phase-2 polish.
4. **KB content:** assemble 2–3 citable invoice-financing explainer docs for the RAG layer.

---

## 9. Sources (consolidated)

- https://elevenlabs.io/docs/eleven-agents/overview
- https://elevenlabs.io/docs/eleven-agents/quickstart
- https://elevenlabs.io/docs/eleven-agents/libraries/react
- https://elevenlabs.io/docs/eleven-agents/guides/quickstarts/next-js
- https://elevenlabs.io/docs/eleven-agents/guides/elevenlabs-docs-agent
- https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools
- https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools
- https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag
- https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables
- https://elevenlabs.io/docs/eleven-agents/customization/agent-workflows
- https://elevenlabs.io/docs/eleven-api/resources/webhooks
- https://elevenlabs.io/blog/conversational-ai-2-0
- https://elevenlabs.io/blog/unpacking-elevenagents-orchestration-engine
- https://elevenlabs.io/blog/integrating-complex-external-agents
- https://elevenlabs.io/blog/omnichannel-ai-agent
- https://elevenlabs.io/chatbot/finance
- https://elevenlabs.io/chatbot/procurement
- https://ministryofprogramming.com/blog/building-conversational-voice-ai-agents-with-elevenlabs-a-practical-guide-to-customer-support-automation
- https://github.com/jcortizleon/monet-elevenlabs-firecrawl-challegne
- https://github.com/brightstarchetan/Banking-Assistant
- https://github.com/Finance-LLMs/Conversational-Insurance-Agents
- https://github.com/Finance-LLMs/Finance-Investors-Dashboard
- https://peakflo.co/blog/ai-voice-agents-accounts-receivable-collection
- https://digiqt.com/blog/voice-bot-in-vendor-management/
- https://elevenlabsmagazine.com/elevenlabs-multimodal-agents-guide-2026/
- https://github.com/elevenlabs/examples
- https://github.com/elevenlabs/ui
- https://github.com/ASHR12/elevenlabs-conversational-ai-agents
- https://github.com/AmerSarhan/elevenlabs-agent-toolkit
- https://github.com/Automaticare/Government-Citizen-Services-Voice-Agent
- https://deepgram.com/learn/why-elevenlabs-gets-expensive-at-scale
- https://www.forasoft.com/blog/article/livekit-ai-agents-guide
- https://netsuite.com/portal/resource/articles/accounting/invoice-financing.shtml
- https://dripcapital.com/en-us/resources/finance-guides/invoice-financing
- https://readtreasury.com/deals/supply-chain-finance-explained