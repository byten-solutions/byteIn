-- AlterTable: Add void tracking columns to payments
ALTER TABLE "payments" ADD COLUMN "void_reason" TEXT,
ADD COLUMN "voided_at" TIMESTAMP(3),
ADD COLUMN "voided_by" TEXT;

-- CreateIndex
CREATE INDEX "payments_voided_by_idx" ON "payments"("voided_by");
CREATE INDEX "payments_voided_at_idx" ON "payments"("voided_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ensure seeded accounts must change password on initial login
UPDATE "users" SET "must_change_password" = true WHERE "email" IN ('admin@byteinn.local', 'reception@byteinn.local');
