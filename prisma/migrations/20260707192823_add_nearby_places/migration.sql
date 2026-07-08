-- CreateTable
CREATE TABLE "NearbyPlace" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "distance" TEXT NOT NULL,

    CONSTRAINT "NearbyPlace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NearbyPlace_roomId_idx" ON "NearbyPlace"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "NearbyPlace_roomId_name_key" ON "NearbyPlace"("roomId", "name");

-- AddForeignKey
ALTER TABLE "NearbyPlace" ADD CONSTRAINT "NearbyPlace_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
