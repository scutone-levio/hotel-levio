-- CreateTable
CREATE TABLE "SubcategoryImage" (
    "id" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubcategoryImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubcategoryImage_subcategoryId_idx" ON "SubcategoryImage"("subcategoryId");

-- AddForeignKey
ALTER TABLE "SubcategoryImage" ADD CONSTRAINT "SubcategoryImage_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "RoomSubcategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
