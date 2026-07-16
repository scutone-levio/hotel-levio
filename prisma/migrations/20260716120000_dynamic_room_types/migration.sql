-- Dynamic room types: replace RoomType enum with RoomTypeDefinition table.

CREATE TABLE "RoomTypeDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "beds" INTEGER NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomTypeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomTypeDefinition_slug_key" ON "RoomTypeDefinition"("slug");

INSERT INTO "RoomTypeDefinition" (
    "id", "slug", "name", "description", "capacity", "beds", "basePrice", "sortOrder", "isActive", "createdAt", "updatedAt"
) VALUES
    (
        'rtdef_seed_twin',
        'twin',
        'Twin Room',
        'A comfortable room with two single beds — ideal for friends or colleagues travelling together.',
        2, 2, 12900, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ),
    (
        'rtdef_seed_queen',
        'queen',
        'Queen Room',
        'A spacious room with two queen beds, comfortably sleeping up to four guests.',
        4, 2, 18900, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ),
    (
        'rtdef_seed_king',
        'king',
        'King Room',
        'An elegant room anchored by a plush king bed and a luxury walk-in shower.',
        2, 1, 22900, 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ),
    (
        'rtdef_seed_suite',
        'suite',
        'Suite',
        'A two-bedroom suite with two king beds, a separate living area, and a whirlpool bath.',
        4, 2, 39900, 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );

ALTER TABLE "Room" ADD COLUMN "roomTypeId" TEXT;
ALTER TABLE "Room" ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "Room" SET "roomTypeId" = 'rtdef_seed_twin' WHERE "type" = 'TWIN';
UPDATE "Room" SET "roomTypeId" = 'rtdef_seed_queen' WHERE "type" = 'QUEEN';
UPDATE "Room" SET "roomTypeId" = 'rtdef_seed_king' WHERE "type" = 'KING';
UPDATE "Room" SET "roomTypeId" = 'rtdef_seed_suite' WHERE "type" = 'SUITE';

ALTER TABLE "Room" ALTER COLUMN "roomTypeId" SET NOT NULL;

ALTER TABLE "RoomSubcategory" ADD COLUMN "roomTypeId" TEXT;
ALTER TABLE "RoomSubcategory" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "RoomSubcategory" SET "roomTypeId" = 'rtdef_seed_twin' WHERE "roomType" = 'TWIN';
UPDATE "RoomSubcategory" SET "roomTypeId" = 'rtdef_seed_queen' WHERE "roomType" = 'QUEEN';
UPDATE "RoomSubcategory" SET "roomTypeId" = 'rtdef_seed_king' WHERE "roomType" = 'KING';
UPDATE "RoomSubcategory" SET "roomTypeId" = 'rtdef_seed_suite' WHERE "roomType" = 'SUITE';

ALTER TABLE "RoomSubcategory" ALTER COLUMN "roomTypeId" SET NOT NULL;

ALTER TABLE "Booking" ADD COLUMN "roomTypeId" TEXT;

UPDATE "Booking" b
SET "roomTypeId" = r."roomTypeId"
FROM "Room" r
WHERE b."roomId" = r."id";

DROP INDEX IF EXISTS "Room_type_idx";
DROP INDEX IF EXISTS "RoomSubcategory_roomType_idx";
DROP INDEX IF EXISTS "RoomSubcategory_roomType_name_key";

ALTER TABLE "RoomSubcategory" DROP COLUMN "roomType";
ALTER TABLE "Room" DROP COLUMN "type";

DROP TYPE "RoomType";

-- Keep at most one active catalog room per room type.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "roomTypeId"
      ORDER BY CASE WHEN "archivedAt" IS NULL THEN 0 ELSE 1 END, "createdAt" ASC, id ASC
    ) AS rn
  FROM "Room"
  WHERE "isCatalog" = true
)
UPDATE "Room" r
SET "archivedAt" = COALESCE(r."archivedAt", CURRENT_TIMESTAMP)
FROM ranked
WHERE r.id = ranked.id AND ranked.rn > 1;

CREATE INDEX "Room_roomTypeId_idx" ON "Room"("roomTypeId");
CREATE INDEX "Room_archivedAt_idx" ON "Room"("archivedAt");
CREATE UNIQUE INDEX "Room_catalog_roomTypeId_key" ON "Room"("roomTypeId") WHERE "isCatalog" = true AND "archivedAt" IS NULL;
CREATE UNIQUE INDEX "RoomSubcategory_roomTypeId_name_key" ON "RoomSubcategory"("roomTypeId", "name");
CREATE INDEX "RoomSubcategory_roomTypeId_idx" ON "RoomSubcategory"("roomTypeId");
CREATE INDEX "Booking_roomTypeId_idx" ON "Booking"("roomTypeId");

ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomTypeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomSubcategory" ADD CONSTRAINT "RoomSubcategory_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomTypeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomTypeDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
