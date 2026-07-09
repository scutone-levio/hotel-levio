import {
  getCatalogRoomsForAdmin,
  getInventoryUnitsForAdmin,
  getAmenities,
  getInventoryByType,
  getAllSubcategories,
} from "@/lib/queries"
import { CatalogManager } from "@/components/admin/catalog-manager"
import { SubcategoriesManager } from "@/components/admin/subcategories-manager"

export const metadata = { title: "Room Type — Hôtel Levio Admin" }
export const dynamic = "force-dynamic"

export default async function AdminCatalogPage() {
  const [catalogRooms, inventoryUnits, amenities, inventory, subcategories] = await Promise.all([
    getCatalogRoomsForAdmin(),
    getInventoryUnitsForAdmin(),
    getAmenities(),
    getInventoryByType(),
    getAllSubcategories(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl tracking-tight">Room Type</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage room types, subcategories, and view their inventory units.
        </p>
      </div>

      {/* Subcategories section */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4">
          <h2 className="text-lg">Subcategories</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Create and manage room subcategories (e.g., Lower Level, City View) with independent pricing.
          </p>
        </div>
        <SubcategoriesManager initialSubcategories={subcategories} />
      </div>

      {/* Catalog manager section */}
      <div>
        <h2 className="text-lg mb-4">Room Types</h2>
        <CatalogManager
          catalogRooms={catalogRooms}
          inventoryUnits={inventoryUnits}
          allAmenities={amenities}
          inventory={inventory}
        />
      </div>
    </div>
  )
}
