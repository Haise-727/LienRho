/**
 * Allocation — turning a ranking into a funded deal.
 *
 * Ranking says who *should* win. Allocation asks whether they still *can*, and
 * those are genuinely different questions: a provider's position moves between
 * bidding and clearing. They may have funded another opportunity, hit a
 * concentration cap on this buyer, or simply not have the headroom for a ticket
 * this size.
 *
 * So constraints are re-checked here against a fresh read, never trusted from
 * bid time. `03-system-design.md` Module 8.
 *
 * When no single provider can carry the whole advance, the fill is **split**
 * across providers in ranked order rather than abandoned. A supplier who needs
 * ₹9L does not care whether it arrives from one lender or three; refusing to
 * syndicate would turn a fundable deal into `NO_ACCEPTABLE_OFFER` for a reason
 * that has nothing to do with the supplier.
 *
 * Pure and deterministic. The caller supplies provider capacity as it read it;
 * this module does no I/O, so the atomic transaction that makes the read-check-
 * write safe lives in the caller, where the database handle is.
 */

import type { Allocation, Paise, ScoredOffer } from './types';

/** A provider's capacity, read fresh at allocation time. */
export interface ProviderCapacity {
  providerId: string;
  /** Free capital right now. */
  availableLiquidityPaise: Paise;
  minTicketPaise: Paise;
  maxTicketPaise: Paise;
  /**
   * Remaining headroom for this opportunity's buyer, in paise.
   *
   * Concentration is per-buyer, not per-opportunity: a provider already heavily
   * exposed to Bharat Auto should not take more Bharat Auto paper regardless of
   * which supplier is presenting it.
   */
  buyerHeadroomPaise: Paise;
}

/** Why a provider could not take part or all of a fill. */
export type SkipReason =
  | 'NO_LIQUIDITY'
  | 'BELOW_MIN_TICKET'
  | 'BUYER_CONCENTRATION'
  | 'NO_CAPACITY_RECORD';

export interface AllocationOutcome {
  allocations: Allocation[];
  /** Paise still unfunded. Zero means the advance was fully covered. */
  shortfallPaise: Paise;
  /** Providers that ranked but could not participate, and why. */
  skipped: { providerId: string; providerName: string; reason: SkipReason }[];
  /** True when more than one provider funded the deal. */
  syndicated: boolean;
}

/**
 * How much of `remaining` this provider can actually take.
 *
 * Capped by liquidity, by their maximum ticket, and by buyer concentration
 * headroom — whichever binds first.
 */
function capacityFor(capacity: ProviderCapacity, remaining: Paise): Paise {
  return Math.min(
    remaining,
    capacity.availableLiquidityPaise,
    capacity.maxTicketPaise,
    capacity.buyerHeadroomPaise,
  );
}

/**
 * Allocate an advance across ranked, gate-passing offers.
 *
 * `survivors` must already be ranked — allocation walks them in order and does
 * not re-rank. That separation is deliberate: ranking is about what is best for
 * the supplier, allocation is about what is possible for the providers, and
 * letting capacity influence the ordering would quietly let a provider's
 * balance sheet decide what counts as a good offer.
 */
export function allocate({
  survivors,
  targetPaise,
  capacities,
}: {
  survivors: ScoredOffer[];
  /** The advance to fund — normally the winning offer's advance. */
  targetPaise: Paise;
  capacities: Record<string, ProviderCapacity>;
}): AllocationOutcome {
  const allocations: Allocation[] = [];
  const skipped: AllocationOutcome['skipped'] = [];
  let remaining = targetPaise;

  for (const offer of survivors) {
    if (remaining <= 0) break;

    const capacity = capacities[offer.offer.providerId];
    if (!capacity) {
      skipped.push({
        providerId: offer.offer.providerId,
        providerName: offer.providerName,
        reason: 'NO_CAPACITY_RECORD',
      });
      continue;
    }

    if (capacity.availableLiquidityPaise <= 0) {
      skipped.push({ ...ident(offer), reason: 'NO_LIQUIDITY' });
      continue;
    }
    if (capacity.buyerHeadroomPaise <= 0) {
      skipped.push({ ...ident(offer), reason: 'BUYER_CONCENTRATION' });
      continue;
    }

    const take = capacityFor(capacity, remaining);

    // A provider that cannot meet its own minimum ticket takes nothing rather
    // than an undersized piece. Minimum tickets exist because small deals cost
    // more to administer than they earn, so honouring the constraint is the
    // point — quietly breaching it would make the simulation dishonest.
    if (take < capacity.minTicketPaise) {
      skipped.push({ ...ident(offer), reason: 'BELOW_MIN_TICKET' });
      continue;
    }

    allocations.push({
      offerId: offer.offer.id,
      providerId: offer.offer.providerId,
      providerName: offer.providerName,
      fundedPaise: take,
      providerLiquidityAfterPaise: capacity.availableLiquidityPaise - take,
    });
    remaining -= take;
  }

  return {
    allocations,
    shortfallPaise: Math.max(0, remaining),
    skipped,
    syndicated: allocations.length > 1,
  };
}

function ident(offer: ScoredOffer) {
  return { providerId: offer.offer.providerId, providerName: offer.providerName };
}

/**
 * Explain a partial or failed allocation in one line.
 *
 * A supplier told "not funded" deserves to know whether nobody wanted the deal
 * or whether the lenders who did want it had run out of room — only the second
 * is worth waiting a day for.
 */
export function explainAllocation(outcome: AllocationOutcome, targetPaise: Paise): string {
  if (outcome.shortfallPaise === 0) {
    return outcome.syndicated
      ? `Funded by ${outcome.allocations.length} providers together`
      : 'Funded in full by a single provider';
  }
  if (outcome.allocations.length === 0) {
    return 'No provider that cleared the gates had capacity to fund this';
  }
  const pct = Math.round(((targetPaise - outcome.shortfallPaise) / targetPaise) * 100);
  return `Only ${pct}% could be funded — the remaining providers lacked capacity`;
}
