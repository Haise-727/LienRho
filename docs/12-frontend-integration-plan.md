# Minimal frontend–backend integration plan

Issue #22. Goal: **a real clearing result visible in the browser, on `dev`,
today.** Minimal and correct rather than complete — others improve it after.

---

## The problem, precisely

Issue #22 is written as "wire `api-client.ts` into UI state". That assumes
Track 4's branch is the baseline. It is not merged, so on `dev` the situation is
different and worse:

**There is no marketplace UI on `dev` at all.**

`frontend/src/app/` still contains the *previous product* — a receivables
collections tool. The homepage is an action queue asking "What should we do
today?". `src/lib/api.ts` fetches from `http://localhost:8000`, the retired
FastAPI service, calling `/api/action-queue`, `/api/summary` and `/api/forecast`
— none of which exist in the marketplace API.

So running the app today shows a dead page belonging to a different product,
while a fully working marketplace API sits unused beside it.

| | State |
|---|---|
| Marketplace API | live, verified end to end against Supabase |
| Marketplace UI on `dev` | **does not exist** |
| Marketplace UI on PR #21 | 40%, unmerged, computes its own (incorrect) numbers |

Waiting for PR #21 blocks everything. Merging it early imports the wrong
arithmetic. So: build a thin slice that does not collide with it.

---

## The approach

One server-rendered page that runs the real chain end to end:

```
Postgres → cash-position derivation → gates → ranking → rendered explanation
```

No client state library, no loading choreography, no mock fallbacks, no new
dependencies. Server components fetch and render; if the data is not there, the
page says so rather than substituting fiction.

### Two decisions that matter

**1. Route at `/market`, not `/`.**

PR #21 rewrites `src/app/page.tsx` (471 lines changed). Editing it guarantees a
conflict with work already in flight. `src/app/market/` is untouched by that
branch, so both can land independently and whoever merges decides later what `/`
becomes.

**2. One shared server function for load-and-clear.**

`/api/match` queries `FinancingOpportunity` with a `cashPosition` join. Omitting
that join is precisely what caused `9c96ef8` — `sufficiencyFloor` and
`timingDeadline` are null in the database by design, so without the join
`clearOpportunity` falls back to nulls, returns `unconstrained`, and **silently
degrades to cost-only ranking with no error**.

If the page writes its own query, that bug returns immediately. So the query and
the clearing call live in one function that both the route and the page use.

---

## Steps

### 1. `frontend/src/lib/market/server.ts` — the shared loader

```ts
export async function clearById(
  opportunityId: string,
  urgencyNudgeBps = 0,
): Promise<MatchResult | null>
```

Owns the Prisma query — **including the `cashPosition` join and its ordered
obligations** — maps Decimals to the adapter's expected shape, and calls
`clearOpportunity`. Returns `null` when the opportunity does not exist.

Also `listOpportunities()` for the index page.

This is the only place the clearing query is written.

### 2. Refactor `/api/match` to use it

The route keeps request parsing, the agent-bids path, the legacy compatibility
shim and error handling. Its stored-bids path becomes a call to `clearById`.

Behaviour must not change — the route is already verified end to end, so this is
a pure extraction. Re-run the demo script afterwards to confirm.

### 3. `frontend/src/app/market/page.tsx` — index

Server component. Lists opportunities: supplier, buyer, invoice number, face
value, tenor, verification tier, status. Each links to its detail page.

### 4. `frontend/src/app/market/[id]/page.tsx` — the result

Server component. This is the page that proves the system works. Three blocks:

**The invoice.** Supplier, buyer, face value, tenor, verification tier.

**What the supplier needs.** The derived floor and deadline, and the obligation
that drove them — "₹9,00,000 by 30 August, driven by September payroll". This
block is the differentiator made visible: the numbers were *derived from cash
facts*, not entered.

**The offers.** Every bid, winner first, disqualified ones kept and dimmed:

| Provider | Cash to supplier | True cost | Lands | Status |
|---|---|---|---|---|

Disqualified rows show `gates.sufficiency.reason` / `gates.timing.reason`
verbatim — they are written to be rendered.

When `status === 'NO_ACCEPTABLE_OFFER'`, show `reason` prominently. That is a
result, not an error state, and it should not look like a failure.

### 5. Make the app reachable

`/` currently server-fetches `localhost:8000` and throws when nothing is
listening. Rather than editing `page.tsx` (conflict), add a link to `/market`
in the shell nav, and confirm `/market` renders with the legacy backend down.

---

## Rules for this work

- **The page performs no financial arithmetic.** Every figure comes from
  `ScoredOffer` already computed. If something is missing, add it to the
  engine — do not compute it in a component. Two implementations is how the
  screen and the audit trail end up disagreeing, and it has already happened.
- **No mock fallback.** If the database is unreachable the page says so. A
  demo that silently shows fiction when the connection drops is worse than one
  that fails visibly.
- **Formatting comes from `lib/market/money.ts`** — `formatPaise`,
  `formatBps`.
- Styling stays deliberately plain. Track 4 owns the visual design; this slice
  owns correctness. It should be easy to restyle and easy to delete.

---

## Definition of done

- `/market` lists real opportunities from Supabase.
- `/market/[id]` shows the derived need and every scored offer with reasons.
- The worked-example opportunity reproduces: Rapidfin wins, Meridian and Kaveri
  disqualified with readable explanations, Kaveri visibly cheapest and still
  excluded.
- `npx tsc --noEmit`, `npm test`, `npm run build` all pass.
- No conflict with PR #21.

---

## What this does not do

Deliberately out of scope, to keep the slice thin:

- Role switching, auth, provider-side views — Track 4's plan covers these.
- The urgency slider (#18) — the API accepts `urgencyNudgeBps`; nothing sends it
  yet, and that decision is still open.
- Styling beyond legibility.
- Replacing `/` or removing the legacy pages. Once the marketplace UI is real,
  deleting the collections frontend is a separate, easy commit.
