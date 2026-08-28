// The chart of accounts.
//
// Codes are the stable handle (`provider:aurora:cash`); ids are opaque cuids.
// Anything reading the ledger should join on code, so a reseeded database does
// not invalidate a query someone wrote against it.

import type { AccountType } from "@/generated/prisma/enums";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** Debit increases ASSET and EXPENSE; credit increases the other three. */
export const DEBIT_NORMAL: ReadonlySet<AccountType> = new Set<AccountType>(["ASSET", "EXPENSE"]);

export const PLATFORM = {
  /** Cash the platform has actually collected in fees. */
  cash: "platform:cash",
  feeIncome: "platform:fee_income",
  /** Buyer money sitting with the platform, not yet distributed. */
  escrowCash: "platform:escrow_cash",
  /** The matching obligation to pay it onward. Escrow is never platform money. */
  escrowPayable: "platform:escrow_payable",
} as const;

export const supplierAccounts = (slug: string) => ({
  cash: `supplier:${slug}:cash`,
  /** The supplier's claim on its buyers. Sold down as invoices are financed. */
  invoiceReceivable: `supplier:${slug}:invoice_receivable`,
  /** Discount charge plus fees. What financing actually cost this supplier. */
  financingExpense: `supplier:${slug}:financing_expense`,
});

export const providerAccounts = (slug: string) => ({
  cash: `provider:${slug}:cash`,
  /** Capital deployed into a funded invoice, awaiting buyer payment. */
  fundedReceivable: `provider:${slug}:funded_receivable`,
  /** Held against a live bid. Real cash, but no longer available to commit. */
  encumberedCapital: `provider:${slug}:encumbered_capital`,
  discountIncome: `provider:${slug}:discount_income`,
});

export const buyerAccounts = (slug: string) => ({
  cash: `buyer:${slug}:cash`,
  /** What the buyer owes on accepted invoices. */
  payable: `buyer:${slug}:payable`,
});

export interface AccountSpec {
  code: string;
  name: string;
  type: AccountType;
  orgId?: string | null;
}

/**
 * Create the accounts if they are missing, and return code -> id.
 *
 * Idempotent, so seeding twice or replaying a flow does not duplicate the chart.
 */
export async function ensureAccounts(db: Db, specs: AccountSpec[]): Promise<Map<string, string>> {
  for (const spec of specs) {
    await db.account.upsert({
      where: { code: spec.code },
      update: {},
      create: {
        code: spec.code,
        name: spec.name,
        type: spec.type,
        orgId: spec.orgId ?? null,
      },
    });
  }

  const rows = await db.account.findMany({
    where: { code: { in: specs.map((s) => s.code) } },
    select: { id: true, code: true },
  });
  return new Map(rows.map((r) => [r.code, r.id]));
}

/** The platform-level accounts, which belong to no tenant. */
export const platformAccountSpecs: AccountSpec[] = [
  { code: PLATFORM.cash, name: "Platform cash", type: "ASSET" },
  { code: PLATFORM.feeIncome, name: "Platform fee income", type: "REVENUE" },
  { code: PLATFORM.escrowCash, name: "Escrow cash", type: "ASSET" },
  { code: PLATFORM.escrowPayable, name: "Escrow payable", type: "LIABILITY" },
];

export function supplierAccountSpecs(slug: string, name: string, orgId: string): AccountSpec[] {
  const a = supplierAccounts(slug);
  return [
    { code: a.cash, name: `${name} — cash`, type: "ASSET", orgId },
    { code: a.invoiceReceivable, name: `${name} — invoice receivable`, type: "ASSET", orgId },
    { code: a.financingExpense, name: `${name} — financing expense`, type: "EXPENSE", orgId },
  ];
}

export function providerAccountSpecs(slug: string, name: string, orgId: string): AccountSpec[] {
  const a = providerAccounts(slug);
  return [
    { code: a.cash, name: `${name} — cash`, type: "ASSET", orgId },
    { code: a.fundedReceivable, name: `${name} — funded receivable`, type: "ASSET", orgId },
    { code: a.encumberedCapital, name: `${name} — encumbered capital`, type: "ASSET", orgId },
    { code: a.discountIncome, name: `${name} — discount income`, type: "REVENUE", orgId },
  ];
}

export function buyerAccountSpecs(slug: string, name: string): AccountSpec[] {
  const a = buyerAccounts(slug);
  return [
    { code: a.cash, name: `${name} — cash`, type: "ASSET" },
    { code: a.payable, name: `${name} — accounts payable`, type: "LIABILITY" },
  ];
}
