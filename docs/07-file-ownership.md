# File ownership — who works where

Four people building in parallel on a short clock. This map exists so two of us
don't edit the same file at once, and so anyone can tell at a glance whether a
change belongs to them.

It reflects **what each track is actually touching**, taken from the live
branches, not a guess made up front.

---

## The map

| Track | Owns | Branch |
|---|---|---|
| **1 — Data & Ledger** | `frontend/prisma/**`, `frontend/prisma.config.ts`, `frontend/.env.example`, seed scripts | `feat/track-1-prisma-stitch-ledger` |
| **2 — Matching engine** | `frontend/src/lib/market/**`, `frontend/src/app/api/match/**` | works on `dev` |
| **3 — Agents & voice** | `ai/**`, `backend/**`, `frontend/src/app/api/voice/**`, `docs/03b-*` | `track3/nexus-agents` |
| **4 — UI** | `frontend/src/components/**`, `frontend/src/app/**` *(pages, not `api/match` or `api/voice`)*, Tailwind/theme config | not started |

**Shared, coordinate before editing:** `frontend/package.json`,
`frontend/package-lock.json`, `docker-compose.yml`, everything in `docs/`
except a track's own architecture note.

---

## Rules

1. **Edit inside your own row.** If a change you need sits in someone else's
   row, ask them — or open an issue against their track. Do not reach in.
2. **The type contract is shared and single-source.**
   `frontend/src/lib/market/types.ts` is what all four tracks code against.
   Change it in one place and tell everyone; never keep a private copy of a
   shape that already exists there.
3. **Adapters live on the consumer side.** If your track needs another track's
   data in a different shape, write the conversion in *your* files rather than
   asking them to change theirs. Cheaper, and it doesn't block anyone.
4. **Say so when you overextend.** Sometimes reaching outside your row is the
   right call under time pressure. That's fine — but call it out in the commit
   body and in the issue, so nobody loses work to a surprise conflict.

---

## Overextensions currently live

Recorded rather than judged. Each of these is a defensible call under the
clock; they are listed because they are the places a merge conflict or a
wrong assumption will actually come from.

### Track 3 is building on the retired Python backend

`ai/**` plus edits to `backend/app/main.py`, `backend/conftest.py`, and
`backend/tests/**`.

`05-decisions-needed.md` §2 says the Python FastAPI stack is retired and all API
surface moves into Next.js. Track 3 is building Python agents against it anyway,
deliberately — their own note says a TS port "maps 1:1 to Zod", and they have a
`MatchingClient` ABC with an `HttpMatchingClient` seam ready for exactly that.

**Agreed disposition:** Track 3 builds isolated and integrates later, over HTTP,
through that seam. Nobody else should touch `backend/**` or `ai/**` meanwhile.

**Open risk:** the data contract across that seam does not currently line up —
see issue #9. The one that matters is that `LenderBid.fees_bps` is a *rate*
while `Bid.flatFee` and `Offer.feesPaise` are a *flat amount*, and the flatness
is load-bearing for the worked example. Resolve before integration, not during.

### Two docker-compose files

`docker-compose.yml` (repo root, Postgres + Redis) and
`backend/docker-compose.yml` (pre-existing). Both bind `5432`; running both
fails. The root one is the live one for the Next.js stack.

### `frontend/package.json` has three claimants

Track 1 added Prisma, Track 2 added Zod, Track 4 will add UI dependencies.
Nobody owns this file. Pull before installing, and expect to resolve
`package-lock.json` by re-running `npm install` rather than hand-merging it.

### Track 2 edited shared docs

`03-system-design.md` and `05-decisions-needed.md`, to repair text mangled by
the sponsor-alignment rewrite (see commits `1f78eeb`, `6be72c8`). Content
repair only — no decisions were changed.

---

## If you do hit a conflict

`dev` moves fast. Rebase rather than merge, so history stays readable:

```
git fetch origin
git rebase origin/dev
```

Then re-run your track's checks before pushing. For Track 2 that is:

```
cd frontend && npx tsc --noEmit
npx tsx --test src/lib/market/offer-math.test.ts
```
