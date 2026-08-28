# Demo script

Roughly four minutes. Everything shown is read live from the database.

**Before you start:** `cd frontend && npm run dev`. Confirm
`localhost:3000/api/db-health` says `"status": "ok"` and `"ledgerBalanced": true`.

---

## 1. The problem (20s, no screen)

> A supplier has a ₹10L invoice their buyer has already accepted. Payment is in
> 45 days. Payroll is Friday. Today they call one bank and take whatever that
> bank offers.

---

## 2. The market (40s) — `/dashboard/supplier`

Real invoices, real buyers, live from Postgres. Open the ₹10,00,000 one.

> Four providers bid: a bank, an NBFC, a fintech, a credit fund. Different cost
> of funds, different appetite, different settlement speed. They are competing,
> not queuing.

---

## 3. The derived need (30s) — the constraints card

> This is the part nobody else does. We did not ask this supplier how urgent
> they are. We read their cash position — what is in the bank, what is owed and
> when. **₹9,00,000 by Friday, driven by September payroll.** Derived, not
> entered.

---

## 4. The auction — the moment (90s) — `/auction`

Let all offers render.

> Meridian quotes **11.0%**. Rapidfin quotes **13.5%**. Every comparison site
> ranks Meridian first.
>
> Meridian's true cost is **13.76%**. Rapidfin's is **13.73%**. The cheap one is
> dearer — the fee is flat, and you pay for the money you actually received, not
> the money notionally advanced.

Then point at Kaveri.

> Kaveri is **the cheapest offer in this market at 13.34%** — and it is
> disqualified. It delivers ₹8.66L when ₹9L is needed, and lands a day late.
>
> A weighted score ranks it first. We gate it out, and the screen says exactly
> why.

Read the gate reason from the screen verbatim. **This is the moment. Do not
rush it.**

---

## 5. It clears (30s) — `/settlement`

> Financing is not complete because an offer was accepted. The provider
> advances, a reserve is held, the buyer pays, the provider is repaid, and only
> then does the reserve release. Every movement is a balanced journal entry.

---

## 6. Not one lucky invoice (40s)

> Fair question: did we build the one case where our idea wins?
>
> We ran 5000 invoices through it. **The gates changed the winner in 13.5% of
> deals. The cheapest offer was disqualified 37.9% of the time. And in 24.4% the
> right answer was: do not finance this at all.**
>
> One deal in eight goes to a different lender than price-ranking would pick.

If there is a terminal: `npx tsx scripts/corpus/analyse.ts`.

---

## Answers to the questions you will get

**"Is the data real?"**
> The invoices are synthetic and we say so. What is real is the pipeline — they
> are generated as Tally XML and parsed by our actual Tally connector, so a real
> export drops in unchanged. We tried real Tally files; the format is
> undocumented binary you cannot read without Tally itself.

**"What does the AI actually do?"**
> A model chooses posture — aggressive, conservative, decline. Every rupee and
> every rate is computed by a named deterministic function. No language model
> produces a financial figure anywhere in this system. That is deliberate: the
> audit trail is the product, and "the model said so" is not an audit trail.

**"What if two deals hit the same provider at once?"**
> Capacity is re-read at clearing time, and the decrement is a conditional
> update — the check and the write are one atomic statement, so two deals cannot
> both draw the same rupees. Honestly: we have not tested it under real
> concurrent load.

**"What is not built?"**
> Providers do not price dynamically — they bid fixed archetype terms. There is
> no learning loop yet; the reliability column exists and nothing writes to it.
> And the lender-side dashboard is not wired to live agent decisions.

Answer that last one straight. Knowing your own edges reads as competence.

---

## Do not

- Do not open the **lender live deal stream** — it displays an invented agent bid
- Do not claim providers price per-invoice
- Do not say "the system learns"
- Do not promise the deployed URL unless it is confirmed up
