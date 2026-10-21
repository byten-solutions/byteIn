-- CreateIndex
CREATE INDEX IF NOT EXISTS "rooms_property_id_room_category_id_idx" ON "rooms"("property_id", "room_category_id");
