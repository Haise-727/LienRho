// The money flows, as balanced journal entries.
//
// Two events have to be right for the demo to mean anything, and they are the
// two the Stitch ledger exists to keep straight (issue #1):
//
//   Day 0  — the provider advances cash; the supplier receives it net of the
//            discount charge and the platform fee.
//   Day 90 — the buyer pays the invoice. That payment is contractually
//            redirected to the provider, who is repaid its advance; only then
//            does the reserve release to the supplier.
//
// The reserve is the mechanical detail that makes "the provider gets repaid"
// concrete: the supplier was already paid the advance, so the buyer's payment
// is not theirs to keep until the provider is whole.

import { money, quoteEconomics, Decimal, type DecimalValue } from "@/lib/money";
import { postEntry, debit, credit } from "./post";
import { PLATFORM, providerAccounts, supplierAccounts, buyerAccounts } from "./accounts";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export interface DealParties {
  supplierSlug: string;
  providerSlug: string;
  buyerSlug: string;
}

export interface DisbursementInput extends DealParties {
  opportunityId: string;
  /** Face value of the financed invoice. */
  faceValue: DecimalValue;
  advanceRate: DecimalValue;
  annualRate: DecimalValue;
  flatFee: DecimalValue;
  tenorDays: number;
  occurredAt?: Date;
}

/**
 * Day 0. Provider advances `advance`, keeps `discountCharge` as income at
 * source, the platform takes its fee, and the supplier nets the rest.
 *
 * Each party's own sub-ledger balances, and so does the entry as a whole:
 *
 *   supplier   cash + expense            = receivable sold
 *   provider   funded receivable         = cash out + discount income
 *   platform   cash in                   = fee income
 */
export async function postDisbursement(input: DisbursementInput, db?: Db) {
  const econ = quoteEconomics(input);
  const supplier = supplierAccounts(input.supplierSlug);
  const provider = providerAccounts(input.providerSlug);

  // Cash actually leaving the provider: the advance less the discount it keeps.
  const providerCashOut = money(econ.advance.minus(econ.discountCharge));

  const entry = await postEntry(
    {
      reference: `disb:${input.opportunityId}`,
      eventType: "DISBURSEMENT",
      description: `Day 0 disbursement — advance ${econ.advance.toFixed(2)}, net to supplier ${econ.netCash.toFixed(2)}`,
      opportunityId: input.opportunityId,
      occurredAt: input.occurredAt,
      metadata: {
        advance: econ.advance.toFixed(2),
        discountCharge: econ.discountCharge.toFixed(2),
        fee: econ.fee.toFixed(2),
        netCash: econ.netCash.toFixed(2),
        reserve: econ.reserve.toFixed(2),
        effectiveAnnualCost: econ.effectiveAnnualCost.toFixed(6),
      },
      postings: [
        // Supplier: receives net cash, books the cost, gives up the advance
        // portion of its claim on the buyer.
        debit(supplier.cash, econ.netCash),
        debit(supplier.financingExpense, econ.discountCharge.plus(econ.fee)),
        credit(supplier.invoiceReceivable, econ.advance),

        // Provider: acquires the claim, pays out cash, earns the discount.
        debit(provider.fundedReceivable, econ.advance),
        credit(provider.cash, providerCashOut),
        credit(provider.discountIncome, econ.discountCharge),

        // Platform: collects its fee out of the provider's outflow.
        debit(PLATFORM.cash, econ.fee),
        credit(PLATFORM.feeIncome, econ.fee),
      ].filter((p) => new Decimal(p.amount).greaterThan(0)),
    },
    db,
  );

  return { entry, economics: econ };
}

export interface BuyerPaymentInput extends DealParties {
  opportunityId: string;
  /** What the buyer actually paid. Below face value is dilution. */
  amountPaid: DecimalValue;
  occurredAt?: Date;
}

/**
 * Day 90, part one. The buyer settles into platform escrow.
 *
 * Escrow is recorded as cash held *against a matching payable* — it is never
 * platform revenue, and the payable is what makes that structural rather than
 * a matter of good intentions.
 */
export async function postBuyerPayment(input: BuyerPaymentInput, db?: Db) {
  const buyer = buyerAccounts(input.buyerSlug);
  const amount = money(input.amountPaid);

  return postEntry(
    {
      reference: `buyerpay:${input.opportunityId}`,
      eventType: "BUYER_PAYMENT",
      description: `Buyer settled ${amount.toFixed(2)} into escrow`,
      opportunityId: input.opportunityId,
      occurredAt: input.occurredAt,
      postings: [
        debit(buyer.payable, amount),
        credit(buyer.cash, amount),
        debit(PLATFORM.escrowCash, amount),
        credit(PLATFORM.escrowPayable, amount),
      ],
    },
    db,
  );
}

export interface ReserveReleaseInput extends DealParties {
  opportunityId: string;
  /** Amount sitting in escrow to distribute. */
  amountInEscrow: DecimalValue;
  /** The provider's original advance — repaid first, before any reserve. */
  advanceAmount: DecimalValue;
  occurredAt?: Date;
}

/**
 * Day 90, part two. Escrow distributes: the provider recovers its advance,
 * and whatever remains is the supplier's reserve.
 *
 * The provider is made whole first. If the buyer short-paid, dilution eats the
 * reserve rather than the provider's principal — which is exactly what a
 * recourse arrangement means, and why the reserve is not risk-free money the
 * supplier can count on.
 */
export async function postReserveRelease(input: ReserveReleaseInput, db?: Db) {
  const supplier = supplierAccounts(input.supplierSlug);
  const provider = providerAccounts(input.providerSlug);

  const escrow = money(input.amountInEscrow);
  const advance = money(input.advanceAmount);
  const toProvider = Decimal.min(escrow, advance);
  const toSupplier = money(escrow.minus(toProvider));

  const postings = [
    debit(PLATFORM.escrowPayable, escrow),
    credit(PLATFORM.escrowCash, escrow),
    debit(provider.cash, toProvider),
    credit(provider.fundedReceivable, toProvider),
  ];

  if (toSupplier.greaterThan(0)) {
    postings.push(
      debit(supplier.cash, toSupplier),
      credit(supplier.invoiceReceivable, toSupplier),
    );
  }

  const entry = await postEntry(
    {
      reference: `release:${input.opportunityId}`,
      eventType: "RESERVE_RELEASE",
      description: `Escrow distributed — provider ${toProvider.toFixed(2)}, supplier reserve ${toSupplier.toFixed(2)}`,
      opportunityId: input.opportunityId,
      occurredAt: input.occurredAt,
      metadata: {
        toProvider: toProvider.toFixed(2),
        toSupplier: toSupplier.toFixed(2),
        shortfall: money(advance.minus(toProvider)).toFixed(2),
      },
      postings,
    },
    db,
  );

  return { entry, toProvider, toSupplier };
}

export interface EscrowHoldInput {
  opportunityId: string;
  providerSlug: string;
  amount: DecimalValue;
}

/**
 * Capital committed against a live bid, before any cash moves.
 *
 * Nothing leaves the provider — the money moves from `cash` to
 * `encumbered_capital`, so committed capital is visible in the ledger and
 * cannot be quietly promised twice.
 */
export async function postEscrowHold(input: EscrowHoldInput, db?: Db) {
  const provider = providerAccounts(input.providerSlug);
  const amount = money(input.amount);

  return postEntry(
    {
      reference: `hold:${input.opportunityId}:${input.providerSlug}`,
      eventType: "ESCROW_HOLD",
      description: `Capital hold of ${amount.toFixed(2)} against a live bid`,
      opportunityId: input.opportunityId,
      postings: [debit(provider.encumberedCapital, amount), credit(provider.cash, amount)],
    },
    db,
  );
}

/** The reverse: the bid lost or expired, so the hold returns to free cash. */
export async function postEscrowRelease(input: EscrowHoldInput, db?: Db) {
  const provider = providerAccounts(input.providerSlug);
  const amount = money(input.amount);

  return postEntry(
    {
      reference: `unhold:${input.opportunityId}:${input.providerSlug}`,
      eventType: "ESCROW_RELEASE",
      description: `Capital hold of ${amount.toFixed(2)} released`,
      opportunityId: input.opportunityId,
      postings: [debit(provider.cash, amount), credit(provider.encumberedCapital, amount)],
    },
    db,
  );
}
