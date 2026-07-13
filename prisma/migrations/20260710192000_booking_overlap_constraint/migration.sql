-- Create the extension needed for GiST indexes on text columns.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent overlapping confirmed or pending bookings for the same room.
ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_room_overlap_exclusion"
EXCLUDE USING gist (
  "roomId" WITH =,
  daterange("checkIn", "checkOut", '[)') WITH &&
)
WHERE ("status" IN ('PENDING', 'CONFIRMED'));
