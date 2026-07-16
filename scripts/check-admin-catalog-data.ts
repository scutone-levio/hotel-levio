import {
  getCatalogRoomsForAdmin,
  getInventoryUnitsForAdmin,
  getInventoryByType,
  getAllSubcategories,
  type RoomWithDetails,
  type RoomSubcategoryWithCount,
} from "../lib/queries"
import { getAllRoomTypes, type RoomTypeRecord } from "../lib/room-types"

function collectViolations(
  roomTypes: RoomTypeRecord[],
  catalogRooms: RoomWithDetails[],
  inventory: Awaited<ReturnType<typeof getInventoryByType>>,
  subcategories: RoomSubcategoryWithCount[],
): string[] {
  const violations: string[] = []

  for (const type of roomTypes) {
    const catalog = catalogRooms.find((r) => r.roomTypeId === type.id)
    if (!catalog) {
      violations.push(`type "${type.slug}" has no catalog room`)
    }
    if (!inventory[type.id] && type.isActive) {
      console.warn(`  WARN: active type "${type.slug}" missing from inventory summary`)
    }
  }

  for (const room of catalogRooms) {
    if (!room.roomType) {
      violations.push(`Catalog room ${room.slug} missing roomType relation`)
    }
  }

  for (const sub of subcategories) {
    if (!sub.roomType) {
      violations.push(`Subcategory ${sub.name} missing roomType relation`)
    }
  }

  return violations
}

async function main() {
  const [
    roomTypes,
    catalogRooms,
    inventoryUnits,
    inventory,
    subcategories,
  ] = await Promise.all([
    getAllRoomTypes(true),
    getCatalogRoomsForAdmin(),
    getInventoryUnitsForAdmin(),
    getInventoryByType(),
    getAllSubcategories({ includeArchived: true }),
  ])

  const violations = collectViolations(
    roomTypes,
    catalogRooms,
    inventory,
    subcategories,
  )

  if (violations.length) {
    console.error("Admin catalog data has violations:")
    for (const v of violations) console.error("  -", v)
    throw new Error(`${violations.length} violation(s) found`)
  }

  console.log("Admin catalog data OK:")
  console.log("  roomTypes:", roomTypes.length)
  console.log("  catalogRooms:", catalogRooms.length)
  console.log("  inventoryUnits:", inventoryUnits.length)
  console.log("  subcategories:", subcategories.length)
  console.log("  inventory by type keys:", Object.keys(inventory).length)
}

main()
  .catch((e) => {
    console.error("Admin catalog fetch failed:", e)
    process.exit(1)
  })
