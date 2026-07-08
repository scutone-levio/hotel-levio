-- Room inventory fields (idempotent for environments synced via db push)
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "floor" INTEGER;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "roomNumber" TEXT;
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "isCatalog" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Room_roomNumber_key" ON "Room"("roomNumber");
CREATE INDEX IF NOT EXISTS "Room_type_idx" ON "Room"("type");
CREATE INDEX IF NOT EXISTS "Room_floor_idx" ON "Room"("floor");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Room" WHERE "roomNumber" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce unique room numbers: some rooms lack a room number. Run prisma db seed first.';
  END IF;
END $$;

ALTER TABLE "Room" ALTER COLUMN "roomNumber" SET NOT NULL;
