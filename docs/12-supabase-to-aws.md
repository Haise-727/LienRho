# Supabase → AWS migration guide

For whoever is standing up Aurora. Written so you can follow it without having
built the Supabase side, and so you can see which decisions are still open.

Companion to [`08-aws-migration-plan.md`](08-aws-migration-plan.md), which
covers the target architecture. This one covers **what we actually built on
Supabase and what each piece becomes on AWS.**

---

## Read this first: Supabase is four services, not one

This is the thing that derails the migration if it's discovered late.

"Move the database to Aurora" sounds like one job. It isn't, because we use
Supabase for four separate things and Aurora replaces exactly one of them:

| What we use | Supabase piece | Aurora replaces it? |
|---|---|---|
| Postgres — 15 tables, the ledger, the marketplace | Database | ✅ **yes** |
| Google OAuth sign-in | Auth (GoTrue) | ❌ **no** — needs its own answer |
| KYB document files (`VerificationDocument.storagePath`) | Storage | ❌ **no** — that's S3 |
| Connection pooling | Supavisor (port 6543) | ❌ **no** — that's RDS Proxy |

**Plan the auth migration before you start, not after the database is up.** If
Aurora lands and auth is still on Supabase, you are running a project purely to
issue JWTs — which works, but it's a surprise nobody agreed to, and it means
the "we migrated to AWS" claim is only three-quarters true.

---

## Part 1 — Database: Supabase Postgres → Aurora Serverless v2

The straightforward part. Prisma makes it close to a connection-string change.

### What exists today

| | |
|---|---|
| Project | `pxnqvhsftbcpimhhitjf`, region `ap-northeast-1` |
| Schema | 15 models, 13 enums — see [`09-database.md`](09-database.md) |
| Migrations | `prisma/migrations/` — `0_init` + `add_user_and_verification_document` |
| Seed | `prisma/seed.ts`, guarded by `SEED_FORCE` |
| Data | entirely synthetic. **Nothing needs migrating** |

**That last row is the gift here.** There is no production data to move — no
dump, no restore, no downtime window, no consistency problem. Aurora gets built
from migrations and reseeded from scratch.

### Steps

**1. Provision Aurora Serverless v2 (PostgreSQL 16)**, private subnets, no
public endpoint. Note both endpoints: the writer, and RDS Proxy if you add one.

**2. Point the two URLs at it.** Prisma needs both, and they are not
interchangeable:

```bash
DATABASE_URL="postgresql://<user>:<pw>@<proxy-or-writer>:5432/lienrho?schema=public"
DIRECT_URL="postgresql://<user>:<pw>@<writer>:5432/lienrho?schema=public"
```

On Supabase these differ by port (6543 pooled, 5432 direct) because Supavisor
runs in transaction mode and cannot execute DDL. On Aurora the same split
applies **only if you put RDS Proxy in front** — `DATABASE_URL` through the
proxy, `DIRECT_URL` straight at the writer, because DDL through a proxy in
transaction-pinning mode has the same problem. Without RDS Proxy, both point at
the writer and the split is harmless.

Drop `?pgbouncer=true&connection_limit=1` — those are Supavisor-specific.

**3. Build the schema:**

```bash
npx prisma migrate deploy    # NOT db push — see below
npx tsx prisma/seed.ts
```

`migrate deploy` is already verified against an empty database: it creates
every table and the seed then runs clean with the trial balance intact. **Do
not use `db push` in production** — it has no migration history, so there is no
record of what was applied or any way to roll forward reproducibly.

**4. Verify, in this order.** Each check catches a different class of failure:

```bash
curl $APP/api/db-health          # reachable + seeded
curl $APP/api/ledger/trial-balance   # 500 if the books don't balance
npm test                          # 32 tests
```

Then clear the worked example and confirm **Rapidfin wins with a ₹9,00,000
floor**. If the winner is Kaveri, the sufficiency gate isn't firing — the cash
position didn't seed, or `clearOpportunity` isn't receiving it.

### Watch for

**Decimal precision.** Money is `Decimal(18,2)`, rates `Decimal(9,6)`. Aurora
PostgreSQL honours these identically — but if anyone "simplifies" a column to
`double precision` during the move, the worked example turns on a 3-basis-point
gap and float drift is the same order of magnitude. The demo would still run
and quietly produce different numbers.

**`Int` paise ceiling.** `SupplierCashPosition` and `CashObligation` use `Int`
paise, which tops out at ~₹2.14 crore. Fine for working capital, and unchanged
by the move — but if it ever binds, the column becomes `BigInt` and Track 2's
`Paise` alias becomes `bigint` on the same commit.

**Transaction timeout.** `src/lib/ledger/post.ts` sets `timeout: 30_000`,
raised from Prisma's 5s default because the Tokyo round-trip made postings fail
intermittently. Aurora in the same region as the app will be much faster —
leave it as it is anyway. It costs nothing and the failure it prevents is
silent.

---

## Part 2 — Auth: the decision you have to make

Supabase Auth handles the Google OAuth exchange today. **Aurora does not
replace it.** Three options, and this is a real decision rather than a
formality:

### Option A — Keep Supabase Auth, move only the database

Least work. Supabase becomes an identity provider and nothing else.

- **Change:** none in the app. `NEXT_PUBLIC_SUPABASE_*` stay as they are.
- **Cost:** an external dependency in an otherwise-AWS deployment, and a
  cross-region hop to `ap-northeast-1` on every `getUser()` — which the proxy
  calls on **every navigation**.
- **Honest framing:** "database and compute on AWS, identity on Supabase."
  Fine, as long as it is said rather than glossed.

### Option B — AWS Cognito

The AWS-native answer.

- **Change:** replace `src/lib/supabase/server.ts` and `client.ts` with a
  Cognito client; rewrite `src/app/auth/callback/route.ts` to exchange the
  Cognito code. `src/lib/auth.ts` and the allowlist logic **survive unchanged**
  — that is the point of routing everything through `getCurrentUser()`.
- **Also:** re-register the OAuth client in Google Cloud Console with Cognito's
  callback (`https://<domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`).
- **Cost:** a day of work, and Cognito's developer experience is worse than
  Supabase's. Budget for that rather than being surprised by it.

### Option C — Auth.js (NextAuth) talking to Google directly

Cuts out the middle service entirely.

- **Change:** same shape as B, but Auth.js stores sessions in **our own
  Postgres** — so identity data lands in Aurora alongside everything else, and
  `User` gains the session tables Auth.js needs.
- **Cost:** we own session storage and refresh, which Supabase and Cognito
  handle for us.

**Recommendation: A for the hackathon, B or C if this becomes real.** A is
zero work and honest if stated. Do not start B on the clock — an auth rewrite
on demo day is how you lose a working sign-in.

### What survives regardless

The design deliberately confines provider-specific code to two files:

```
src/lib/supabase/server.ts   ← provider-specific
src/lib/supabase/client.ts   ← provider-specific
src/lib/auth.ts              ← PROVIDER-AGNOSTIC. getCurrentUser(), requireUser()
src/app/auth/callback/route.ts  ← thin: exchange code, check allowlist
```

Whatever you choose, `getCurrentUser()` keeps its contract: verify identity,
look up `User` by email, return the org — or null. **The allowlist model is not
Supabase-specific and does not need revisiting.**

### Two properties not to lose in the rewrite

**1. Verify, don't trust.** We call `getUser()`, never `getSession()`.
`getSession()` returns whatever is in the cookie *without validating it*, so a
forged cookie walks straight past. Cognito's equivalent is verifying the JWT
against the JWKS endpoint — not merely decoding it. **Decoding is not
verifying**, and the difference is the entire security property.

**2. Allowlist, not self-registration.** A verified Google identity with no
`User` row is signed straight back out. Without that, anyone with a Gmail
account can act as a bank on a capital marketplace. Whatever provider you move
to, the callback must keep this check.

---

## Part 3 — Documents: Supabase Storage → S3

`VerificationDocument.storagePath` holds an object path, deliberately — the
file never enters Postgres, because a scanned PDF in a row makes every query
touching that table expensive.

Nothing reads it yet (#26 is unbuilt), so **this is the cheapest thing to move
and the best time to move it.**

- Bucket, **private**, SSE-KMS, no public access.
- App gets presigned URLs; the browser never receives credentials.
- `storagePath` stays an opaque string — the column does not change, only what
  writes and reads it.
- IAM: the Fargate task role gets `s3:GetObject` / `s3:PutObject` on that
  bucket **and nothing else**.

---

## Part 4 — Redis and secrets

**Redis → ElastiCache.** `docker-compose.yml` provides it locally. Nothing in
the codebase connects to Redis yet — `EscrowLock` exists as a table with the
right unique constraint but nothing writes to it. So this is provisioning
ahead of the code, not a migration. Security group must allow 6379 **from the
Fargate task security group only**, not from the VPC generally.

**Secrets → Secrets Manager.** Everything currently in `frontend/.env`:

| Secret | Notes |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Aurora credentials — rotate via Secrets Manager |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable, but keep it out of the image |
| Google client ID/secret | **not in the repo today** — they live in the Supabase dashboard. If you move to Cognito they move to Secrets Manager |

> ⚠️ **Rotate before any deployment.** The current database password and the
> Google client secret were shared in plain text during the sprint. Neither is
> in the repository, but both are in chat history. Reset both — Supabase
> Settings → Database → Reset password, and Google Cloud Console → Credentials
> → Reset secret. Do this before anything is publicly reachable, not after.

---

## Part 5 — The blocker that is not infrastructure

**No API route performs an authorization check.** Not one.

`/api/opportunities`, `/api/match`, `/api/ledger/*`, `/api/providers` — none of
them reads the session or resolves a caller to an org. The proxy gates *page
navigation* only, and it explicitly excludes `/api/*` (correctly — redirecting
a fetch to an HTML login page turns "session expired" into a parse error).

Today that is contained: everything is local and the data is synthetic. **The
moment this sits behind a public ALB, the entire ledger and every bid is
world-readable to anyone who can reach the load balancer.**

This is a prerequisite for Part 1, not a follow-up to it. The fix is small
because the plumbing exists:

```ts
import { requireUser } from "@/lib/auth";

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;          // 401
  // ...then scope every query by user.org.id
}
```

`requireUser()` is written and unused. Roughly ten lines per route, plus
scoping the queries by `orgId` — which is also what makes the "a provider must
never see another provider's bids" rule real rather than aspirational. It is
currently invariant #7 in [`09-database.md`](09-database.md), enforced by
"code review", which is not enforcement.

**Related, same fix:** the proxy validates that a session is *valid*, not that
the user is still on the allowlist — so removing a `User` row does not end an
existing session until the token expires. Ordinary JWT behaviour, documented in
`src/proxy.ts`, and worth knowing before someone assumes removal is instant.

---

## Order of work

Deliberately not the order the AWS plan implies — auth decision first, because
it changes what you build.

| # | Step | Why here |
|---|---|---|
| 1 | **Decide the auth option** (A/B/C above) | Changes what you provision. Deciding late means rework |
| 2 | **Rotate the shared credentials** | Before anything is reachable |
| 3 | Provision Aurora, private subnets | |
| 4 | `migrate deploy` + seed, verify the worked example | Proves the data layer before compute is involved |
| 5 | **Add `requireUser()` to every API route** | The one true blocker for a public deployment |
| 6 | S3 bucket for documents | Cheap now, nothing reads it yet |
| 7 | ElastiCache | Provisioning ahead of code |
| 8 | Fargate + ALB | Last, once there is something safe to expose |

---

## Rollback

Worth having, and cheap here: keep the Supabase project alive until Aurora has
run the full verification. Because there is no production data, rollback is
**changing two environment variables back**. No dump, no restore, no data loss.

Do not delete the Supabase project the same day you cut over — the demo
database is the only place the seeded market exists in a known-good state.
