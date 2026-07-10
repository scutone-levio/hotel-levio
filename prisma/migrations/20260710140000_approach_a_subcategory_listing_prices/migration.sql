-- AlterTable
ALTER TABLE "RoomSubcategory" ADD COLUMN "fromPriceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RoomSubcategory" ADD COLUMN "hasWeekendRates" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "subcategoryId" TEXT;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "RoomSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- ValidateForeignKey
ALTER TABLE "Booking" VALIDATE CONSTRAINT "Booking_subcategoryId_fkey";

-- Backfill fromPriceCents and hasWeekendRates for existing RoomSubcategory rows
UPDATE "RoomSubcategory" rs SET
  "fromPriceCents" = COALESCE(
    (SELECT MIN(nightly_rate) FROM (
      SELECT r."basePrice" as nightly_rate
      FROM "Room" r
      WHERE r."subcategoryId" = rs.id AND r."isCatalog" = false
      UNION ALL
      SELECT rpr."price" as nightly_rate
      FROM "RoomPriceRule" rpr
      INNER JOIN "Room" r ON rpr."roomId" = r.id
      WHERE r."subcategoryId" = rs.id AND r."isCatalog" = false
    ) rates),
    0
  ),
  "hasWeekendRates" = EXISTS(
    SELECT 1
    FROM "RoomPriceRule" rpr
    INNER JOIN "Room" r ON rpr."roomId" = r.id
    WHERE r."subcategoryId" = rs.id AND r."isCatalog" = false AND rpr."price" > r."basePrice"
  );
