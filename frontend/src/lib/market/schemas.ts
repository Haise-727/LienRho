/**
 * Runtime validation at the two boundaries where data arrives untrusted.
 *
 * Scope, deliberately narrow: this file does NOT restate the whole type contract
 * as Zod schemas. `types.ts` stays the canonical, dependency-free contract that
 * all four tracks code against — re-exporting everything as `z.infer` would
 * churn a shared file mid-sprint for no runtime benefit, since data that never
 * crosses a process boundary is already guaranteed by the compiler.
 *
 * Validation earns its place in exactly two places:
 *
 *   1. `MatchRequestSchema` — the POST /api/match body. Arrives as JSON from the
 *      UI and from Track 3's MarketClearingAgent. TypeScript types are erased at
 *      runtime, so without this a missing field reaches the money math as
 *      `undefined`, produces NaN, and renders as "₹NaN" three layers away from
 *      the actual cause.
 *
 *   2. `OfferSchema` — bids from Track 3's LenderBiddingAgent. This one is a
 *      stated project non-negotiable, not a preference: "structured, validated
 *      agent I/O only". An LLM in the loop is precisely the case where the shape
 *      cannot be assumed, and a malformed bid must be rejected at the edge
 *      rather than silently mispricing capital.
 *
 * The invariants below (integer paise, bps in range, ISO dates) are the runtime
 * half of the discipline that `types.ts` can only express in naming. A caller
 * passing rupees where paise are expected is a type-correct, catastrophically
 * wrong input, and this is the layer that catches it.
 */

import { z } from 'zod';

import type { MatchRequest, Offer } from './types';
import { BPS_SCALE } from './money';

// ------------------------------------------------------------- primitives

/**
 * Money must be a non-negative integer. The integer check is the important one:
 * a fractional "paise" means someone did float arithmetic upstream, and the
 * exactness the whole pricing model depends on has already been lost.
 */
const PaiseSchema = z
  .number()
  .int('money must be an integer count of paise, not fractional rupees')
  .nonnegative();

/** A rate in basis points, 0%–100%. Rates outside this range are input errors. */
const BpsSchema = z.number().int().min(0).max(BPS_SCALE);

/** `YYYY-MM-DD`. Rejects both malformed strings and impossible dates like 2026-02-30. */
const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'not a real calendar date');

// ------------------------------------------------------------------ offers

/**
 * A bid from a provider agent.
 *
 * `tenorDays` is capped at 365 because the effective-cost annualisation
 * (x 365/tenor) is only meaningful within a year; beyond that the figure stops
 * being comparable to the other offers it is ranked against.
 */
export const OfferSchema = z.object({
  id: z.string().min(1),
  opportunityId: z.string().min(1),
  providerId: z.string().min(1),

  advanceRateBps: BpsSchema,
  annualRateBps: BpsSchema,
  feesPaise: PaiseSchema,
  tenorDays: z.number().int().positive().max(365),
  settlementDays: z.number().int().nonnegative().max(30),

  recourse: z.enum(['WITH_RECOURSE', 'NON_RECOURSE']),
  expiresAt: IsoDateSchema,
});

/** Validate a batch of agent-produced bids, reporting which one failed. */
export const OfferBatchSchema = z.array(OfferSchema);

// ----------------------------------------------------------------- request

export const MatchRequestSchema = z.object({
  opportunityId: z.string().min(1),
  urgencyNudgeBps: BpsSchema.optional(),
});

// ------------------------------------------------------------ drift guards

/**
 * Compile-time assertions that the schemas above still match `types.ts`.
 *
 * Without these the two can silently diverge: someone adds a field to the
 * interface, the schema keeps validating the old shape, and Zod quietly strips
 * the new field at runtime. These lines cost nothing and fail the build the
 * moment that happens.
 */
/**
 * Note the shape: the constraint `Actual extends Expected` is what does the
 * work. A conditional type like `X extends Y ? true : never` would NOT fail the
 * build — `type T = never` is perfectly legal — so a guard written that way is
 * decorative. This one is a real compile error when the schema stops producing
 * something assignable to the interface.
 */
type AssertAssignable<Actual extends Expected, Expected> = Actual;

type _OfferMatches = AssertAssignable<z.infer<typeof OfferSchema>, Offer>;
type _RequestMatches = AssertAssignable<z.infer<typeof MatchRequestSchema>, MatchRequest>;

// Referenced so the compiler evaluates them and `noUnusedLocals` stays happy.
export type SchemaDriftGuards = [_OfferMatches, _RequestMatches];

// ------------------------------------------------------------------ helpers

/**
 * Parse untrusted input into a typed value, or return a readable error.
 *
 * Returns a result rather than throwing so API routes can answer 400 with a
 * message naming the offending field — a provider agent emitting a bad bid needs
 * to be told which field was wrong, not handed a 500.
 */
export function parseOrError<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { ok: true; value: T } | { ok: false; error: string } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };

  const error = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  return { ok: false, error };
}
