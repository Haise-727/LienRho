# Docs — LienRho, CSI ORIGIN 2026 Problem Statement 5

Planning and design docs for the pivot from the earlier receivables-decision
product to **PS-5: Building a Competitive Capital Market for Supply-Chain
Working Capital**. `Problem_Statement_5.pdf` in this folder is the original
brief.

## Read in this order

| Doc | What it answers |
|---|---|
| [`00-brief.md`](00-brief.md) | What changed, why it's a different product, the one-line thesis |
| [`01-commerce-analysis.md`](01-commerce-analysis.md) | How this market actually works commercially — the economics, the worked example, auction design, anti-fraud checks, regulatory reality |
| [`02-carryover-audit.md`](02-carryover-audit.md) | What survives from the old build, what dies, what's genuinely new |
| [`03-system-design.md`](03-system-design.md) | Architecture, modules, agents, data model, the full opportunity lifecycle state machine |
| [`04-build-plan.md`](04-build-plan.md) | Scope, phases, demo-able checkpoints, demo narrative |
| [`05-decisions-needed.md`](05-decisions-needed.md) | Open questions and resolved decisions — infra and sponsor integrations are on hold, see below |
| [`06-implementation-plan.md`](06-implementation-plan.md) | **Start here for actual work.** What's transferred and verified working, what to remove/rework, and the 4-way split for phase 1 |

## Decisions made so far (see `05-decisions-needed.md` for the reasoning)

- **Name:** staying **LienRho**.
- **Infra:** deferred. Local/deterministic (FastAPI + Postgres + Docker Compose) until the core marketplace logic works — no AWS commitment yet.
- **Sponsor integrations** (ElevenLabs, Stitch, CodeCrafters, NexusX): deferred until phases 0–3 of `04-build-plan.md` are solid. Note: what Stitch and NexusX's products actually *are* is still unconfirmed — don't design around either guess yet.

## The honest framing

This is not a pivot of the old product. It is a **new product that reuses a
strong foundation**. The skeleton, the risk model, and the engineering
discipline carry over; the business logic, the primary user surface, and the
entire market side are new. Saying that plainly up front is better than
discovering it in day three of the build — see
[`02-carryover-audit.md`](02-carryover-audit.md) for the line-by-line.
