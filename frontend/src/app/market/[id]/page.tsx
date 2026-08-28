/**
 * /market/[id] — how one opportunity clears.
 *
 * This is the page that proves the system works, so it is worth being explicit
 * about what it does and does not do.
 *
 * **It performs no financial arithmetic.** Every figure rendered here comes
 * already computed on `ScoredOffer`, and the gate explanations are the engine's
 * own strings. That is not laziness — a second implementation in a component is
 * exactly how the screen and the audit trail end up disagreeing, and it has
 * already happened once in this repository. If a number is missing, add it to
 * the engine rather than deriving it here.
 *
 * Three blocks, in the order the decision is actually made:
 *   1. the invoice
 *   2. what the supplier needs — DERIVED, not entered
 *   3. every offer, winner first, losers kept and explained
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { clearById, loadOpportunityHeader } from '@/lib/market/server';
import { formatBps, formatPaise } from '@/lib/market/money';
import { decimalToPaise } from '@/lib/market/prisma-adapter';
import type { ScoredOffer } from '@/lib/market/types';

export const dynamic = 'force-dynamic';

export default async function ClearingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [opportunity, result] = await Promise.all([
    loadOpportunityHeader(id),
    clearById(id),
  ]);
  if (!opportunity || !result) notFound();

  const { utility, scoredOffers } = result;
  // Winner first, then the rest in their scored order. Disqualified offers are
  // kept deliberately: showing why an option lost is the whole point, and a
  // market that silently drops options is harder to trust than one that shows
  // its working.
  const ordered = [...scoredOffers].sort(
    (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/market" className="text-sm text-blue-700 underline underline-offset-2">
        ← All opportunities
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {opportunity.invoice.invoiceNumber}
      </h1>
      <p className="mt-1 text-sm text-neutral-600">
        {opportunity.org.name} → {opportunity.invoice.customer.name} ·{' '}
        {formatPaise(decimalToPaise(opportunity.invoice.faceValue.toString()))} over{' '}
        {opportunity.tenorDays} days
      </p>

      {/* ---------------------------------------------- what they need */}

      <section className="mt-8 rounded border border-neutral-300 bg-neutral-50 p-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          What this supplier needs
        </h2>
        {utility.unconstrained ? (
          <p className="mt-2 text-sm">
            No projected shortfall — nothing is gated out, so offers are ranked on
            cost alone.
          </p>
        ) : (
          <>
            <p className="mt-2 text-lg">
              <strong className="tabular-nums">
                {formatPaise(utility.sufficiencyFloorPaise)}
              </strong>{' '}
              by <strong>{utility.timingDeadline}</strong>
            </p>
            {utility.drivingObligation && (
              <p className="mt-1 text-sm text-neutral-600">
                Driven by <strong>{utility.drivingObligation}</strong>.
              </p>
            )}
            <p className="mt-3 text-xs text-neutral-500">
              Derived from the supplier&rsquo;s cash position — current balance,
              dated obligations, and the buffer they will not go below. Nobody was
              asked to rate how much urgency matters.
            </p>
          </>
        )}
      </section>

      {/* ------------------------------------------------- the outcome */}

      {result.status === 'NO_ACCEPTABLE_OFFER' ? (
        <section className="mt-6 rounded border border-amber-400 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">No acceptable offer</h2>
          <p className="mt-1 text-sm text-amber-900">{result.reason}</p>
          <p className="mt-3 text-xs text-amber-800">
            This is a result, not a failure. If nothing clears the supplier&rsquo;s
            floor the right answer is to not finance — a market that always
            transacts is not exercising judgement.
          </p>
        </section>
      ) : (
        <section className="mt-6 rounded border border-green-500 bg-green-50 p-5">
          <h2 className="text-xs font-medium uppercase tracking-wide text-green-800">
            Matched
          </h2>
          <p className="mt-1 text-lg font-semibold text-green-900">
            {result.allocations[0].providerName}
          </p>
          <p className="text-sm text-green-900">
            funding {formatPaise(result.allocations[0].fundedPaise)}
          </p>
        </section>
      )}

      {/* -------------------------------------------------- the offers */}

      <h2 className="mt-10 mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
        All offers ({scoredOffers.length})
      </h2>

      <div className="flex flex-col gap-3">
        {ordered.map((offer) => (
          <OfferCard key={offer.offer.id} offer={offer} />
        ))}
      </div>

      <p className="mt-8 text-xs text-neutral-500">
        Every figure above is computed by the clearing engine and rendered
        unchanged. This page does no arithmetic of its own.
      </p>
    </main>
  );
}

function OfferCard({ offer }: { offer: ScoredOffer }) {
  const won = offer.rank === 1;

  return (
    <article
      className={[
        'rounded border p-4',
        won
          ? 'border-green-500 bg-green-50'
          : offer.disqualified
            ? 'border-neutral-200 bg-neutral-50'
            : 'border-neutral-300 bg-white',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          className={[
            'font-medium',
            offer.disqualified ? 'text-neutral-500' : 'text-neutral-900',
          ].join(' ')}
        >
          {offer.providerName}
        </h3>
        <span className="font-mono text-xs">
          {won && <span className="mr-2 font-semibold text-green-700">WINNER</span>}
          {offer.disqualified ? (
            <span className="text-neutral-500">DISQUALIFIED</span>
          ) : (
            <span className="text-neutral-500">rank {offer.rank}</span>
          )}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Figure label="Cash to supplier" value={formatPaise(offer.netCashPaise)} strong />
        <Figure label="True cost" value={formatBps(offer.effectiveCostBps)} strong />
        <Figure label="Lands" value={offer.arrivalDate} />
        <Figure
          label="Headline rate"
          value={formatBps(offer.offer.annualRateBps)}
          muted
        />
      </dl>

      {/* The gate reasons are written to be rendered directly. A disqualified
          offer showing WHY it lost is the difference between a marketplace that
          decides and one that just sorts. */}
      {offer.disqualified && (
        <ul className="mt-3 flex flex-col gap-1 border-t border-neutral-200 pt-3">
          {!offer.gates.sufficiency.passed && (
            <li className="text-sm text-red-800">{offer.gates.sufficiency.reason}</li>
          )}
          {!offer.gates.timing.passed && (
            <li className="text-sm text-red-800">{offer.gates.timing.reason}</li>
          )}
        </ul>
      )}
    </article>
  );
}

function Figure({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd
        className={[
          'tabular-nums',
          strong ? 'font-semibold' : '',
          muted ? 'text-neutral-500' : '',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  );
}
