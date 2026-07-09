-- Add featured to subcategories
ALTER TABLE "RoomSubcategory" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

-- Copy catalog room featured flags onto all subcategories of that room type
UPDATE "RoomSubcategory" AS sub
SET "featured" = true
FROM "Room" AS catalog
WHERE catalog."isCatalog" = true
  AND catalog."featured" = true
  AND catalog."type" = sub."roomType";

-- Remove featured from rooms
ALTER TABLE "Room" DROP COLUMN "featured";
