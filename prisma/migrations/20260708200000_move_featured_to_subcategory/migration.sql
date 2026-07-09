-- Add featured to subcategories
ALTER TABLE "RoomSubcategory" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

-- Copy catalog featured flags to the intended public subcategory only (Lake View per type)
UPDATE "RoomSubcategory" AS sub
SET "featured" = true
FROM "Room" AS catalog
WHERE catalog."isCatalog" = true
  AND catalog."featured" = true
  AND catalog."type" = sub."roomType"
  AND sub."name" = 'Lake View';

-- Remove featured from rooms
ALTER TABLE "Room" DROP COLUMN "featured";
