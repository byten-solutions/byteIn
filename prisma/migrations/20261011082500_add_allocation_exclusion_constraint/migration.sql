-- Enable btree_gist extension for combining UUID/TEXT with daterange in gist index
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Enforce zero-overlapping active allocations at the PostgreSQL storage engine level
ALTER TABLE "reservation_rooms"
ADD CONSTRAINT "no_overlapping_active_allocations"
EXCLUDE USING gist (
  "room_id" WITH =,
  daterange("arrival_date", "departure_date", '[)') WITH &&
)
WHERE ("status" IN ('CONFIRMED', 'CHECKED_IN'));
