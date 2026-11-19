-- AlterTable: Add idempotency_key to payments table
ALTER TABLE "payments" ADD COLUMN "idempotency_key" VARCHAR(255);

-- CreateIndex: Property-scoped unique index for idempotency_key
CREATE UNIQUE INDEX "payments_property_id_idempotency_key_key" ON "payments"("property_id", "idempotency_key");
