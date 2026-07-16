import type { Prisma, RoomTypeDefinition } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export type RoomTypeRecord = RoomTypeDefinition

export {
  LEGACY_TYPE_SLUGS,
  roomTypeLabel,
  roomTypeShortLabel,
  roomTypeTabLabel,
} from "@/lib/room-type-labels"
export type { RoomTypeLabelInput } from "@/lib/room-type-labels"

export function activeRoomFilter(): Prisma.RoomWhereInput {
  return { archivedAt: null }
}

export function activeInventoryRoomFilter(): Prisma.RoomWhereInput {
  return {
    isCatalog: false,
    archivedAt: null,
    roomType: { isActive: true },
    OR: [{ subcategoryId: null }, { subcategory: { isActive: true } }],
  }
}

export function activeSubcategoryFilter(): Prisma.RoomSubcategoryWhereInput {
  return { isActive: true, roomType: { isActive: true } }
}

export function getActiveRoomTypes(): Promise<RoomTypeRecord[]> {
  return prisma.roomTypeDefinition.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
}

export function getAllRoomTypes(includeArchived = false): Promise<RoomTypeRecord[]> {
  return prisma.roomTypeDefinition.findMany({
    where: includeArchived ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
}

export function getRoomTypeById(id: string): Promise<RoomTypeRecord | null> {
  return prisma.roomTypeDefinition.findUnique({ where: { id } })
}

export function getRoomTypeBySlug(slug: string): Promise<RoomTypeRecord | null> {
  return prisma.roomTypeDefinition.findUnique({ where: { slug } })
}

export async function countActiveInventoryForType(roomTypeId: string): Promise<number> {
  return prisma.room.count({
    where: {
      roomTypeId,
      ...activeInventoryRoomFilter(),
    },
  })
}
