-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('SUPPLIER', 'PROVIDER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "VerificationTier" AS ENUM ('BUYER_ACCEPTED', 'LEDGER_VERIFIED', 'SUPPLIER_ASSERTED');

-- CreateEnum
CREATE TYPE "ProviderArchetype" AS ENUM ('BANK', 'NBFC', 'FINTECH', 'CREDIT_FUND', 'SECTOR_SPECIALIST');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'AUCTION_LIVE', 'MATCHED', 'DISBURSING', 'DISBURSED', 'AWAITING_BUYER', 'BUYER_PAID', 'RESERVE_RELEASED', 'CLOSED', 'NO_ACCEPTABLE_OFFER', 'DEFAULTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "RepaymentStructure" AS ENUM ('BULLET', 'AMORTISING', 'REVOLVING');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'EXPIRED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerEventType" AS ENUM ('OPENING_BALANCE', 'DISBURSEMENT', 'BUYER_PAYMENT', 'RESERVE_RELEASE', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'FEE_COLLECTION', 'WRITE_OFF', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PostingDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "EscrowLockStatus" AS ENUM ('HELD', 'RELEASED', 'CAPTURED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "taxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "industry" TEXT,
    "averageDelayDays" DOUBLE PRECISION,
    "relationshipDurationDays" INTEGER,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "faceValue" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "acceptanceDate" TIMESTAMP(3),
    "verificationTier" "VerificationTier" NOT NULL DEFAULT 'SUPPLIER_ASSERTED',
    "threeWayMatched" BOOLEAN NOT NULL DEFAULT false,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalProvider" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archetype" "ProviderArchetype" NOT NULL,
    "costOfFunds" DECIMAL(9,6) NOT NULL,
    "hurdleRate" DECIMAL(9,6) NOT NULL,
    "totalLiquidity" DECIMAL(18,2) NOT NULL,
    "availableLiquidity" DECIMAL(18,2) NOT NULL,
    "minTicket" DECIMAL(18,2) NOT NULL,
    "maxTicket" DECIMAL(18,2) NOT NULL,
    "minTenorDays" INTEGER NOT NULL,
    "maxTenorDays" INTEGER NOT NULL,
    "riskAppetiteFloor" TEXT NOT NULL,
    "concentrationLimitPct" DECIMAL(9,6) NOT NULL,
    "settlementDays" INTEGER NOT NULL,
    "sectorFocus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reliabilityScore" DECIMAL(9,6) NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingOpportunity" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'RECEIVED',
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "tenorDays" INTEGER NOT NULL,
    "riskGrade" TEXT,
    "probabilityOfDefault" DECIMAL(9,6),
    "expectedDilutionPct" DECIMAL(9,6),
    "sufficiencyFloor" DECIMAL(18,2),
    "timingDeadline" TIMESTAMP(3),
    "drivingObligation" TEXT,
    "urgencyWeight" DECIMAL(9,6),
    "cashPositionId" TEXT,
    "auctionClosesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancingOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "annualRate" DECIMAL(9,6) NOT NULL,
    "advanceRate" DECIMAL(9,6) NOT NULL,
    "flatFee" DECIMAL(18,2) NOT NULL,
    "tenorDays" INTEGER NOT NULL,
    "settlementDays" INTEGER NOT NULL,
    "recourse" BOOLEAN NOT NULL DEFAULT true,
    "repaymentStructure" "RepaymentStructure" NOT NULL DEFAULT 'BULLET',
    "status" "BidStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "netCashToSupplier" DECIMAL(18,2),
    "effectiveAnnualCost" DECIMAL(9,6),
    "projectedArrival" TIMESTAMP(3),
    "utilityScore" DECIMAL(9,6),
    "rank" INTEGER,
    "gateFailures" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(18,2) NOT NULL,
    "advanceAmount" DECIMAL(18,2) NOT NULL,
    "discountCharge" DECIMAL(18,2) NOT NULL,
    "feeAmount" DECIMAL(18,2) NOT NULL,
    "netDisbursed" DECIMAL(18,2) NOT NULL,
    "reserveAmount" DECIMAL(18,2) NOT NULL,
    "quotedSettlementDays" INTEGER NOT NULL,
    "quotedDisbursalDate" TIMESTAMP(3) NOT NULL,
    "actualDisbursalDate" TIMESTAMP(3),
    "expectedBuyerPayment" TIMESTAMP(3) NOT NULL,
    "actualBuyerPayment" TIMESTAMP(3),
    "constraintSnapshot" JSONB,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCashPosition" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "currentCashPaise" INTEGER NOT NULL,
    "cashThresholdPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCashPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashObligation" (
    "id" TEXT NOT NULL,
    "cashPositionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "orgId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "eventType" "LedgerEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "opportunityId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Posting" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "direction" "PostingDirection" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Posting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowLock" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "EscrowLockStatus" NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "EscrowLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_taxId_key" ON "Organization"("taxId");

-- CreateIndex
CREATE INDEX "Organization_type_idx" ON "Organization"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_slug_key" ON "Customer"("slug");

-- CreateIndex
CREATE INDEX "Customer_orgId_idx" ON "Customer"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_fingerprint_key" ON "Invoice"("fingerprint");

-- CreateIndex
CREATE INDEX "Invoice_orgId_idx" ON "Invoice"("orgId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orgId_invoiceNumber_key" ON "Invoice"("orgId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalProvider_orgId_key" ON "CapitalProvider"("orgId");

-- CreateIndex
CREATE INDEX "CapitalProvider_archetype_idx" ON "CapitalProvider"("archetype");

-- CreateIndex
CREATE INDEX "FinancingOpportunity_status_idx" ON "FinancingOpportunity"("status");

-- CreateIndex
CREATE INDEX "FinancingOpportunity_orgId_idx" ON "FinancingOpportunity"("orgId");

-- CreateIndex
CREATE INDEX "Bid_opportunityId_idx" ON "Bid"("opportunityId");

-- CreateIndex
CREATE INDEX "Bid_providerId_idx" ON "Bid"("providerId");

-- CreateIndex
CREATE INDEX "Bid_status_idx" ON "Bid"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_opportunityId_providerId_key" ON "Bid"("opportunityId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_opportunityId_key" ON "Match"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_bidId_key" ON "Match"("bidId");

-- CreateIndex
CREATE INDEX "Match_providerId_idx" ON "Match"("providerId");

-- CreateIndex
CREATE INDEX "SupplierCashPosition_orgId_idx" ON "SupplierCashPosition"("orgId");

-- CreateIndex
CREATE INDEX "SupplierCashPosition_asOfDate_idx" ON "SupplierCashPosition"("asOfDate");

-- CreateIndex
CREATE INDEX "CashObligation_cashPositionId_idx" ON "CashObligation"("cashPositionId");

-- CreateIndex
CREATE INDEX "CashObligation_dueDate_idx" ON "CashObligation"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Account_code_key" ON "Account"("code");

-- CreateIndex
CREATE INDEX "Account_orgId_idx" ON "Account"("orgId");

-- CreateIndex
CREATE INDEX "Account_type_idx" ON "Account"("type");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reference_key" ON "JournalEntry"("reference");

-- CreateIndex
CREATE INDEX "JournalEntry_opportunityId_idx" ON "JournalEntry"("opportunityId");

-- CreateIndex
CREATE INDEX "JournalEntry_eventType_idx" ON "JournalEntry"("eventType");

-- CreateIndex
CREATE INDEX "Posting_journalEntryId_idx" ON "Posting"("journalEntryId");

-- CreateIndex
CREATE INDEX "Posting_accountId_idx" ON "Posting"("accountId");

-- CreateIndex
CREATE INDEX "EscrowLock_status_idx" ON "EscrowLock"("status");

-- CreateIndex
CREATE INDEX "EscrowLock_expiresAt_idx" ON "EscrowLock"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowLock_providerId_opportunityId_key" ON "EscrowLock"("providerId", "opportunityId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalProvider" ADD CONSTRAINT "CapitalProvider_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingOpportunity" ADD CONSTRAINT "FinancingOpportunity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingOpportunity" ADD CONSTRAINT "FinancingOpportunity_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingOpportunity" ADD CONSTRAINT "FinancingOpportunity_cashPositionId_fkey" FOREIGN KEY ("cashPositionId") REFERENCES "SupplierCashPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "FinancingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "CapitalProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "FinancingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "CapitalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCashPosition" ADD CONSTRAINT "SupplierCashPosition_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashObligation" ADD CONSTRAINT "CashObligation_cashPositionId_fkey" FOREIGN KEY ("cashPositionId") REFERENCES "SupplierCashPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "FinancingOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowLock" ADD CONSTRAINT "EscrowLock_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "CapitalProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowLock" ADD CONSTRAINT "EscrowLock_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "FinancingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

