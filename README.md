# Transition — CSI ORIGIN 2026, Problem Statement 5

Planning workspace for moving from the current receivables-decision product to
**PS-5: Building a Competitive Capital Market for Supply-Chain Working Capital**.

Nothing here is code and nothing here is committed. This folder sits *outside*
the existing repository on purpose: the intent is a fresh repository with no
links or history back to the previous project, and a planning folder living
inside the old repo would itself be a trace.

## Read in this order

| Doc | What it answers |
|---|---|
| [`00-brief.md`](00-brief.md) | What changed, why it's a different product, the one-line thesis |
| [`01-commerce-analysis.md`](01-commerce-analysis.md) | How this market actually works commercially — the economics, the arithmetic, auction design, regulatory reality |
| [`02-carryover-audit.md`](02-carryover-audit.md) | What survives from the old build, what dies, what's genuinely new |
| [`03-system-design.md`](03-system-design.md) | Proposed architecture, modules, agents, data model |
| [`04-build-plan.md`](04-build-plan.md) | Scope, phases, demo-able checkpoints, demo narrative |
| [`05-decisions-needed.md`](05-decisions-needed.md) | Open questions only the team can settle |

## Naming

Docs use **`«PROJECT»`** as a placeholder throughout rather than inventing a
name, so they can be dropped into the new repo and find-replaced once. Name
candidates are in [`05-decisions-needed.md`](05-decisions-needed.md).

## The honest framing

This is not a pivot of the old product. It is a **new product that reuses a
strong foundation**. The skeleton, the risk model, and the engineering
discipline carry over; the business logic, the primary user surface, and the
entire market side are new. Saying that plainly up front is better than
discovering it in day three of the build — see
[`02-carryover-audit.md`](02-carryover-audit.md) for the line-by-line.
