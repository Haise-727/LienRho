# Brief — what changed and what it means

## The old problem vs. the new one

| | Previous product | PS-5 |
|---|---|---|
| **Who it serves** | One supplier (an MSME) | A **two-sided market**: suppliers *and* capital providers |
| **Core question** | "Which invoice do I chase, finance, or escalate today?" | "Which capital should fund this invoice, on what terms, and why is that the best outcome?" |
| **Financing** | One mocked path (TReDS), a single simulated quote | **Multiple providers competing**, differentiated offers, the whole point |
| **Decision** | Pick one of three collection tracks | Multi-attribute allocation under two-sided constraints |
| **Human role** | Approval gate on everything sensitive — central to the architecture | **Minimised** by the annexure; humans handle exceptions and disputes only |
| **Success looks like** | Fewer days sales outstanding | Better price discovery and efficient capital allocation |

The previous product was a **collections** tool with financing as one option
among three. PS-5 is a **capital markets** problem where financing is the
entire surface, and collections is out of scope.

That distinction drives nearly everything in
[`02-carryover-audit.md`](02-carryover-audit.md).

## The thesis, in one sentence

> The cheapest offer is frequently not the best offer, and a marketplace that
> ranks on headline rate quietly destroys value for suppliers — so the system's
> job is to compute what each offer is *actually worth to this supplier right
> now* and allocate accordingly.

PS-5 states this directly ("the most attractive financing option for a supplier
may not be the offer with the lowest interest rate", requirement 4). It is the
one requirement that separates a real answer from a loan-comparison table, and
it should be the spine of the build and the demo.

## Why this is genuinely hard

Four things make it more than a sorting exercise:

1. **Supplier utility is situational.** A supplier with payroll on Friday values
   settlement speed almost without limit. The same supplier next month, flush,
   values only cost. Any fixed weighting is wrong for someone.
2. **The offer space is not one-dimensional.** Rate, advance rate, fees, tenor,
   settlement speed, recourse, and repayment structure trade off against each
   other, and a genuine market produces offers where none dominates the others.
3. **Both sides are constrained.** Providers have liquidity, risk appetite,
   concentration limits, and hurdle rates. Matching is a constrained allocation
   problem, not a per-invoice sort.
4. **Information is asymmetric and incomplete.** Verification quality varies,
   buyer behaviour is uncertain, and the platform's own risk estimates are
   themselves a market input — a miscalibrated score mis-prices real capital.

## What "agentic" has to mean here

The annexure asks for minimal human intervention across discovery,
participation, verification, and settlement. That points at a **multi-agent
market**, not one assistant:

- an agent per capital provider, evaluating and pricing within its own mandate
- an agent acting for the supplier, inferring what they actually need
- a clearing agent running the auction and allocating

This is a much better fit for "agentic marketplace" than the previous build's
two advisory agents, and it is the strongest reason the pivot is worth making
rather than resisting.

## The one principle that must survive unchanged

**No language model computes a financial figure.** Rates, advance amounts,
discount charges, fees, effective cost, expected loss — all of it comes from
deterministic functions, and every call is recorded and inspectable.

In the old product this protected a legal filing. Here it protects **priced
capital and a settlement obligation**, which is a higher bar, not a lower one.
The existing tool-boundary pattern carries over wholesale and becomes more
load-bearing, not less.

## Scale of the change, honestly

We are migrating fully to a Next.js Full-Stack architecture with Prisma and Redis. All legacy Python/FastAPI collections code is being removed to focus 100% on the multi-agent capital marketplace for the 2-hour MVP.
model, risk model, agent scaffolding, audit trail, auth, connector,
infrastructure). Roughly forty percent is dead on arrival because it encodes
collections logic. The remainder — everything provider-side, the auction, the
scoring, settlement, and the learning loop — is new construction.

Treating this as "a new product on a proven foundation" sets accurate
expectations. Treating it as "a pivot" invites the assumption that most of the
work is already done, which is not true.
