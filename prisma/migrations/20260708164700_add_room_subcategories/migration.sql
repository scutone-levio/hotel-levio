-- CreateTable RoomSubcategory
CREATE TABLE "RoomSubcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomType" "RoomType" NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomSubcategory_pkey" PRIMARY KEY ("id")
);

-- AddColumn subcategoryId to Room
ALTER TABLE "Room" ADD COLUMN "subcategoryId" TEXT;

-- CreateIndex on RoomSubcategory
CREATE UNIQUE INDEX "RoomSubcategory_roomType_name_key" ON "RoomSubcategory"("roomType", "name");
CREATE INDEX "RoomSubcategory_roomType_idx" ON "RoomSubcategory"("roomType");

-- CreateIndex on Room.subcategoryId
CREATE INDEX "Room_subcategoryId_idx" ON "Room"("subcategoryId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "RoomSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
