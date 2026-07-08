import {
  getCatalogRoomsForAdmin,
  getInventoryUnitsForAdmin,
  getAmenities,
  getInventoryByType,
} from "@/lib/queries"
import { CatalogManager } from "@/components/admin/catalog-manager"

export const metadata = { title: "Room Type — Hôtel Levio Admin" }
export const dynamic = "force-dynamic"

export default async function AdminCatalogPage() {
  const [catalogRooms, inventoryUnits, amenities, inventory] = await Promise.all([
    getCatalogRoomsForAdmin(),
    getInventoryUnitsForAdmin(),
    getAmenities(),
    getInventoryByType(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Room Type</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage room types and view their inventory units.
        </p>
      </div>
      <CatalogManager
        catalogRooms={catalogRooms}
        inventoryUnits={inventoryUnits}
        allAmenities={amenities}
        inventory={inventory}
      />
    </div>
  )
}
