import { prisma } from "../lib/prisma"

async function main() {
  const types = await prisma.roomTypeDefinition.findMany({
    orderBy: { sortOrder: "asc" },
  })
  console.log("RoomTypeDefinitions:", types.length)
  for (const t of types) {
    console.log(`  - ${t.slug} (${t.id}) active=${t.isActive}`)
  }

  const roomsNoType = await prisma.$queryRaw<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM "Room" WHERE "roomTypeId" IS NULL
  `
  const roomsNoTypeCount = roomsNoType[0]?.c ?? 0
  console.log("Rooms missing roomTypeId:", roomsNoTypeCount)
  if (roomsNoTypeCount > 0) {
    throw new Error(`${roomsNoTypeCount} room(s) missing roomTypeId`)
  }

  const catalog = await prisma.room.findMany({
    where: { isCatalog: true },
    select: {
      slug: true,
      roomTypeId: true,
      roomType: { select: { slug: true, isActive: true } },
    },
  })
  console.log("Catalog rooms:", catalog.length)
  for (const c of catalog) {
    console.log(`  - ${c.slug} -> ${c.roomType.slug}`)
  }

  const typesWithoutCatalog = types.filter(
    (t) => !catalog.some((c) => c.roomTypeId === t.id),
  )
  if (typesWithoutCatalog.length) {
    console.log("Types missing catalog room:", typesWithoutCatalog.map((t) => t.slug))
    throw new Error(
      `${typesWithoutCatalog.length} room type(s) missing a catalog room`,
    )
  }

  const subs = await prisma.roomSubcategory.groupBy({
    by: ["roomTypeId"],
    _count: { _all: true },
  })
  console.log("Subcategories by type:", subs.length)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
