-- ==============================================================================
-- Migration: 20261110153000_finance_phase1_receipts_and_cash_foundation
-- Module: Financial Management Integration (Phase 1: DB Foundation & Migration Safety)
-- Description:
--   1. Create financial enums and supporting tables (excluding outgoing payments)
--   2. Seed "Legacy Receipts – Unallocated" accounts and default payment methods
--   3. Prepare invoices and reservations for composite property integrity
--   4. Rename existing payments table to receipts, rename its indexes, preserve raw codes, backfill accounts
--   5. Enforce receipt constraints with strict ON DELETE RESTRICT
--   6. Create new outgoing payments table
--   7. Add performance indexes for cash management
-- ==============================================================================

-- STEP 1: Enums
-- Rename existing PaymentStatus to ReceiptStatus so incoming receipts preserve exact typing without table rewrite
ALTER TYPE "PaymentStatus" RENAME TO "ReceiptStatus";

-- Create dedicated PaymentStatus for outgoing disbursements
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED', 'VOIDED');

-- Create remaining financial enums
CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK', 'CLEARING', 'OTHER');
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'VOID');
CREATE TYPE "IncomeStatus" AS ENUM ('PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'VOID');
CREATE TYPE "TransferStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- STEP 2: Supporting Financial Tables (Excluding outgoing payments)
CREATE TABLE "financial_accounts" (
  "id" VARCHAR(30) PRIMARY KEY,
  "property_id" VARCHAR(30) NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "account_name" VARCHAR(100) NOT NULL,
  "account_type" "AccountType" NOT NULL DEFAULT 'CASH',
  "opening_balance" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  "opening_balance_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_financial_accounts_property" UNIQUE ("property_id", "id"),
  CONSTRAINT "uq_financial_accounts_name" UNIQUE ("property_id", "account_name")
);

CREATE TABLE "payment_methods" (
  "id" VARCHAR(30) PRIMARY KEY,
  "property_id" VARCHAR(30) NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "name" VARCHAR(50) NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "default_account_id" VARCHAR(30),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_payment_methods_property" UNIQUE ("property_id", "id"),
  CONSTRAINT "uq_payment_methods_code" UNIQUE ("property_id", "code"),
  CONSTRAINT "fk_payment_methods_default_account" FOREIGN KEY ("property_id", "default_account_id") 
    REFERENCES "financial_accounts"("property_id", "id") ON DELETE RESTRICT
);

CREATE TABLE "income_heads" (
  "id" VARCHAR(30) PRIMARY KEY,
  "property_id" VARCHAR(30) NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "name" VARCHAR(100) NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_income_heads_property" UNIQUE ("property_id", "id"),
  CONSTRAINT "uq_income_heads_code" UNIQUE ("property_id", "code")
);

CREATE TABLE "incomes" (
  "id" VARCHAR(30) PRIMARY KEY,
  "property_id" VARCHAR(30) NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "income_head_id" VARCHAR(30) NOT NULL,
  "title" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "expected_amount" NUMERIC(10, 2) NOT NULL,
  "income_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "status" "IncomeStatus" NOT NULL DEFAULT 'PENDING',
  "created_by" VARCHAR(30) NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_incomes_property" UNIQUE ("property_id", "id"),
  CONSTRAINT "fk_incomes_income_head" FOREIGN KEY ("property_id", "income_head_id") 
    REFERENCES "income_heads"("property_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "chk_incomes_positive_expected" CHECK ("expected_amount" > 0)
);

CREATE TABLE "expense_heads" (
  "id" VARCHAR(30) PRIMARY KEY,
  "property_id" VARCHAR(30) NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "name" VARCHAR(100) NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_expense_heads_property" UNIQUE ("property_id", "id"),
  CONSTRAINT "uq_expense_heads_code" UNIQUE ("property_id", "code")
);

CREATE TABLE "expenses" (
  "id" VARCHAR(30) PRIMARY KEY,
  "property_id" VARCHAR(30) NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "expense_head_id" VARCHAR(30) NOT NULL,
  "title" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "amount" NUMERIC(10, 2) NOT NULL,
  "vendor_name" VARCHAR(150),
  "reference_number" VARCHAR(100),
  "expense_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
  "created_by" VARCHAR(30) NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "void_reason" TEXT,
  "voided_at" TIMESTAMPTZ,
  "voided_by" VARCHAR(30) REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_expenses_property" UNIQUE ("property_id", "id"),
  CONSTRAINT "fk_expenses_expense_head" FOREIGN KEY ("property_id", "expense_head_id") 
    REFERENCES "expense_heads"("property_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "chk_expenses_positive_amount" CHECK ("amount" > 0)
);

CREATE TABLE "account_transfers" (
  "id" VARCHAR(30) PRIMARY KEY,
  "property_id" VARCHAR(30) NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "from_account_id" VARCHAR(30) NOT NULL,
  "to_account_id" VARCHAR(30) NOT NULL,
  "amount" NUMERIC(10, 2) NOT NULL,
  "transfer_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "description" TEXT,
  "reference_number" VARCHAR(100),
  "status" "TransferStatus" NOT NULL DEFAULT 'COMPLETED',
  "created_by" VARCHAR(30) NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_transfers_property" UNIQUE ("property_id", "id"),
  CONSTRAINT "fk_transfers_from_account" FOREIGN KEY ("property_id", "from_account_id") 
    REFERENCES "financial_accounts"("property_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "fk_transfers_to_account" FOREIGN KEY ("property_id", "to_account_id") 
    REFERENCES "financial_accounts"("property_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "chk_transfers_distinct_accounts" CHECK ("from_account_id" <> "to_account_id"),
  CONSTRAINT "chk_transfers_positive_amount" CHECK ("amount" > 0)
);

-- STEP 3: Seed "Legacy Receipts – Unallocated" Accounts and Default Payment Methods
INSERT INTO "financial_accounts" ("id", "property_id", "account_name", "account_type", "opening_balance", "opening_balance_date", "is_default", "is_active", "created_at", "updated_at")
SELECT 
  'fa_legacy_' || substr(id, 6, 20),
  id,
  'Legacy Receipts – Unallocated',
  'CLEARING',
  0.00,
  CURRENT_DATE,
  false,
  true,
  NOW(),
  NOW()
FROM "properties"
ON CONFLICT ("property_id", "account_name") DO NOTHING;

INSERT INTO "payment_methods" ("id", "property_id", "name", "code", "is_active", "created_at", "updated_at")
SELECT 'pm_cash_' || substr(id, 6, 20), id, 'Cash', 'CASH', true, NOW(), NOW() FROM "properties"
UNION ALL
SELECT 'pm_upi_' || substr(id, 6, 20), id, 'UPI / QR', 'UPI', true, NOW(), NOW() FROM "properties"
UNION ALL
SELECT 'pm_card_' || substr(id, 6, 20), id, 'Credit / Debit Card', 'CREDIT_CARD', true, NOW(), NOW() FROM "properties"
UNION ALL
SELECT 'pm_bank_' || substr(id, 6, 20), id, 'Bank Transfer', 'BANK_TRANSFER', true, NOW(), NOW() FROM "properties"
ON CONFLICT ("property_id", "code") DO NOTHING;

-- STEP 4: Invoices & Reservations Composite Preparation
ALTER TABLE "reservations" ADD CONSTRAINT "uq_reservations_property" UNIQUE ("property_id", "id");

ALTER TABLE "invoices" ALTER COLUMN "reservation_id" DROP NOT NULL;
ALTER TABLE "invoices" ADD COLUMN "customer_id" VARCHAR(30) REFERENCES "customers"("id") ON DELETE RESTRICT;
ALTER TABLE "invoices" ADD COLUMN "customer_name" VARCHAR(150);
ALTER TABLE "invoices" ADD CONSTRAINT "uq_invoices_property" UNIQUE ("property_id", "id");

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_reservation_id_fkey";
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_property_reservation" 
  FOREIGN KEY ("property_id", "reservation_id") REFERENCES "reservations"("property_id", "id") ON DELETE RESTRICT;

-- STEP 5: Rename Existing payments Table to receipts and Add Columns
ALTER TABLE "payments" RENAME TO "receipts";
ALTER TABLE "receipts" RENAME COLUMN "payment_method" TO "payment_method_code";
ALTER TABLE "receipts" ALTER COLUMN "invoice_id" DROP NOT NULL;

-- Rename existing indexes to prevent collisions with new outgoing payments table
ALTER INDEX IF EXISTS "payments_pkey" RENAME TO "receipts_pkey";
ALTER INDEX IF EXISTS "payments_invoice_id_idx" RENAME TO "receipts_invoice_id_idx";
ALTER INDEX IF EXISTS "payments_created_by_idx" RENAME TO "receipts_created_by_idx";
ALTER INDEX IF EXISTS "payments_idempotency_key_key" RENAME TO "receipts_idempotency_key_key";
ALTER INDEX IF EXISTS "payments_voided_by_idx" RENAME TO "receipts_voided_by_idx";
ALTER INDEX IF EXISTS "payments_voided_at_idx" RENAME TO "receipts_voided_at_idx";
ALTER INDEX IF EXISTS "payments_invoice_id_status_idx" RENAME TO "receipts_invoice_id_status_idx";
ALTER INDEX IF EXISTS "payments_invoice_id_recorded_idx" RENAME TO "receipts_invoice_id_recorded_idx";
ALTER INDEX IF EXISTS "payments_property_id_paid_at_idx" RENAME TO "receipts_property_id_paid_at_idx";
ALTER INDEX IF EXISTS "payments_paid_at_idx" RENAME TO "receipts_paid_at_idx";

ALTER TABLE "receipts" ADD COLUMN "income_id" VARCHAR(30);
ALTER TABLE "receipts" ADD COLUMN "account_id" VARCHAR(30);
ALTER TABLE "receipts" ADD COLUMN "payment_method_id" VARCHAR(30);
ALTER TABLE "receipts" ADD COLUMN "is_legacy" BOOLEAN NOT NULL DEFAULT false;

-- STEP 6: Backfill receipts
-- Backfill account_id to each property's legacy clearing account and set is_legacy = true
UPDATE "receipts" r
SET 
  "account_id" = fa.id,
  "is_legacy" = true
FROM "financial_accounts" fa
WHERE fa.property_id = r.property_id 
  AND fa.account_name = 'Legacy Receipts – Unallocated';

-- Backfill payment_method_id where code matches
UPDATE "receipts" r
SET "payment_method_id" = pm.id
FROM "payment_methods" pm
WHERE pm.property_id = r.property_id 
  AND pm.code = r.payment_method_code;

-- Enforce NOT NULL on account_id
ALTER TABLE "receipts" ALTER COLUMN "account_id" SET NOT NULL;

-- STEP 7: Enforce Constraints on receipts (Strict ON DELETE RESTRICT)
ALTER TABLE "receipts" ADD CONSTRAINT "uq_receipts_property" UNIQUE ("property_id", "id");

ALTER TABLE "receipts" ADD CONSTRAINT "fk_receipts_property_account" 
  FOREIGN KEY ("property_id", "account_id") REFERENCES "financial_accounts"("property_id", "id") ON DELETE RESTRICT;

-- Drop redundant simple invoice FK (payments_invoice_id_fkey) and replace with composite FK
ALTER TABLE "receipts" DROP CONSTRAINT IF EXISTS "payments_invoice_id_fkey";
ALTER TABLE "receipts" ADD CONSTRAINT "fk_receipts_property_invoice" 
  FOREIGN KEY ("property_id", "invoice_id") REFERENCES "invoices"("property_id", "id") ON DELETE RESTRICT;

ALTER TABLE "receipts" ADD CONSTRAINT "fk_receipts_property_income" 
  FOREIGN KEY ("property_id", "income_id") REFERENCES "incomes"("property_id", "id") ON DELETE RESTRICT;

ALTER TABLE "receipts" ADD CONSTRAINT "fk_receipts_property_payment_method" 
  FOREIGN KEY ("property_id", "payment_method_id") REFERENCES "payment_methods"("property_id", "id") ON DELETE RESTRICT;

ALTER TABLE "receipts" ADD CONSTRAINT "chk_receipts_source_exclusivity" 
  CHECK (("invoice_id" IS NOT NULL AND "income_id" IS NULL) OR ("invoice_id" IS NULL AND "income_id" IS NOT NULL));

ALTER TABLE "receipts" ADD CONSTRAINT "chk_receipts_positive_amount" 
  CHECK ("amount" > 0);

-- STEP 8: Only Then Create New Outgoing payments Table
CREATE TABLE "payments" (
  "id" VARCHAR(30) PRIMARY KEY,
  "property_id" VARCHAR(30) NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "expense_id" VARCHAR(30) NOT NULL,
  "account_id" VARCHAR(30) NOT NULL,
  "payment_method_id" VARCHAR(30),
  "payment_method_code" VARCHAR(30) NOT NULL,
  "amount" NUMERIC(10, 2) NOT NULL,
  "reference_number" VARCHAR(100),
  "status" "PaymentStatus" NOT NULL DEFAULT 'RECORDED',
  "paid_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_by" VARCHAR(30) NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "void_reason" TEXT,
  "voided_at" TIMESTAMPTZ,
  "voided_by" VARCHAR(30) REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_payments_property" UNIQUE ("property_id", "id"),
  CONSTRAINT "fk_payments_expense" FOREIGN KEY ("property_id", "expense_id") 
    REFERENCES "expenses"("property_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "fk_payments_account" FOREIGN KEY ("property_id", "account_id") 
    REFERENCES "financial_accounts"("property_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "fk_payments_payment_method" FOREIGN KEY ("property_id", "payment_method_id") 
    REFERENCES "payment_methods"("property_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "chk_payments_positive_amount" CHECK ("amount" > 0)
);

-- STEP 9: Indexes
CREATE INDEX "receipts_income_id_idx" ON "receipts"("income_id");
CREATE INDEX "receipts_account_id_idx" ON "receipts"("account_id");
CREATE INDEX "receipts_payment_method_id_idx" ON "receipts"("payment_method_id");
CREATE INDEX "receipts_is_legacy_idx" ON "receipts"("is_legacy");

CREATE INDEX "financial_accounts_property_id_is_active_idx" ON "financial_accounts"("property_id", "is_active");
CREATE INDEX "payment_methods_property_id_is_active_idx" ON "payment_methods"("property_id", "is_active");

CREATE INDEX "incomes_property_id_income_date_idx" ON "incomes"("property_id", "income_date" DESC);
CREATE INDEX "incomes_income_head_id_idx" ON "incomes"("income_head_id");
CREATE INDEX "incomes_created_by_idx" ON "incomes"("created_by");

CREATE INDEX "expense_heads_property_id_is_active_idx" ON "expense_heads"("property_id", "is_active");

CREATE INDEX "expenses_property_id_expense_date_idx" ON "expenses"("property_id", "expense_date" DESC);
CREATE INDEX "expenses_property_id_status_idx" ON "expenses"("property_id", "status");
CREATE INDEX "expenses_expense_head_id_idx" ON "expenses"("expense_head_id");
CREATE INDEX "expenses_created_by_idx" ON "expenses"("created_by");

CREATE INDEX "payments_property_id_paid_at_idx" ON "payments"("property_id", "paid_at" DESC);
CREATE INDEX "payments_expense_id_idx" ON "payments"("expense_id");
CREATE INDEX "payments_account_id_idx" ON "payments"("account_id");
CREATE INDEX "payments_payment_method_id_idx" ON "payments"("payment_method_id");
CREATE INDEX "payments_created_by_idx" ON "payments"("created_by");

CREATE INDEX "account_transfers_property_id_transfer_date_idx" ON "account_transfers"("property_id", "transfer_date" DESC);
CREATE INDEX "account_transfers_from_account_id_idx" ON "account_transfers"("from_account_id");
CREATE INDEX "account_transfers_to_account_id_idx" ON "account_transfers"("to_account_id");
CREATE INDEX "account_transfers_created_by_idx" ON "account_transfers"("created_by");

CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");

-- STEP 10: Deterministic Migration Baseline Snapshot for Rollback Safety
CREATE TABLE IF NOT EXISTS "_finance_migration_baseline" (
  "table_name" VARCHAR(50) PRIMARY KEY,
  "record_count" BIGINT NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Baseline for legacy receipts
INSERT INTO "_finance_migration_baseline" ("table_name", "record_count", "checksum")
SELECT 
  'receipts',
  COUNT(*),
  COALESCE(md5(string_agg(
    md5(
      id || '|' ||
      property_id || '|' ||
      amount::text || '|' ||
      payment_method_code || '|' ||
      COALESCE(reference_number, '') || '|' ||
      paid_at::text || '|' ||
      created_by || '|' ||
      status::text || '|' ||
      COALESCE(void_reason, '') || '|' ||
      COALESCE(voided_at::text, '') || '|' ||
      COALESCE(voided_by, '') || '|' ||
      account_id || '|' ||
      is_legacy::text
    ), ',' ORDER BY id
  )), 'empty')
FROM "receipts"
WHERE "is_legacy" = true
ON CONFLICT ("table_name") DO UPDATE 
  SET "record_count" = EXCLUDED."record_count", "checksum" = EXCLUDED."checksum";

-- Baseline for pre-existing invoices
INSERT INTO "_finance_migration_baseline" ("table_name", "record_count", "checksum")
SELECT 
  'invoices',
  COUNT(*),
  COALESCE(md5(string_agg(
    md5(
      id || '|' ||
      property_id || '|' ||
      COALESCE(reservation_id, '') || '|' ||
      subtotal::text || '|' ||
      discount_total::text || '|' ||
      tax_total::text || '|' ||
      grand_total::text || '|' ||
      status::text || '|' ||
      COALESCE(issued_at::text, '')
    ), ',' ORDER BY id
  )), 'empty')
FROM "invoices"
ON CONFLICT ("table_name") DO UPDATE 
  SET "record_count" = EXCLUDED."record_count", "checksum" = EXCLUDED."checksum";

-- Baseline for seeded legacy financial accounts
INSERT INTO "_finance_migration_baseline" ("table_name", "record_count", "checksum")
SELECT 
  'financial_accounts',
  COUNT(*),
  COALESCE(md5(string_agg(
    md5(
      id || '|' ||
      property_id || '|' ||
      account_name || '|' ||
      account_type::text || '|' ||
      opening_balance::text || '|' ||
      is_default::text || '|' ||
      is_active::text
    ), ',' ORDER BY id
  )), 'empty')
FROM "financial_accounts"
ON CONFLICT ("table_name") DO UPDATE 
  SET "record_count" = EXCLUDED."record_count", "checksum" = EXCLUDED."checksum";

-- Baseline for seeded payment methods
INSERT INTO "_finance_migration_baseline" ("table_name", "record_count", "checksum")
SELECT 
  'payment_methods',
  COUNT(*),
  COALESCE(md5(string_agg(
    md5(
      id || '|' ||
      property_id || '|' ||
      name || '|' ||
      code || '|' ||
      COALESCE(default_account_id, '') || '|' ||
      is_active::text
    ), ',' ORDER BY id
  )), 'empty')
FROM "payment_methods"
ON CONFLICT ("table_name") DO UPDATE 
  SET "record_count" = EXCLUDED."record_count", "checksum" = EXCLUDED."checksum";

