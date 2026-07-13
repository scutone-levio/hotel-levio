import { Prisma, RoomType } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { TYPE_TOTALS } from "@/lib/floor-plan"
import { inventoryRoomFilter } from "@/lib/inventory"
import {
  formatListingName,
  pickSimilarRooms,
  ROOM_TYPES,
} from "@/lib/rooms"
import {
  PUBLIC_SUBCATEGORY_NAMES,
  subcategorySortIndex,
} from "@/lib/subcategories"

const roomWithDetails = Prisma.validator<Prisma.RoomDefaultArgs>()({
  include: {
    images: { orderBy: { sortOrder: "asc" } },
    amenities: { orderBy: { name: "asc" } },
    priceRules: { orderBy: { dayOfWeek: "asc" } },
    blackouts: { orderBy: { startDate: "asc" } },
    nearbyPlaces: { orderBy: { category: "asc" } },
    subcategory: true,
  },
})

export type RoomWithDetails = Prisma.RoomGetPayload<typeof roomWithDetails>

/** Catalog room merged with a public subcategory listing (homepage cards). */
export type PublicRoomListing = RoomWithDetails & {
  subcategory: NonNullable<RoomWithDetails["subcategory"]>
  featured: boolean
}

export type RoomForAdmin = RoomWithDetails

const catalogOrder: RoomType[] = ["TWIN", "QUEEN", "KING", "SUITE"]

export function getCatalogRooms(): Promise<RoomWithDetails[]> {
  return prisma.room.findMany({
    where: { isCatalog: true },
    ...roomWithDetails,
    orderBy: { type: "asc" },
  }).then((rooms) =>
    [...rooms].sort(
      (a, b) => catalogOrder.indexOf(a.type) - catalogOrder.indexOf(b.type),
    ),
  )
}

export function getCatalogRoomBySlug(
  slug: string,
  subcategoryId?: string,
): Promise<RoomWithDetails | null> {
  return prisma.room.findFirst({
    where: { slug, isCatalog: true },
    ...roomWithDetails,
  }).then(async (catalog) => {
    if (!catalog) return null
    if (!subcategoryId) return catalog

    const subcategory = await prisma.roomSubcategory.findFirst({
      where: { id: subcategoryId, roomType: catalog.type },
    })
    if (!subcategory) return catalog

    return {
      ...catalog,
      name: formatListingName(catalog.name, subcategory.name),
      subcategory,
    }
  })
}

/**
 * Public homepage listings: catalog room + subcategory per type.
 * Only includes subcategories that have at least one assigned inventory unit.
 */
export async function getPublicRoomListings(): Promise<PublicRoomListing[]> {
  const [subcategories, catalogRooms] = await Promise.all([
    prisma.roomSubcategory.findMany({
      where: { name: { in: [...PUBLIC_SUBCATEGORY_NAMES] } },
      include: {
        _count: {
          select: {
            rooms: { where: { isCatalog: false } },
          },
        },
      },
    }),
    getCatalogRooms(),
  ])

  const catalogByType = Object.fromEntries(
    catalogRooms.map((room) => [room.type, room]),
  ) as Partial<Record<RoomType, RoomWithDetails>>

  return subcategories
    .filter((sub) => sub._count.rooms > 0)
    .sort((a, b) => {
      const typeOrder =
        catalogOrder.indexOf(a.roomType) - catalogOrder.indexOf(b.roomType)
      if (typeOrder !== 0) return typeOrder
      return subcategorySortIndex(a.name) - subcategorySortIndex(b.name)
    })
    .flatMap((sub) => {
      const catalog = catalogByType[sub.roomType]
      if (!catalog) return []
      const { _count, ...subcategory } = sub
      void _count
      return [
        {
          ...catalog,
          name: formatListingName(catalog.name, sub.name),
          subcategory,
          featured: subcategory.featured,
        },
      ]
    })
}

function isSamePublicListing(
  current: RoomWithDetails,
  candidate: PublicRoomListing,
): boolean {
  if (current.id !== candidate.id) return false
  if (!current.subcategory?.id) return false
  return current.subcategory.id === candidate.subcategory.id
}

export async function getSimilarRooms(
  room: RoomWithDetails,
  limit = 3,
): Promise<PublicRoomListing[]> {
  const listings = await getPublicRoomListings()
  const candidates = listings.filter(
    (listing) => !isSamePublicListing(room, listing),
  )
  return pickSimilarRooms(room, candidates, limit)
}

export function getCatalogRoomsForAdmin(): Promise<RoomForAdmin[]> {
  return getCatalogRooms()
}

export function getInventoryUnitsForAdmin(): Promise<RoomForAdmin[]> {
  return prisma.room.findMany({
    where: { ...inventoryRoomFilter(), isCatalog: false },
    ...roomWithDetails,
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  })
}

export async function getInventoryByType() {
  const rooms = await prisma.room.findMany({
    where: inventoryRoomFilter(),
    select: { type: true, roomNumber: true },
    orderBy: { roomNumber: "asc" },
  })

  const result = {} as Record<
    RoomType,
    { count: number; roomNumbers: string[]; total: number }
  >

  for (const type of ROOM_TYPES) {
    const numbers = rooms.filter((r) => r.type === type).map((r) => r.roomNumber!)
    result[type] = {
      count: numbers.length,
      roomNumbers: numbers,
      total: TYPE_TOTALS[type],
    }
  }

  return result
}

export function getAmenities() {
  return prisma.amenity.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { rooms: true } } },
  })
}

export type AmenityWithCount = Prisma.PromiseReturnType<
  typeof getAmenities
>[number]

export function getCatalogRoomForType(type: RoomType) {
  return prisma.room.findFirst({
    where: { type, isCatalog: true },
    ...roomWithDetails,
  })
}

export function getSubcategoriesByType(roomType: RoomType) {
  return prisma.roomSubcategory.findMany({
    where: { roomType },
    include: { _count: { select: { rooms: true } } },
    orderBy: { name: "asc" },
  })
}

export type RoomSubcategoryWithCount = Prisma.PromiseReturnType<
  typeof getSubcategoriesByType
>[number]

export function getAllSubcategories() {
  return prisma.roomSubcategory.findMany({
    include: { _count: { select: { rooms: true } } },
    orderBy: [{ roomType: "asc" }, { name: "asc" }],
  })
}
