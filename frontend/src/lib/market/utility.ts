/**
 * Supplier utility derivation — docs/01-commerce-analysis.md §4.
 *
 * The question this answers: *what does this supplier actually need right now?*
 *
 * The naive answers are both bad. Fixed weights are wrong for everyone, because
 * urgency varies week to week. Asking the supplier to state their weights is
 * worse — nobody can honestly say they value settlement speed at 0.3, so
 * elicited weights are noise dressed as data.
 *
 * So we read it off the cash position instead. If the supplier cannot cover an
 * obligation on some date, then:
 *
 *   - **sufficiency floor** = the shortfall on that date
 *   - **timing deadline**   = that date
 *
 * Both are GATES, not weights. An offer that delivers less than the floor is not
 * "worse" — it is disqualified, because it does not solve the problem. Same for
 * an offer that lands after the deadline. That distinction is the entire reason
 * this module exists rather than a scoring weight vector.
 */

import { daysBetween } from './money';
import type { IsoDate, Paise, SupplierCashPosition, SupplierUtility } from './types';

/**
 * Derive the gates from the supplier's cash position.
 *
 * Walks obligations in date order, running the cash balance down, and stops at
 * the first date the balance falls below the threshold. First breach only: that
 * is the deadline the supplier is actually up against, and financing decisions
 * are made against the nearest cliff, not the worst one.
 *
 * The threshold matters — a business does not aim for zero, it aims to stay
 * above a working buffer. Treating "shortfall" as "balance < 0" would let the
 * system declare everything fine right up until the account is empty.
 */
export function deriveSupplierUtility(
  position: SupplierCashPosition,
  asOf: IsoDate,
): SupplierUtility {
  const upcoming = position.obligations
    .filter((o) => daysBetween(asOf, o.dueDate) >= 0)
    // Ascending by date. Note the argument order: daysBetween(from, to) returns
    // to - from, so comparing (b, a) is what yields "a before b". Getting this
    // backwards processes obligations newest-first, which silently attributes
    // the shortfall to the wrong obligation and reports the wrong deadline.
    .sort((a, b) => daysBetween(b.dueDate, a.dueDate));

  let balance = position.currentCashPaise;

  for (const obligation of upcoming) {
    balance -= obligation.amountPaise;

    if (balance < position.cashThresholdPaise) {
      return {
        // How much cash must arrive to get back above the buffer. This is the
        // gap, not the obligation's full value — the supplier may already hold
        // most of what it needs.
        sufficiencyFloorPaise: position.cashThresholdPaise - balance,
        timingDeadline: obligation.dueDate,
        drivingObligation: obligation.label,
        unconstrained: false,
      };
    }
  }

  // No projected breach. Financing is optional here, so nothing is disqualified
  // on sufficiency or timing and cost alone decides.
  return {
    sufficiencyFloorPaise: 0,
    timingDeadline: farFuture(asOf),
    drivingObligation: null,
    unconstrained: true,
  };
}

/**
 * Build utility from gates already stored on the opportunity.
 *
 * Track 1's schema carries `sufficiencyFloor` and `timingDeadline` directly on
 * `FinancingOpportunity`, without a cash-position model behind them (issue #7).
 * This adapts those stored values into the same shape the scorer consumes, so
 * the scoring path is identical whichever way the gates were produced.
 *
 * Keeping `deriveSupplierUtility` above as the real implementation matters even
 * while the values are seeded: it is the seam that makes the derivation claim
 * true later, and it means the honest version is already written rather than
 * being a promise.
 */
export function supplierUtilityFromStored(
  sufficiencyFloorPaise: Paise | null,
  timingDeadline: IsoDate | null,
  asOf: IsoDate,
): SupplierUtility {
  // Absent gates mean no known constraint — cost-only ranking, nothing gated
  // out. Defaulting to a floor of 0 rather than rejecting is deliberate: a
  // missing constraint must not silently disqualify every offer.
  if (sufficiencyFloorPaise === null && timingDeadline === null) {
    return {
      sufficiencyFloorPaise: 0,
      timingDeadline: farFuture(asOf),
      drivingObligation: null,
      unconstrained: true,
    };
  }

  return {
    sufficiencyFloorPaise: sufficiencyFloorPaise ?? 0,
    timingDeadline: timingDeadline ?? farFuture(asOf),
    drivingObligation: null,
    unconstrained: false,
  };
}

/**
 * A deadline far enough out that the timing gate cannot bind.
 *
 * A sentinel rather than `null` so the gate has one code path instead of two,
 * and so the UI always has a date to render. One year is well beyond any tenor
 * the market accepts (`OfferSchema` caps tenor at 365 days).
 */
function farFuture(asOf: IsoDate): IsoDate {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
