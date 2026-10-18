-- CreateIndex
CREATE INDEX "customers_created_at_idx" ON "customers"("created_at" DESC);

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at" DESC);

-- CreateIndex
CREATE INDEX "invoices_status_created_at_idx" ON "invoices"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_invoice_id_status_idx" ON "payments"("invoice_id", "status");

-- CreateIndex
CREATE INDEX "payments_invoice_id_recorded_idx" ON "payments"("invoice_id") WHERE "status" = 'RECORDED';

-- CreateIndex
CREATE INDEX "reservation_rooms_departure_date_idx" ON "reservation_rooms"("departure_date");

-- CreateIndex
CREATE INDEX "reservation_rooms_status_departure_date_idx" ON "reservation_rooms"("status", "departure_date");

-- CreateIndex
CREATE INDEX "reservation_rooms_status_arrival_date_idx" ON "reservation_rooms"("status", "arrival_date");

-- CreateIndex
CREATE INDEX "reservations_created_at_idx" ON "reservations"("created_at" DESC);

-- CreateIndex
CREATE INDEX "reservations_customer_id_created_at_idx" ON "reservations"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "room_category_amenities_amenity_id_idx" ON "room_category_amenities"("amenity_id");

-- CreateIndex
CREATE INDEX "rooms_floor_id_idx" ON "rooms"("floor_id");

-- CreateIndex
CREATE INDEX "rooms_building_id_status_idx" ON "rooms"("building_id", "status");
