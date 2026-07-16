import { Role } from "@prisma/client"
import { addDays, startOfDay } from "date-fns"

import { prisma } from "../lib/prisma"
import { hashPassword } from "../lib/password"
import {
  assignSubcategoryNamesForRooms,
  PUBLIC_SUBCATEGORY_NAMES,
  SEED_FEATURED_SUBCATEGORY_NAME,
  subcategoryPriceForType,
} from "../lib/subcategories"
import {
  deleteOrphanSubcategories,
  recomputeAllSubcategoryPricing,
  syncMismatchedInventoryBases,
} from "../lib/subcategory-pricing"
import { CATALOG_ROOM_NUMBERS, isCatalogRoomNumber } from "../lib/floor-plan"
import { catalogImagesByType } from "../lib/room-type-images"
import { kingSubcategoryImagesByName } from "../lib/king-subcategory-images"
import { queenSubcategoryImagesByName } from "../lib/queen-subcategory-images"
import { suiteSubcategoryImagesByName } from "../lib/suite-subcategory-images"
import { twinSubcategoryImagesByName } from "../lib/twin-subcategory-images"
import {
  amenitiesByType,
  buildSeedFloorPlan,
  nearbyPlacesByType,
  roomTypeMeta,
  SEED_TYPE_IDS,
  SEED_TYPE_SLUGS,
  type SeedTypeSlug,
} from "../lib/seed-types"

const DEFAULT_FLOOR_PLAN = buildSeedFloorPlan()

async function ensureRoomTypeDefinitions() {
  for (const [index, slug] of SEED_TYPE_SLUGS.entries()) {
    const meta = roomTypeMeta[slug]
    await prisma.roomTypeDefinition.upsert({
      where: { id: SEED_TYPE_IDS[slug] },
      create: {
        id: SEED_TYPE_IDS[slug],
        slug,
        name: meta.label,
        description: meta.description,
        capacity: meta.capacity,
        beds: meta.beds,
        basePrice: meta.basePrice,
        sortOrder: index,
        isActive: true,
      },
      update: {},
    })
  }
}

async function ensureAmenities() {
  const amenityIdByName = new Map<string, string>()

  for (const slug of SEED_TYPE_SLUGS) {
    for (const name of amenitiesByType[slug]) {
      const amenity = await prisma.amenity.upsert({
        where: { name },
        create: { name, category: roomTypeMeta[slug].label },
        update: {},
      })
      amenityIdByName.set(name, amenity.id)
    }
  }

  return amenityIdByName
}

function weekendRules(basePrice: number) {
  return [
    { dayOfWeek: 5, price: Math.round(basePrice * 1.25) },
    { dayOfWeek: 6, price: Math.round(basePrice * 1.25) },
  ]
}

async function upsertFloorPlanSlot(
  slot: (typeof DEFAULT_FLOOR_PLAN)[number],
  amenityIdByName: Map<string, string>,
): Promise<"created" | "updated"> {
  const meta = roomTypeMeta[slot.slug]
  const amenityIds = amenitiesByType[slot.slug].map((name) => ({
    id: amenityIdByName.get(name)!,
  }))
  const isCatalog = isCatalogRoomNumber(slot.slug, slot.roomNumber)
  const slug = isCatalog ? slot.slug : `room-${slot.roomNumber}`
  const name = isCatalog ? meta.label : `${meta.label} · ${slot.roomNumber}`

  const existing = await prisma.room.findUnique({
    where: { roomNumber: slot.roomNumber },
  })

  if (existing) {
    await prisma.room.update({
      where: { id: existing.id },
      data: {
        floor: slot.floor,
        roomNumber: slot.roomNumber,
        roomTypeId: slot.roomTypeId,
        isCatalog,
        slug,
        name,
      },
    })
    return "updated"
  }

  await prisma.room.create({
    data: {
      name,
      slug,
      description: meta.description,
      roomTypeId: slot.roomTypeId,
      basePrice: meta.basePrice,
      capacity: meta.capacity,
      beds: meta.beds,
      floor: slot.floor,
      roomNumber: slot.roomNumber,
      isCatalog,
      amenities: { connect: amenityIds },
      images: isCatalog
        ? {
            create: catalogImagesByType[slot.slug].map((img, i) => ({
              url: img.url,
              sortOrder: i,
            })),
          }
        : undefined,
      priceRules: { create: weekendRules(meta.basePrice) },
    },
  })
  return "created"
}

async function ensureInventory(amenityIdByName: Map<string, string>) {
  let created = 0
  let updated = 0

  await ensureRoomTypeDefinitions()

  for (const slot of DEFAULT_FLOOR_PLAN) {
    const result = await upsertFloorPlanSlot(slot, amenityIdByName)
    if (result === "created") created += 1
    else updated += 1
  }

  for (const slug of SEED_TYPE_SLUGS) {
    const roomTypeId = SEED_TYPE_IDS[slug]
    const catalogNumber = CATALOG_ROOM_NUMBERS[slug]
    await prisma.room.updateMany({
      where: { roomTypeId, isCatalog: true, NOT: { roomNumber: catalogNumber } },
      data: { isCatalog: false },
    })
    await prisma.room.updateMany({
      where: { roomNumber: catalogNumber },
      data: {
        isCatalog: true,
        slug,
        name: roomTypeMeta[slug].label,
        roomTypeId,
      },
    })
  }

  return { created, updated }
}

async function ensureCatalogImages() {
  let added = 0
  for (const slug of SEED_TYPE_SLUGS) {
    const catalog = await prisma.room.findFirst({
      where: { roomTypeId: SEED_TYPE_IDS[slug], isCatalog: true },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    })
    if (!catalog) continue

    const existingUrls = new Set(catalog.images.map((img) => img.url))
    let nextSortOrder =
      catalog.images.reduce((max, img) => Math.max(max, img.sortOrder), -1) + 1

    for (const img of catalogImagesByType[slug]) {
      if (existingUrls.has(img.url)) continue
      await prisma.roomImage.create({
        data: {
          roomId: catalog.id,
          url: img.url,
          sortOrder: nextSortOrder,
        },
      })
      nextSortOrder += 1
      added += 1
    }
  }
  return added
}

async function ensureSubcategoryImagesForType(
  slug: SeedTypeSlug,
  imagesByName: Record<
    (typeof PUBLIC_SUBCATEGORY_NAMES)[number],
    { url: string; caption: string }[]
  >,
) {
  let seeded = 0
  const roomTypeId = SEED_TYPE_IDS[slug]
  for (const name of PUBLIC_SUBCATEGORY_NAMES) {
    const images = imagesByName[name]
    const subcategory = await prisma.roomSubcategory.findUnique({
      where: { roomTypeId_name: { roomTypeId, name } },
      select: { id: true, _count: { select: { images: true } } },
    })
    if (!subcategory || subcategory._count.images > 0) continue

    await prisma.$transaction(
      images.map((img, sortOrder) =>
        prisma.subcategoryImage.create({
          data: {
            subcategoryId: subcategory.id,
            url: img.url,
            sortOrder,
          },
        }),
      ),
    )
    seeded += 1
  }
  return seeded
}

async function ensureTwinSubcategoryImages() {
  return ensureSubcategoryImagesForType("twin", twinSubcategoryImagesByName)
}

async function ensureQueenSubcategoryImages() {
  return ensureSubcategoryImagesForType("queen", queenSubcategoryImagesByName)
}

async function ensureKingSubcategoryImages() {
  return ensureSubcategoryImagesForType("king", kingSubcategoryImagesByName)
}

async function ensureSuiteSubcategoryImages() {
  return ensureSubcategoryImagesForType("suite", suiteSubcategoryImagesByName)
}

const RETIRED_COFFEE_BEANS_URL =
  "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=1200&q=80"

const BROKEN_CATALOG_IMAGE_URLS = [
  "https://images.unsplash.com/photo-1591088397095-6934fac65a5a?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1578500136244-a842057b4051?auto=format&fit=crop&w=1200&q=80",
]

async function replaceRetiredCatalogImageUrls() {
  let replaced = 0
  for (const slug of ["twin", "queen"] as SeedTypeSlug[]) {
    const catalog = await prisma.room.findFirst({
      where: { roomTypeId: SEED_TYPE_IDS[slug], isCatalog: true },
      select: { id: true },
    })
    if (!catalog) continue

    const newUrl = catalogImagesByType[slug][3].url
    const staleUrls = [RETIRED_COFFEE_BEANS_URL, ...BROKEN_CATALOG_IMAGE_URLS]

    const result = await prisma.roomImage.updateMany({
      where: { roomId: catalog.id, url: { in: staleUrls } },
      data: { url: newUrl },
    })
    replaced += result.count
  }
  return replaced
}

async function ensureNearbyPlaces() {
  const rooms = await prisma.room.findMany({
    where: { isCatalog: true },
    select: { id: true, roomType: { select: { slug: true } } },
  })
  let upserted = 0

  for (const room of rooms) {
    const places = nearbyPlacesByType[room.roomType.slug as SeedTypeSlug] ?? []
    for (const place of places) {
      await prisma.nearbyPlace.upsert({
        where: { roomId_name: { roomId: room.id, name: place.name } },
        create: { roomId: room.id, ...place },
        update: {},
      })
      upserted += 1
    }
  }

  return upserted
}

async function ensureSubcategories() {
  let created = 0

  for (const slug of SEED_TYPE_SLUGS) {
    const roomTypeId = SEED_TYPE_IDS[slug]
    const typeBasePrice = roomTypeMeta[slug].basePrice
    for (const name of PUBLIC_SUBCATEGORY_NAMES) {
      const basePrice = subcategoryPriceForType(typeBasePrice, name)
      const featured = name === SEED_FEATURED_SUBCATEGORY_NAME

      const before = await prisma.roomSubcategory.findUnique({
        where: { roomTypeId_name: { roomTypeId, name } },
        select: { id: true },
      })

      await prisma.roomSubcategory.upsert({
        where: { roomTypeId_name: { roomTypeId, name } },
        create: {
          name,
          roomTypeId,
          basePrice,
          featured,
          fromPriceCents: basePrice,
          isActive: true,
        },
        update: { basePrice, featured },
      })

      if (!before) created += 1
    }
  }

  const subcategoryIdByTypeAndName = new Map<string, string>()
  const allSubs = await prisma.roomSubcategory.findMany()
  for (const sub of allSubs) {
    subcategoryIdByTypeAndName.set(`${sub.roomTypeId}:${sub.name}`, sub.id)
  }

  const inventoryRooms = await prisma.room.findMany({
    where: { isCatalog: false, archivedAt: null },
    select: { id: true, roomTypeId: true, floor: true, roomNumber: true },
    orderBy: { roomNumber: "asc" },
  })

  const assignments = assignSubcategoryNamesForRooms(inventoryRooms)
  let assigned = 0
  const assignedByName: Record<string, number> = {}

  for (const { room, subcategoryName } of assignments) {
    const subcategoryId = subcategoryIdByTypeAndName.get(
      `${room.roomTypeId}:${subcategoryName}`,
    )
    if (!subcategoryId) continue

    await prisma.room.update({
      where: { id: room.id },
      data: { subcategoryId },
    })
    assigned += 1
    assignedByName[subcategoryName] = (assignedByName[subcategoryName] ?? 0) + 1
  }

  const basesSynced = await syncMismatchedInventoryBases()
  const orphansDeleted = await deleteOrphanSubcategories()
  await recomputeAllSubcategoryPricing()

  return { created, assigned, assignedByName, basesSynced, orphansDeleted }
}

async function ensureUsers() {
  const passwordHash = await hashPassword("password123")

  const admin = await prisma.user.upsert({
    where: { email: "admin@hotel.test" },
    update: {
      name: "Hotel Admin",
    },
    create: {
      email: "admin@hotel.test",
      name: "Hotel Admin",
      password: passwordHash,
      role: Role.ADMIN,
    },
  })

  const customer = await prisma.user.upsert({
    where: { email: "customer@hotel.test" },
    update: {
      name: "Demo Customer",
      phone: "+1 (514) 555-0199",
      addressLine1: "100 Rue de la Commune",
      city: "Montréal",
      province: "QC",
      postalCode: "H2Y 0B7",
      country: "CA",
    },
    create: {
      email: "customer@hotel.test",
      name: "Demo Customer",
      password: passwordHash,
      role: Role.CUSTOMER,
      phone: "+1 (514) 555-0199",
      addressLine1: "100 Rue de la Commune",
      city: "Montréal",
      province: "QC",
      postalCode: "H2Y 0B7",
      country: "CA",
    },
  })

  const hasBooking = await prisma.booking.findFirst({
    where: { userId: customer.id },
    select: { id: true },
  })
  if (!hasBooking) {
    const checkIn = startOfDay(addDays(new Date(), 14))
    const checkOut = startOfDay(addDays(new Date(), 16))

    const candidates = await prisma.room.findMany({
      where: { isCatalog: false, archivedAt: null },
      orderBy: { roomNumber: "asc" },
    })
    const overlapping = await prisma.booking.findMany({
      where: {
        roomId: { in: candidates.map((room) => room.id) },
        status: { in: ["PENDING", "CONFIRMED"] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { roomId: true },
    })
    const bookedRoomIds = new Set(overlapping.map((b) => b.roomId))
    const unit = candidates.find((room) => !bookedRoomIds.has(room.id))

    if (unit) {
      await prisma.booking.create({
        data: {
          userId: customer.id,
          roomId: unit.id,
          roomTypeId: unit.roomTypeId,
          subcategoryId: unit.subcategoryId,
          checkIn,
          checkOut,
          guests: 2,
          totalPrice: unit.basePrice * 2,
          status: "CONFIRMED",
          guestName: customer.name,
          guestEmail: customer.email,
          guestPhone: customer.phone,
        },
      })
    }
  }

  return { admin, customer }
}

async function main() {
  console.log("🌱 Seeding database (non-destructive)…")

  const amenityIdByName = await ensureAmenities()
  console.log(`  • ${amenityIdByName.size} amenities ensured`)

  const { created, updated } = await ensureInventory(amenityIdByName)
  console.log(`  • Inventory synced (${created} created, ${updated} updated)`)

  const imagesReplaced = await replaceRetiredCatalogImageUrls()
  if (imagesReplaced > 0) {
    console.log(`  • ${imagesReplaced} catalog image(s) replaced`)
  }

  const imagesAdded = await ensureCatalogImages()
  if (imagesAdded > 0) {
    console.log(`  • ${imagesAdded} catalog image(s) added`)
  }

  const nearbyUpserted = await ensureNearbyPlaces()
  console.log(`  • ${nearbyUpserted} nearby places ensured`)

  const subResult = await ensureSubcategories()
  console.log(
    `  • Subcategories: ${subResult.created} created, ${subResult.assigned} rooms assigned`,
  )
  if (subResult.basesSynced > 0) {
    console.log(`  • ${subResult.basesSynced} inventory base price(s) synced`)
  }
  if (subResult.orphansDeleted > 0) {
    console.log(`  • ${subResult.orphansDeleted} orphan subcategory(ies) removed`)
  }

  const twinSubGalleries = await ensureTwinSubcategoryImages()
  if (twinSubGalleries > 0) {
    console.log(
      `  • ${twinSubGalleries} Twin subcategory galleries seeded (Lake View, City View, Lower Level)`,
    )
  }

  const queenSubGalleries = await ensureQueenSubcategoryImages()
  if (queenSubGalleries > 0) {
    console.log(
      `  • ${queenSubGalleries} Queen subcategory galleries seeded (Lake View, City View, Lower Level)`,
    )
  }

  const kingSubGalleries = await ensureKingSubcategoryImages()
  if (kingSubGalleries > 0) {
    console.log(
      `  • ${kingSubGalleries} King subcategory galleries seeded (Lake View, City View, Lower Level)`,
    )
  }

  const suiteSubGalleries = await ensureSuiteSubcategoryImages()
  if (suiteSubGalleries > 0) {
    console.log(
      `  • ${suiteSubGalleries} Suite subcategory galleries seeded (Lake View, City View, Lower Level)`,
    )
  }

  const { admin, customer } = await ensureUsers()
  console.log(`  • Users: ${admin.email}, ${customer.email}`)

  const catalogTotal = await prisma.room.count({ where: { isCatalog: true } })
  const inventoryTotal = await prisma.room.count({
    where: { isCatalog: false, archivedAt: null },
  })
  console.log(
    `  • Totals: ${catalogTotal} catalog room(s), ${inventoryTotal} inventory unit(s)`,
  )

  console.log("✅ Seed complete.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
