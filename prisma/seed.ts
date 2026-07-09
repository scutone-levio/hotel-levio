import { RoomType } from "@prisma/client"

import { prisma } from "../lib/prisma"
import {
  assignSubcategoryNamesForRooms,
  PUBLIC_SUBCATEGORY_NAMES,
  SEED_FEATURED_SUBCATEGORY_NAME,
  subcategoryPriceForType,
} from "../lib/subcategories"
import {
  CATALOG_ROOM_NUMBERS,
  DEFAULT_FLOOR_PLAN,
  catalogSlug,
  isCatalogRoomNumber,
} from "../lib/floor-plan"
import {
  catalogImagesByType,
  coverImageForType,
} from "../lib/room-type-images"

const nearbyPlacesByType: Record<
  RoomType,
  { name: string; category: string; distance: string }[]
> = {
  TWIN: [
    { name: "Old Port Montréal", category: "attraction", distance: "5 min walk" },
    { name: "Brasserie Levio", category: "restaurant", distance: "On-site" },
    { name: "STM Champ-de-Mars", category: "transport", distance: "3 min walk" },
    { name: "Marché Bonsecours", category: "attraction", distance: "8 min walk" },
  ],
  QUEEN: [
    { name: "Old Port Montréal", category: "attraction", distance: "5 min walk" },
    { name: "Brasserie Levio", category: "restaurant", distance: "On-site" },
    { name: "STM Champ-de-Mars", category: "transport", distance: "3 min walk" },
    { name: "Marché Bonsecours", category: "attraction", distance: "8 min walk" },
    { name: "L'Avenue Bistro", category: "restaurant", distance: "2 min walk" },
  ],
  KING: [
    { name: "Old Port Montréal", category: "attraction", distance: "5 min walk" },
    { name: "Brasserie Levio", category: "restaurant", distance: "On-site" },
    { name: "STM Champ-de-Mars", category: "transport", distance: "3 min walk" },
    { name: "Spa & Fitness Centre", category: "wellness", distance: "Floor 2" },
    { name: "Marché Bonsecours", category: "attraction", distance: "8 min walk" },
  ],
  SUITE: [
    { name: "Old Port Montréal", category: "attraction", distance: "5 min walk" },
    { name: "Brasserie Levio", category: "restaurant", distance: "On-site" },
    { name: "STM Champ-de-Mars", category: "transport", distance: "3 min walk" },
    { name: "Spa & Fitness Centre", category: "wellness", distance: "Floor 2" },
    { name: "Rooftop Lounge", category: "bar", distance: "Floor 12" },
    { name: "Marché Bonsecours", category: "attraction", distance: "8 min walk" },
  ],
}

const amenitiesByType: Record<RoomType, string[]> = {
  TWIN: [
    "Two single mattresses",
    "Free high-speed Wi-Fi",
    "Flat-screen television",
    "Writing desk with chair",
    "Mini-refrigerator",
    "In-room coffee maker",
    "Electronic laptop safe",
    "Private en-suite bathroom",
    "Complimentary basic toiletries",
    "Individual climate control",
  ],
  QUEEN: [
    "Two queen mattresses",
    "Free high-speed Wi-Fi",
    "Large flat-screen television",
    "Work desk with ergonomic chair",
    "Mini-refrigerator",
    "Microwave",
    "Premium coffee station",
    "Iron and ironing board",
    "Spacious full bathroom",
    "Hairdryer and toiletries",
  ],
  KING: [
    "One king mattress",
    "Free high-speed Wi-Fi",
    "Smart flat-screen television",
    "Sofa bed or armchair",
    "Executive work desk",
    "Mini-refrigerator",
    "Nespresso coffee machine",
    "Bathrobes and slippers",
    "Luxury walk-in shower",
    "Electronic safe",
  ],
  SUITE: [
    "Two king mattresses",
    "Separate living area",
    "Multiple smart televisions",
    "Free premium Wi-Fi",
    "Wet bar and kitchenette",
    "Full-sized refrigerator",
    "Dining table and chairs",
    "Luxury bathrobes and slippers",
    "Master bathroom with soaking tub",
    "Powder room for guests",
  ],
}

const roomTypeMeta: Record<
  RoomType,
  {
    label: string
    description: string
    basePrice: number
    capacity: number
    beds: number
    image: string
  }
> = {
  TWIN: {
    label: "Twin Room",
    description:
      "A comfortable room with two single beds — ideal for friends or colleagues travelling together.",
    basePrice: 12900,
    capacity: 2,
    beds: 2,
    image: coverImageForType("TWIN"),
  },
  QUEEN: {
    label: "Queen Room",
    description:
      "A spacious room with two queen beds, comfortably sleeping up to four guests.",
    basePrice: 18900,
    capacity: 4,
    beds: 2,
    image: coverImageForType("QUEEN"),
  },
  KING: {
    label: "King Room",
    description:
      "An elegant room anchored by a plush king bed and a luxury walk-in shower.",
    basePrice: 22900,
    capacity: 2,
    beds: 1,
    image: coverImageForType("KING"),
  },
  SUITE: {
    label: "Suite",
    description:
      "A two-bedroom suite with two king beds, a separate living area, and a whirlpool bath.",
    basePrice: 39900,
    capacity: 4,
    beds: 2,
    image: coverImageForType("SUITE"),
  },
}

async function ensureAmenities() {
  const amenityIdByName = new Map<string, string>()

  for (const [type, names] of Object.entries(amenitiesByType) as [
    RoomType,
    string[],
  ][]) {
    for (const name of names) {
      const amenity = await prisma.amenity.upsert({
        where: { name },
        create: { name, category: roomTypeMeta[type].label },
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

async function ensureInventory(amenityIdByName: Map<string, string>) {
  let created = 0
  let updated = 0

  for (const slot of DEFAULT_FLOOR_PLAN) {
    const meta = roomTypeMeta[slot.type]
    const amenityIds = amenitiesByType[slot.type].map((name) => ({
      id: amenityIdByName.get(name)!,
    }))
    const isCatalog = isCatalogRoomNumber(slot.type, slot.roomNumber)
    const slug = isCatalog ? catalogSlug(slot.type) : `room-${slot.roomNumber}`
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
          type: slot.type,
          isCatalog,
          slug: isCatalog ? catalogSlug(slot.type) : `room-${slot.roomNumber}`,
          name: isCatalog ? meta.label : `${meta.label} · ${slot.roomNumber}`,
        },
      })
      updated += 1
      continue
    }

    await prisma.room.create({
      data: {
        name,
        slug,
        description: meta.description,
        type: slot.type,
        basePrice: meta.basePrice,
        capacity: meta.capacity,
        beds: meta.beds,
        floor: slot.floor,
        roomNumber: slot.roomNumber,
        isCatalog,
        amenities: { connect: amenityIds },
        images: isCatalog
          ? {
              create: catalogImagesByType[slot.type].map((img, i) => ({
                url: img.url,
                sortOrder: i,
              })),
            }
          : undefined,
        priceRules: { create: weekendRules(meta.basePrice) },
      },
    })
    created += 1
  }

  for (const type of Object.keys(roomTypeMeta) as RoomType[]) {
    const catalogNumber = CATALOG_ROOM_NUMBERS[type]
    await prisma.room.updateMany({
      where: { type, isCatalog: true, NOT: { roomNumber: catalogNumber } },
      data: { isCatalog: false },
    })
    await prisma.room.updateMany({
      where: { roomNumber: catalogNumber },
      data: { isCatalog: true, slug: catalogSlug(type), name: roomTypeMeta[type].label },
    })
  }

  return { created, updated }
}

async function ensureCatalogImages() {
  let added = 0
  for (const type of Object.keys(roomTypeMeta) as RoomType[]) {
    const catalog = await prisma.room.findFirst({
      where: { type, isCatalog: true },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    })
    if (!catalog) continue

    const existingUrls = new Set(catalog.images.map((img) => img.url))
    let nextSortOrder =
      catalog.images.reduce((max, img) => Math.max(max, img.sortOrder), -1) + 1

    for (const img of catalogImagesByType[type]) {
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

const RETIRED_COFFEE_BEANS_URL =
  "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=1200&q=80"

/** Previously seeded URLs that returned 404 from Unsplash. */
const BROKEN_CATALOG_IMAGE_URLS = [
  "https://images.unsplash.com/photo-1591088397095-6934fac65a5a?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1578500136244-a842057b4051?auto=format&fit=crop&w=1200&q=80",
]

async function replaceRetiredCatalogImageUrls() {
  let replaced = 0
  for (const type of ["TWIN", "QUEEN"] as RoomType[]) {
    const catalog = await prisma.room.findFirst({
      where: { type, isCatalog: true },
      select: { id: true },
    })
    if (!catalog) continue

    const newUrl = catalogImagesByType[type][3].url
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
    select: { id: true, type: true },
  })
  let upserted = 0

  for (const room of rooms) {
    const places = nearbyPlacesByType[room.type] ?? []
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

  for (const type of Object.keys(roomTypeMeta) as RoomType[]) {
    for (const name of PUBLIC_SUBCATEGORY_NAMES) {
      const existing = await prisma.roomSubcategory.findFirst({
        where: { name, roomType: type },
      })

      if (!existing) {
        await prisma.roomSubcategory.create({
          data: {
            name,
            roomType: type,
            basePrice: subcategoryPriceForType(type, name),
            featured: name === SEED_FEATURED_SUBCATEGORY_NAME,
          },
        })
        created += 1
      } else if (
        existing.featured !== (name === SEED_FEATURED_SUBCATEGORY_NAME)
      ) {
        await prisma.roomSubcategory.update({
          where: { id: existing.id },
          data: { featured: name === SEED_FEATURED_SUBCATEGORY_NAME },
        })
      }
    }
  }

  const subcategoryIdByTypeAndName = new Map<string, string>()
  const allSubs = await prisma.roomSubcategory.findMany()
  for (const sub of allSubs) {
    subcategoryIdByTypeAndName.set(`${sub.roomType}:${sub.name}`, sub.id)
  }

  const inventoryRooms = await prisma.room.findMany({
    where: { isCatalog: false },
    select: { id: true, type: true, floor: true, roomNumber: true },
    orderBy: { roomNumber: "asc" },
  })

  const assignments = assignSubcategoryNamesForRooms(inventoryRooms)
  let assigned = 0
  const assignedByName: Record<string, number> = {}

  for (const { room, subcategoryName } of assignments) {
    const subcategoryId = subcategoryIdByTypeAndName.get(
      `${room.type}:${subcategoryName}`,
    )
    if (!subcategoryId) continue

    await prisma.room.update({
      where: { id: room.id },
      data: { subcategoryId },
    })
    assigned += 1
    assignedByName[subcategoryName] = (assignedByName[subcategoryName] ?? 0) + 1
  }

  return { created, assigned, assignedByName }
}

async function main() {
  console.log("🌱 Seeding database (non-destructive)…")

  const amenityIdByName = await ensureAmenities()
  console.log(`  • ${amenityIdByName.size} amenities ensured`)

  const { created, updated } = await ensureInventory(amenityIdByName)
  console.log(
    `  • Inventory synced (${created} created, ${updated} updated)`,
  )

  const imagesReplaced = await replaceRetiredCatalogImageUrls()
  if (imagesReplaced > 0) {
    console.log(`  • ${imagesReplaced} catalog image(s) replaced`)
  }

  const imagesAdded = await ensureCatalogImages()
  if (imagesAdded > 0) {
    console.log(`  • ${imagesAdded} catalog image(s) added`)
  }

  const inventoryTotal = await prisma.room.count()
  const catalogTotal = await prisma.room.count({ where: { isCatalog: true } })
  console.log(`  • ${inventoryTotal} inventory units · ${catalogTotal} catalog rooms`)

  const placesUpserted = await ensureNearbyPlaces()
  console.log(`  • ${placesUpserted} nearby place entries ensured`)

  const { created: subCreated, assigned: subAssigned, assignedByName } =
    await ensureSubcategories()
  if (subCreated > 0) {
    console.log(`  • ${subCreated} subcategory(ies) created`)
  }
  if (subAssigned > 0) {
    console.log(`  • ${subAssigned} room(s) assigned to subcategories`)
    for (const [name, count] of Object.entries(assignedByName)) {
      console.log(`    – ${name}: ${count}`)
    }
  }

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
