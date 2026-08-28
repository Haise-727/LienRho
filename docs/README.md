# Documentation

Design and analysis for **LienRho** — an agentic capital marketplace for
supply-chain working capital, built for CSI ORIGIN 2026 Problem Statement 5.
[`Problem_Statement_5.pdf`](Problem_Statement_5.pdf) is the original brief.

← [Back to the project README](../README.md)

---

## If you only read two

| Doc | Why |
|---|---|
| [`01-commerce-analysis.md`](01-commerce-analysis.md) | How this market actually works — the economics, the worked example that is the whole product, auction design, anti-fraud, and the regulatory reality |
| [`03-system-design.md`](03-system-design.md) | The architecture: modules, agents, the data model, and the full opportunity lifecycle |

Working in the code? [`09-database.md`](09-database.md) is the reference — what
every table holds, why, and what is guaranteed about it.

---

## Core sequence

Written to be read in order. Each one answers a specific question.

| Doc | What it answers |
|---|---|
| [`00-brief.md`](00-brief.md) | What this product is, why it's a two-sided market problem, and the one-line thesis |
| [`01-commerce-analysis.md`](01-commerce-analysis.md) | The commercial reality — offer anatomy, supplier utility, provider mandates, market design, information asymmetry, regulation |
| [`02-carryover-audit.md`](02-carryover-audit.md) | What transferred from the earlier receivables build, what died, what was new construction |
| [`03-system-design.md`](03-system-design.md) | Architecture, the ten modules, the agent boundaries, the lifecycle state machine |
| [`04-build-plan.md`](04-build-plan.md) | Scope, phasing, demo-able checkpoints, the demo narrative |
| [`05-decisions-needed.md`](05-decisions-needed.md) | Open questions and resolved decisions, with the reasoning kept rather than deleted |
| [`06-implementation-plan.md`](06-implementation-plan.md) | The four parallel tracks and what each owns |
| [`07-file-ownership.md`](07-file-ownership.md) | Who works where — the map that keeps four people out of each other's diffs |
| [`08-aws-migration-plan.md`](08-aws-migration-plan.md) | Sprint 2: Supabase → Aurora, ECS Fargate, ElastiCache |
| [`09-database.md`](09-database.md) | **The data model in full** — every table, the money conventions, the ledger mechanics, invariants, and query recipes |

---

## Track working docs

Per-track design notes. Useful for depth on one area, not required for
understanding the product.

| Doc | Track |
|---|---|
| [`tracks/track3-agent-architecture.md`](tracks/track3-agent-architecture.md) | Voice AI and the NexusX agent design |
| [`tracks/track3-nexusx-internals.md`](tracks/track3-nexusx-internals.md) | How the agent layer works internally |
| [`tracks/track3-build-summary.md`](tracks/track3-build-summary.md) | What was built and why |
| [`tracks/track3-matching-explained.md`](tracks/track3-matching-explained.md) | Where matching sits relative to the agents |
| [`tracks/track3-testing.md`](tracks/track3-testing.md) | Verifying the agent layer offline |
| [`tracks/track4-frontend-plan.md`](tracks/track4-frontend-plan.md) | Frontend UI plan |
| [`tracks/repo-analysis.md`](tracks/repo-analysis.md) | Full repo survey |
| [`tracks/sprint1-pivot-decision.md`](tracks/sprint1-pivot-decision.md) | The decision to move to a unified Next.js stack |

Track 1's integration guide — schema, ledger, API routes — lives with the code
at [`frontend/prisma/README.md`](../frontend/prisma/README.md).

---

## The ideas these docs keep coming back to

Four things recur, because they're what separate this from a loan-comparison
table:

**The cheapest offer is frequently not the best offer.** A 11.0% offer at an 80%
advance rate with a flat fee delivers less cash, later, and at a *higher*
effective cost than a 13.5% offer at 95% with no fee. Sorting on headline rate
gives the wrong answer confidently. ([§3](01-commerce-analysis.md))

**Supplier need is derived, not asked.** Nobody can honestly self-report that
they value settlement speed at 0.3. The platform reads dated cash obligations
and computes a sufficiency floor and a timing deadline — which act as
lexicographic *gates*, not weights, so a cheap slow offer can never outrank one
that actually makes payroll. ([§4](01-commerce-analysis.md))

**No language model computes a financial figure.** Agents choose posture;
deterministic functions produce every rupee, and every call is recorded. What
this protects is priced capital and a settlement obligation.
([`00-brief.md`](00-brief.md))

**Say plainly what is simulated.** The capital market is synthetic and labelled
as one. Competitive invoice discounting is regulated in India and licensed TReDS
platforms already run multi-financier bidding; we don't claim to have invented
it. ([§10–11](01-commerce-analysis.md))

---

## A note on these documents

Several were written before the build and describe intentions that later
changed — most visibly, the project moved from a Python FastAPI backend to a
unified Next.js stack partway through
([`tracks/sprint1-pivot-decision.md`](tracks/sprint1-pivot-decision.md)).
Superseded reasoning has been left in place rather than quietly edited out, so
the decision trail stays readable. Where a doc and the code disagree, the code
is current; the root [README](../README.md) states what is actually working
today.
