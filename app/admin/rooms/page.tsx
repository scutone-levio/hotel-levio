import {
  getInventoryUnitsForAdmin,
  getAmenities,
  getAllSubcategories,
} from "@/lib/queries"
import { getAllRoomTypes } from "@/lib/room-types"
import { InventoryManager } from "@/components/admin/inventory-manager"

export const metadata = { title: "Rooms — Hôtel Levio Admin" }
export const dynamic = "force-dynamic"

export default async function AdminRoomsPage() {
  const [roomTypes, subcategories, rooms, amenities] = await Promise.all([
    getAllRoomTypes(true),
    getAllSubcategories({ includeArchived: true }),
    getInventoryUnitsForAdmin({ includeArchived: true }),
    getAmenities(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl tracking-tight">Rooms</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage individual inventory units — room numbers, blackouts, and pricing.
        </p>
      </div>
      <InventoryManager
        roomTypes={roomTypes}
        subcategories={subcategories}
        rooms={rooms}
        allAmenities={amenities}
      />
    </div>
  )
}
