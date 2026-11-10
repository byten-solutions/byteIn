-- AlterTable: Add void metadata to incomes table
ALTER TABLE "incomes" ADD COLUMN "void_reason" VARCHAR(255);
ALTER TABLE "incomes" ADD COLUMN "voided_at" TIMESTAMPTZ;
ALTER TABLE "incomes" ADD COLUMN "voided_by" VARCHAR(30);

-- AddForeignKey
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_voided_by_fkey" 
  FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "incomes_voided_by_idx" ON "incomes"("voided_by");
