/**
 * Marketplace type contract — the integration seam between all four tracks.
 *
 * This file deliberately has ZERO imports. It does not depend on Prisma, on the
 * database, or on any other track's code, so all four tracks can code against it
 * from minute one without waiting on each other:
 *
 *   - Track 1 (Prisma/DB)  mirrors these shapes in `schema.prisma` and seeds them.
 *   - Track 2 (this track) consumes Offer[] + Opportunity, produces ScoredOffer[].
 *   - Track 3 (agents)     emits `Offer` from LenderBiddingAgent; MarketClearingAgent
 *                          calls POST /api/match and reads MatchResult.
 *   - Track 4 (UI)         renders ScoredOffer[] — every field a deal card needs is
 *                          precomputed here, so the UI never does financial arithmetic.
 *
 * If a shape needs to change, change it HERE first and tell the other tracks.
 * Divergent private copies of these types is the single most likely way a
 * 2-hour parallel build ends up not integrating.
 */

// ---------------------------------------------------------------- primitives

/**
 * Money, in paise (1 rupee = 100 paise). ALWAYS an integer.
 *
 * Why not a float of rupees: the worked example in docs/01-commerce-analysis.md §3
 * turns on a 3-basis-point gap (13.76% vs 13.73%) between two offers. IEEE-754
 * drift on repeated multiply/divide is the same order of magnitude as the effect
 * we are trying to demonstrate, so a float would let rounding noise decide the
 * winner. Integer paise makes the arithmetic exact and the demo reproducible.
 *
 * This is a plain alias rather than a branded type on purpose: a brand would need
 * casts at every JSON boundary, which is friction four people can't absorb in a
 * 2-hour sprint. The discipline is carried by field NAMES instead — every money
 * field ends in `Paise`. If you see a bare number and it isn't named `...Paise`,
 * it isn't money.
 */
export type Paise = number;

/** Calendar date as `YYYY-MM-DD`. String, not Date, so it survives JSON intact. */
export type IsoDate = string;

/**
 * A rate as basis points (1 bp = 0.01%). 1250 bps = 12.50%.
 *
 * Integer bps for the same reason as Paise: `0.1105` is not exactly representable
 * and percentages get compared for ranking.
 *
 * One exception: DERIVED comparators (notably `ScoredOffer.effectiveCostBps`)
 * keep their fractional part. Rounding those to whole bps before ranking would
 * let two genuinely different offers tie at 1bp granularity and be ordered
 * arbitrarily. Round for display, never before comparing.
 */
export type Bps = number;

// ----------------------------------------------------------------- invoice

/**
 * Verification quality. Graded, never a boolean — see docs/01 §8.
 *
 * Providers price the difference between these tiers, so flattening them into
 * `verified: true` destroys the information that makes the market efficient.
 * Ordered weakest to strongest.
 */
export type VerificationTier =
  | 'SUPPLIER_ASSERTED' // claimed, unconfirmed — many providers decline outright
  | 'LEDGER_VERIFIED' // present and consistent in the books, delivery evidence
  | 'BUYER_ACCEPTED'; // buyer irrevocably acknowledged the debt — cheapest to fund

// ------------------------------------------------------------ capital provider

/**
 * A provider's private mandate.
 *
 * IMPORTANT (docs/01 §6): the scoring engine must NEVER read this. Scoring sees
 * only the Offer a provider produced, never the internals that produced it. If
 * the scorer could see `costOfFundsBps`, the "market" would be one function
 * talking to itself and any matching result would be circular.
 *
 * Track 3: your LenderBiddingAgent prices FROM these fields. Track 2 never
 * imports them outside of allocation-time constraint checks.
 */
export interface CapitalProvider {
  id: string;
  name: string;
  archetype: ProviderArchetype;

  /** What money costs this provider. Floor under any rate it can quote. */
  costOfFundsBps: Bps;
  /** Minimum risk-adjusted return it will accept, else it declines. */
  hurdleRateBps: Bps;

  /** Capital free to deploy right now. Decremented atomically on allocation. */
  availableLiquidityPaise: Paise;
  minTicketPaise: Paise;
  maxTicketPaise: Paise;

  /** Weakest verification tier this provider will touch at any price. */
  minVerificationTier: VerificationTier;
  maxTenorDays: number;
  /** How fast it can actually move money. 0 = T+0. */
  settlementDays: number;

  /** Exposure cap per buyer, as a share of total book (bps of 10000). */
  buyerConcentrationCapBps: Bps;
}

/**
 * Archetypes exist to guarantee a non-dominated offer set (docs/01 §6).
 * If every provider prices the same way, no offer is Pareto-optimal against
 * another and the whole comparison thesis has nothing to show.
 */
export type ProviderArchetype =
  | 'LARGE_BANK' // cheap, conservative, slow
  | 'NBFC' // middle of the market
  | 'FINTECH' // expensive, instant, small tickets
  | 'CREDIT_FUND' // yield-seeking, takes weak credits at a price
  | 'SECTOR_SPECIALIST'; // prices its own sector better than generalists

// ------------------------------------------------------------- opportunity

/**
 * An invoice presented to the market, plus the supplier context needed to judge
 * offers against it.
 */
export interface FinancingOpportunity {
  id: string;
  invoiceId: string;

  /** Face value of the invoice, `F` in the docs/01 §2 formulas. */
  faceValuePaise: Paise;
  /** Days until the buyer is expected to pay. `T` in the formulas. */
  tenorDays: number;
  dueDate: IsoDate;

  verificationTier: VerificationTier;
  buyerId: string;
  sector: string;

  /** Platform's probability-of-default estimate, bps. Providers price off this. */
  probabilityOfDefaultBps: Bps;

  /** The supplier's cash position — the raw input to utility derivation. */
  supplierCashPosition: SupplierCashPosition;
}

/**
 * Observable cash facts about the supplier.
 *
 * Track 1: seed THESE, not a pre-baked urgency number. The whole differentiator
 * (docs/01 §4) is that the platform *derives* what the supplier needs from their
 * cash position rather than asking them to self-report a weighting they cannot
 * honestly quantify. Handing the scorer an `urgency: 0.7` field would skip the
 * exact step that makes this project interesting.
 *
 * SIMULATED: in the full system these come from the 30-day probabilistic cash
 * forecast. Here they are seeded. Say so out loud in the demo.
 */
export interface SupplierCashPosition {
  currentCashPaise: Paise;
  /** Dated obligations over the horizon — payroll, suppliers, rent. */
  obligations: CashObligation[];
  /** Cash buffer the business will not go below. */
  cashThresholdPaise: Paise;
}

export interface CashObligation {
  label: string;
  amountPaise: Paise;
  dueDate: IsoDate;
}

/**
 * What the supplier actually needs, DERIVED from the cash position above.
 *
 * Structured lexicographically, not as weights (docs/01 §4): sufficiency and
 * timing are GATES, cost only ranks whatever survives them. A weighted sum would
 * let a cheap, slow offer that misses payroll outrank one that makes it — which
 * is precisely the failure PS-5 calls out.
 */
export interface SupplierUtility {
  /** Minimum net cash that actually solves the problem. Below this = disqualified. */
  sufficiencyFloorPaise: Paise;
  /** Date the cash must have landed by. After this = disqualified. */
  timingDeadline: IsoDate;
  /** Which obligation drove the floor — so the UI can explain the gate. */
  drivingObligation: string | null;
  /** True when the supplier has no projected shortfall (cost-only ranking). */
  unconstrained: boolean;
}

// ----------------------------------------------------------------- offers

/**
 * One provider's bid. This is the ONLY thing the scorer is allowed to see about
 * a provider (plus allocation-time capacity checks).
 *
 * Track 3: LenderBiddingAgent emits exactly this shape. Every number here must
 * come from a deterministic pricing function reading the provider's mandate —
 * never from an LLM. The LLM may choose posture (aggressive / conservative /
 * decline); it must not produce a rupee or a rate.
 */
export interface Offer {
  id: string;
  opportunityId: string;
  providerId: string;

  /** Share of face value paid upfront, bps. 8000 = 80%. */
  advanceRateBps: Bps;
  /** Annualised discount charge applied to the advance. The headline number. */
  annualRateBps: Bps;
  /** Flat fee. Regressive by nature — hurts small invoices hardest. */
  feesPaise: Paise;
  tenorDays: number;
  /** 0 = T+0, 1 = T+1, 3 = T+3. */
  settlementDays: number;

  recourse: 'WITH_RECOURSE' | 'NON_RECOURSE';
  expiresAt: IsoDate;
}

// ------------------------------------------------------------- scored offers

/** Why an offer failed a gate, or that it passed. */
export interface GateOutcome {
  passed: boolean;
  /** Human-readable explanation, safe to render directly in the UI. */
  reason: string;
}

/**
 * An offer with every derived figure precomputed.
 *
 * Track 4: render straight from this. Do NOT recompute money in the component —
 * if a number you need isn't here, ask for it to be added rather than deriving it
 * client-side. Two implementations of the same formula is how the screen and the
 * audit trail end up disagreeing.
 */
export interface ScoredOffer {
  offer: Offer;
  providerName: string;

  /** advanceRate x faceValue */
  advancePaise: Paise;
  /** advance x annualRate x tenor/365 */
  discountChargePaise: Paise;
  /** advance - discountCharge - fees. What actually lands in the bank. */
  netCashPaise: Paise;
  /** (discountCharge + fees) / netCash x 365/tenor. The honest comparator. */
  effectiveCostBps: Bps;
  /** When the money lands, given settlementDays. */
  arrivalDate: IsoDate;

  /** Lexicographic gates, evaluated in this order. */
  gates: {
    sufficiency: GateOutcome;
    timing: GateOutcome;
  };
  /** True if either gate failed. Disqualified offers are NOT ranked. */
  disqualified: boolean;
  /** 1-based rank among surviving offers by effective cost. Null if disqualified. */
  rank: number | null;
  /**
   * Id of an offer that beats this one on cash, cost AND speed simultaneously,
   * or null when this offer is on the non-dominated frontier.
   *
   * Purely informational — dominance never decides the winner, the gates do.
   * The UI can collapse dominated offers as noise, since an option that is
   * worse in every respect than another is not a choice a person needs to make.
   */
  dominatedBy: string | null;
}

// ------------------------------------------------------------------ matching

/**
 * Result of clearing one opportunity.
 *
 * `NO_ACCEPTABLE_OFFER` is a first-class outcome, not an error (docs/01 §7): if
 * nothing clears the supplier's floor, the correct answer is "do not finance",
 * not "here is the least bad option". A market that always transacts is not
 * exercising judgement.
 */
export type MatchResult =
  | {
      status: 'MATCHED';
      opportunityId: string;
      allocations: Allocation[];
      scoredOffers: ScoredOffer[];
      utility: SupplierUtility;
      market: MarketHealth;
      /** How the advance was funded, in words. Set when allocation ran. */
      allocationNote?: string;
      /** Paise of the advance that could not be funded. 0 when fully covered. */
      shortfallPaise?: Paise;
    }
  | {
      status: 'NO_ACCEPTABLE_OFFER';
      opportunityId: string;
      /** Every offer, with its failing gate — the UI explains why nothing cleared. */
      scoredOffers: ScoredOffer[];
      utility: SupplierUtility;
      reason: string;
      market: MarketHealth;
    };

/**
 * Whether the offer set itself looks like a real market.
 *
 * Separate from the clearing outcome on purpose: a degenerate bid set still
 * clears, and refusing to would be worse than clearing with the problem
 * recorded. What matters is that it stops being invisible.
 */
export interface MarketHealth {
  /** Offer ids on the non-dominated frontier — the ones worth comparing. */
  frontier: string[];
  /**
   * Set when one offer beats every other on every axis, which indicates the
   * bids were generated wrongly rather than that one provider is better.
   */
  degeneracyWarning: string | null;
}

/**
 * One provider's share of a filled opportunity. A list of length > 1 means the
 * fill was syndicated because no single provider had the headroom (docs/01 §7).
 */
export interface Allocation {
  offerId: string;
  providerId: string;
  providerName: string;
  /** Portion of the advance this provider funds. */
  fundedPaise: Paise;
  /** Provider's liquidity AFTER this allocation — the constraint snapshot. */
  providerLiquidityAfterPaise: Paise;
}

// ------------------------------------------------------------- api contract

/** POST /api/match request body. */
export interface MatchRequest {
  opportunityId: string;
  /**
   * Optional supplier nudge on the cost/urgency axis, bps (0 = pure cost,
   * 10000 = pure urgency).
   *
   * Track 4: this is a NUDGE on an already-derived position, never the sole
   * input. Ship the slider pre-positioned at the derived value and let the
   * supplier disagree with it. A slider with no default is just the
   * self-reported-weights problem wearing a different widget (docs/01 §4).
   */
  urgencyNudgeBps?: Bps;
}

/** POST /api/match response body. */
export type MatchResponse = MatchResult;
