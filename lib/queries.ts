import { Prisma, RoomType } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { TYPE_TOTALS } from "@/lib/floor-plan"
import { inventoryRoomFilter } from "@/lib/inventory"
import { pickSimilarRooms, ROOM_TYPES } from "@/lib/rooms"

const roomWithDetails = Prisma.validator<Prisma.RoomDefaultArgs>()({
  include: {
    images: { orderBy: { sortOrder: "asc" } },
    amenities: { orderBy: { name: "asc" } },
    priceRules: { orderBy: { dayOfWeek: "asc" } },
    blackouts: { orderBy: { startDate: "asc" } },
    nearbyPlaces: { orderBy: { category: "asc" } },
  },
})

export type RoomWithDetails = Prisma.RoomGetPayload<typeof roomWithDetails>

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
): Promise<RoomWithDetails | null> {
  return prisma.room.findFirst({
    where: { slug, isCatalog: true },
    ...roomWithDetails,
  })
}

/** @deprecated Use getCatalogRooms for public pages. */
export function getRooms(): Promise<RoomWithDetails[]> {
  return getCatalogRooms()
}

/** @deprecated Use getCatalogRoomBySlug for public pages. */
export function getRoomBySlug(slug: string): Promise<RoomWithDetails | null> {
  return getCatalogRoomBySlug(slug)
}

export async function getSimilarRooms(
  room: RoomWithDetails,
  limit = 3,
): Promise<RoomWithDetails[]> {
  const others = await getCatalogRooms()
  return pickSimilarRooms(room, others, limit)
}

export function getRoomsForAdmin(): Promise<RoomForAdmin[]> {
  return getInventoryUnitsForAdmin()
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
