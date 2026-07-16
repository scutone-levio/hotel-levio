import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  activeInventoryRoomFilter,
  activeSubcategoryFilter,
  getActiveRoomTypes,
  getAllRoomTypes,
} from "@/lib/room-types"
import { formatListingName, pickSimilarRooms } from "@/lib/rooms"
import {
  PUBLIC_SUBCATEGORY_NAMES,
  subcategorySortIndex,
} from "@/lib/subcategories"

const SUBCATEGORY_IMAGES_INCLUDE = { orderBy: { sortOrder: "asc" } } as const

const roomWithDetails = Prisma.validator<Prisma.RoomDefaultArgs>()({
  include: {
    roomType: true,
    images: { orderBy: { sortOrder: "asc" } },
    amenities: { orderBy: { name: "asc" } },
    priceRules: { orderBy: { dayOfWeek: "asc" } },
    blackouts: { orderBy: { startDate: "asc" } },
    nearbyPlaces: { orderBy: { category: "asc" } },
    subcategory: {
      include: {
        images: SUBCATEGORY_IMAGES_INCLUDE,
      },
    },
  },
})

export type RoomWithDetails = Prisma.RoomGetPayload<typeof roomWithDetails>

/** Catalog room merged with a public subcategory listing (homepage cards). */
export type PublicRoomListing = RoomWithDetails & {
  subcategory: NonNullable<RoomWithDetails["subcategory"]>
  featured: boolean
}

function withoutInventoryCount<T extends { _count: { rooms: number } }>(
  sub: T,
): Omit<T, "_count"> {
  const subcategory = { ...sub }
  delete (subcategory as Partial<T & { _count?: unknown }>)._count
  return subcategory as Omit<T, "_count">
}

function sortByRoomTypeOrder<T extends { roomTypeId: string }>(
  items: T[],
  typeOrder: Map<string, number>,
): T[] {
  return [...items].sort(
    (a, b) =>
      (typeOrder.get(a.roomTypeId) ?? 999) -
      (typeOrder.get(b.roomTypeId) ?? 999),
  )
}

export async function getCatalogRooms(): Promise<RoomWithDetails[]> {
  const [roomTypes, rooms] = await Promise.all([
    getActiveRoomTypes(),
    prisma.room.findMany({
      where: { isCatalog: true, archivedAt: null, roomType: { isActive: true } },
      ...roomWithDetails,
    }),
  ])

  const typeOrder = new Map(roomTypes.map((t) => [t.id, t.sortOrder]))
  return sortByRoomTypeOrder(rooms, typeOrder)
}

export function getCatalogRoomBySlug(
  slug: string,
  subcategoryId?: string,
): Promise<RoomWithDetails | null> {
  return prisma.room
    .findFirst({
      where: {
        slug,
        isCatalog: true,
        archivedAt: null,
        roomType: { isActive: true },
      },
      ...roomWithDetails,
    })
    .then(async (catalog) => {
      if (!catalog) return null
      if (!subcategoryId) return catalog

      const subcategory = await prisma.roomSubcategory.findFirst({
        where: {
          id: subcategoryId,
          roomTypeId: catalog.roomTypeId,
          isActive: true,
        },
        include: { images: SUBCATEGORY_IMAGES_INCLUDE },
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
  const activeInventoryWhere = activeInventoryRoomFilter()

  const [roomTypes, subcategories, catalogRooms] = await Promise.all([
    getActiveRoomTypes(),
    prisma.roomSubcategory.findMany({
      where: {
        name: { in: [...PUBLIC_SUBCATEGORY_NAMES] },
        ...activeSubcategoryFilter(),
      },
      include: {
        images: SUBCATEGORY_IMAGES_INCLUDE,
        _count: {
          select: {
            rooms: { where: activeInventoryWhere },
          },
        },
      },
    }),
    getCatalogRooms(),
  ])

  const typeOrder = new Map(roomTypes.map((t) => [t.id, t.sortOrder]))
  const catalogByTypeId = Object.fromEntries(
    catalogRooms.map((room) => [room.roomTypeId, room]),
  ) as Partial<Record<string, RoomWithDetails>>

  return subcategories
    .filter((sub) => sub._count.rooms > 0)
    .sort((a, b) => {
      const order =
        (typeOrder.get(a.roomTypeId) ?? 999) -
        (typeOrder.get(b.roomTypeId) ?? 999)
      if (order !== 0) return order
      return subcategorySortIndex(a.name) - subcategorySortIndex(b.name)
    })
    .flatMap((sub) => {
      const catalog = catalogByTypeId[sub.roomTypeId]
      if (!catalog) return []
      const subcategory = withoutInventoryCount(sub)
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

export function getCatalogRoomsForAdmin(): Promise<RoomWithDetails[]> {
  return prisma.room.findMany({
    where: { isCatalog: true, archivedAt: null },
    ...roomWithDetails,
    orderBy: [{ roomType: { sortOrder: "asc" } }, { name: "asc" }],
  })
}

export function getInventoryUnitsForAdmin(options?: {
  includeArchived?: boolean
}): Promise<RoomWithDetails[]> {
  return prisma.room.findMany({
    where: {
      isCatalog: false,
      ...(options?.includeArchived ? {} : { archivedAt: null }),
    },
    ...roomWithDetails,
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  })
}

export async function getInventoryByType() {
  const [roomTypes, rooms] = await Promise.all([
    getAllRoomTypes(true),
    // Not filtered by room-type isActive: archived types still need an
    // accurate inventory summary in the admin catalog manager.
    prisma.room.findMany({
      where: { isCatalog: false, archivedAt: null },
      select: { roomTypeId: true, roomNumber: true },
      orderBy: { roomNumber: "asc" },
    }),
  ])

  const result = {} as Record<
    string,
    { count: number; roomNumbers: string[] }
  >

  for (const type of roomTypes) {
    const numbers = rooms
      .filter((r) => r.roomTypeId === type.id)
      .map((r) => r.roomNumber)
    result[type.id] = {
      count: numbers.length,
      roomNumbers: numbers,
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

export function getCatalogRoomForType(roomTypeId: string) {
  return prisma.room.findFirst({
    where: {
      roomTypeId,
      isCatalog: true,
      archivedAt: null,
      roomType: { isActive: true },
    },
    ...roomWithDetails,
  })
}

export function getSubcategoriesByType(
  roomTypeId: string,
  options?: { includeArchived?: boolean },
) {
  return prisma.roomSubcategory.findMany({
    where: {
      roomTypeId,
      ...(options?.includeArchived ? {} : { isActive: true }),
    },
    include: {
      roomType: true,
      images: SUBCATEGORY_IMAGES_INCLUDE,
      _count: {
        select: { rooms: { where: { archivedAt: null, isCatalog: false } } },
      },
    },
    orderBy: { name: "asc" },
  })
}

export type RoomSubcategoryWithCount = Prisma.PromiseReturnType<
  typeof getSubcategoriesByType
>[number]

export async function getAllSubcategories(options?: {
  includeArchived?: boolean
}) {
  const roomTypes = await getActiveRoomTypes()
  const typeOrder = new Map(roomTypes.map((t) => [t.id, t.sortOrder]))

  const subcategories = await prisma.roomSubcategory.findMany({
    where: options?.includeArchived ? undefined : { isActive: true },
    include: {
      roomType: true,
      images: SUBCATEGORY_IMAGES_INCLUDE,
      _count: {
        select: { rooms: { where: { archivedAt: null, isCatalog: false } } },
      },
    },
  })

  return subcategories.sort((a, b) => {
    const order =
      (typeOrder.get(a.roomTypeId) ?? 999) - (typeOrder.get(b.roomTypeId) ?? 999)
    if (order !== 0) return order
    return a.name.localeCompare(b.name)
  })
}
