/**
 * /market — every opportunity in the marketplace.
 *
 * A server component, deliberately: it reads Postgres directly and renders. No
 * client state, no loading choreography, no mock fallback. If the database is
 * unreachable the page says so, because a demo that silently shows fiction when
 * the connection drops is worse than one that fails visibly.
 *
 * Styling is intentionally plain. Track 4 owns the visual design; this slice
 * owns the fact that a real result reaches the browser at all. It should be
 * easy to restyle and easy to delete.
 */

import Link from 'next/link';

import { listOpportunities } from '@/lib/market/server';
import { formatPaise } from '@/lib/market/money';
import { decimalToPaise } from '@/lib/market/prisma-adapter';

export const dynamic = 'force-dynamic';

const TIER_LABEL: Record<string, string> = {
  BUYER_ACCEPTED: 'Buyer accepted',
  LEDGER_VERIFIED: 'Ledger verified',
  SUPPLIER_ASSERTED: 'Supplier asserted',
};

export default async function MarketPage() {
  let opportunities;
  try {
    opportunities = await listOpportunities();
  } catch (e) {
    return (
      <Shell>
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Cannot reach the database.</p>
          <p className="mt-1 font-mono text-xs">
            {e instanceof Error ? e.message : 'unknown error'}
          </p>
          <p className="mt-2">
            Check <code>DATABASE_URL</code> in <code>frontend/.env</code>.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {opportunities.length === 0 ? (
        <p className="text-sm text-neutral-600">
          No opportunities. Seed the database with <code>npm run db:seed</code>.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-2 pr-4 font-medium">Invoice</th>
                <th className="py-2 pr-4 font-medium">Supplier</th>
                <th className="py-2 pr-4 font-medium">Buyer</th>
                <th className="py-2 pr-4 text-right font-medium">Face value</th>
                <th className="py-2 pr-4 text-right font-medium">Tenor</th>
                <th className="py-2 pr-4 font-medium">Verification</th>
                <th className="py-2 pr-4 text-right font-medium">Bids</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((o) => (
                <tr key={o.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/market/${o.id}`}
                      className="font-medium text-blue-700 underline underline-offset-2"
                    >
                      {o.invoiceNumber}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{o.supplierName}</td>
                  <td className="py-3 pr-4 text-neutral-600">{o.buyerName}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatPaise(decimalToPaise(o.faceValue))}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">{o.tenorDays}d</td>
                  <td className="py-3 pr-4 text-neutral-600">
                    {TIER_LABEL[o.verificationTier] ?? o.verificationTier}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">{o.bidCount}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs">
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
      <p className="mt-1 mb-8 text-sm text-neutral-600">
        Live from the database. Open an opportunity to see how it clears.
      </p>
      {children}
    </main>
  );
}
