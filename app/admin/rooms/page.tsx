import { getInventoryUnitsForAdmin, getAmenities } from "@/lib/queries"
import { InventoryManager } from "@/components/admin/inventory-manager"

export const metadata = { title: "Rooms — Hôtel Levio Admin" }
export const dynamic = "force-dynamic"

export default async function AdminRoomsPage() {
  const [rooms, amenities] = await Promise.all([
    getInventoryUnitsForAdmin(),
    getAmenities(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage individual inventory units — room numbers, blackouts, and pricing.
        </p>
      </div>
      <InventoryManager rooms={rooms} allAmenities={amenities} />
    </div>
  )
}
