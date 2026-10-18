-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customers_first_name_trgm_idx" ON "customers" USING gin ("first_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customers_last_name_trgm_idx" ON "customers" USING gin ("last_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customers_phone_trgm_idx" ON "customers" USING gin ("phone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customers_email_trgm_idx" ON "customers" USING gin ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reservations_reservation_no_trgm_idx" ON "reservations" USING gin ("reservation_no" gin_trgm_ops);
