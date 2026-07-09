import type { RoomType } from "@prisma/client"

export const LOWER_LEVEL_NAME = "Lower Level"
export const LAKE_VIEW_NAME = "Lake View"
export const CITY_VIEW_NAME = "City View"

/** Subcategory name seeded (and expected in tests) as featured. */
export const SEED_FEATURED_SUBCATEGORY_NAME = LAKE_VIEW_NAME

export const PUBLIC_SUBCATEGORY_NAMES = [
  LOWER_LEVEL_NAME,
  LAKE_VIEW_NAME,
  CITY_VIEW_NAME,
] as const

export type PublicSubcategoryName = (typeof PUBLIC_SUBCATEGORY_NAMES)[number]

const LOWER_LEVEL_PRICE = 11900

/** Catalog base prices per room type (cents). */
export const CATALOG_BASE_PRICES: Record<RoomType, number> = {
  TWIN: 12900,
  QUEEN: 18900,
  KING: 22900,
  SUITE: 39900,
}

export function subcategoryPriceForType(
  type: RoomType,
  name: string,
): number {
  if (name === LOWER_LEVEL_NAME) return LOWER_LEVEL_PRICE
  return CATALOG_BASE_PRICES[type]
}

/** Subcategory name for a non-catalog room based on floor and index within (type, floor). */
export function subcategoryNameForInventoryRoom(
  floor: number,
  indexOnFloor: number,
): PublicSubcategoryName {
  if (floor === 1) return LOWER_LEVEL_NAME
  return indexOnFloor % 2 === 0 ? LAKE_VIEW_NAME : CITY_VIEW_NAME
}

export function subcategorySortIndex(name: string): number {
  const idx = PUBLIC_SUBCATEGORY_NAMES.indexOf(name as PublicSubcategoryName)
  return idx === -1 ? PUBLIC_SUBCATEGORY_NAMES.length : idx
}

type InventoryRoomRef = {
  type: RoomType
  floor: number | null
  roomNumber: string
}

function typeFloorKey(type: RoomType, floor: number) {
  return `${type}:${floor}`
}

/** Group inventory rooms by (type, floor), sorted by roomNumber within each group. */
export function groupInventoryByTypeAndFloor<T extends InventoryRoomRef>(
  rooms: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>()

  for (const room of rooms) {
    const floor = room.floor ?? Number.parseInt(room.roomNumber.slice(0, -2), 10)
    const key = typeFloorKey(room.type, floor)
    const list = groups.get(key) ?? []
    list.push(room)
    groups.set(key, list)
  }

  for (const list of groups.values()) {
    list.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber))
  }

  return groups
}

/** Resolve subcategory name for each room in grouped inventory. */
export function assignSubcategoryNamesForRooms<T extends InventoryRoomRef>(
  rooms: T[],
): Array<{ room: T; subcategoryName: PublicSubcategoryName }> {
  const groups = groupInventoryByTypeAndFloor(rooms)
  const result: Array<{ room: T; subcategoryName: PublicSubcategoryName }> = []

  for (const list of groups.values()) {
    list.forEach((room, index) => {
      const floor = room.floor ?? Number.parseInt(room.roomNumber.slice(0, -2), 10)
      result.push({
        room,
        subcategoryName: subcategoryNameForInventoryRoom(floor, index),
      })
    })
  }

  return result
}
