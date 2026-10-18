-- 1. Columns (nullable first)
ALTER TABLE "reservations" ADD COLUMN "property_id" TEXT;
ALTER TABLE "invoices"     ADD COLUMN "property_id" TEXT;
ALTER TABLE "payments"     ADD COLUMN "property_id" TEXT;
ALTER TABLE "customers"    ADD COLUMN "registered_property_id" TEXT;

-- 2. Backfill: reservation property comes from its rooms (one property per reservation)
UPDATE "reservations" r SET "property_id" = x."property_id"
FROM (
  SELECT DISTINCT ON (rr."reservation_id") rr."reservation_id", rm."property_id"
  FROM "reservation_rooms" rr JOIN "rooms" rm ON rm."id" = rr."room_id"
  ORDER BY rr."reservation_id", rr."created_at"
) x
WHERE x."reservation_id" = r."id";

-- fallback for reservations with no rooms: the creator's hotel
UPDATE "reservations" r SET "property_id" = u."property_id"
FROM "users" u
WHERE r."property_id" IS NULL AND u."id" = r."created_by" AND u."property_id" IS NOT NULL;

UPDATE "invoices" i SET "property_id" = r."property_id"
FROM "reservations" r WHERE r."id" = i."reservation_id";

UPDATE "payments" p SET "property_id" = i."property_id"
FROM "invoices" i WHERE i."id" = p."invoice_id";

-- 3. Fail loudly instead of silently leaving NULLs or mixed-property data
DO $$
DECLARE n_res bigint; n_inv bigint; n_pay bigint; n_mixed bigint;
BEGIN
  SELECT count(*) INTO n_res FROM "reservations" WHERE "property_id" IS NULL;
  SELECT count(*) INTO n_inv FROM "invoices"     WHERE "property_id" IS NULL;
  SELECT count(*) INTO n_pay FROM "payments"     WHERE "property_id" IS NULL;
  SELECT count(*) INTO n_mixed FROM (
    SELECT rr."reservation_id" FROM "reservation_rooms" rr JOIN "rooms" rm ON rm."id" = rr."room_id"
    GROUP BY rr."reservation_id" HAVING count(DISTINCT rm."property_id") > 1) m;
  IF n_res > 0 OR n_inv > 0 OR n_pay > 0 OR n_mixed > 0 THEN
    RAISE EXCEPTION 'property_id backfill incomplete: reservations=%, invoices=%, payments=%, mixed-property reservations=%',
      n_res, n_inv, n_pay, n_mixed;
  END IF;
END $$;

-- 4. Constraints
ALTER TABLE "reservations" ALTER COLUMN "property_id" SET NOT NULL;
ALTER TABLE "invoices"     ALTER COLUMN "property_id" SET NOT NULL;
ALTER TABLE "payments"     ALTER COLUMN "property_id" SET NOT NULL;

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_registered_property_id_fkey"
  FOREIGN KEY ("registered_property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Indexes
CREATE INDEX "reservations_property_id_created_at_idx"        ON "reservations"("property_id", "created_at" DESC);
CREATE INDEX "reservations_property_id_status_created_at_idx" ON "reservations"("property_id", "status", "created_at" DESC);
CREATE INDEX "reservations_property_id_customer_id_idx"       ON "reservations"("property_id", "customer_id");
CREATE INDEX "invoices_property_id_created_at_idx"            ON "invoices"("property_id", "created_at" DESC);
CREATE INDEX "invoices_property_id_status_created_at_idx"     ON "invoices"("property_id", "status", "created_at" DESC);
CREATE INDEX "payments_property_id_paid_at_idx"               ON "payments"("property_id", "paid_at" DESC);
CREATE INDEX "payments_paid_at_idx"                           ON "payments"("paid_at" DESC);
CREATE INDEX "customers_registered_property_id_idx"           ON "customers"("registered_property_id");

-- 6. DB-level guarantee for the application rule "all rooms of a reservation share its property"
CREATE OR REPLACE FUNCTION enforce_reservation_room_property() RETURNS trigger AS $$
BEGIN
  IF (SELECT property_id FROM rooms WHERE id = NEW.room_id)
     IS DISTINCT FROM (SELECT property_id FROM reservations WHERE id = NEW.reservation_id) THEN
    RAISE EXCEPTION 'room % belongs to a different property than reservation %', NEW.room_id, NEW.reservation_id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER reservation_rooms_property_check
  BEFORE INSERT OR UPDATE OF room_id, reservation_id ON "reservation_rooms"
  FOR EACH ROW EXECUTE FUNCTION enforce_reservation_room_property();
