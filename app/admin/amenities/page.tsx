import { getAmenities } from "@/lib/queries"
import { AmenitiesManager } from "@/components/admin/amenities-manager"

export const metadata = { title: "Amenities — Hôtel Levio Admin" }
export const dynamic = "force-dynamic"

export default async function AdminAmenitiesPage() {
  const amenities = await getAmenities()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl tracking-tight">Amenities</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage the amenity catalog and assign them to rooms.
        </p>
      </div>
      <AmenitiesManager amenities={amenities} />
    </div>
  )
}
