"use client"

import * as React from "react"
import type { RoomType } from "@prisma/client"
import { toast } from "sonner"

import type { RoomForAdmin, AmenityWithCount } from "@/lib/queries"
import { TYPE_TOTALS } from "@/lib/floor-plan"
import {
  ROOM_TYPE_LABELS,
  ROOM_TYPES,
  formatPrice,
} from "@/lib/rooms"
import { RoomManageDialog } from "@/components/admin/room-manage-dialog"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { usePaginatedList } from "@/components/admin/use-paginated-list"
import { syncTypeQuantityAction } from "@/app/admin/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type InventorySummary = Record<
  RoomType,
  { count: number; roomNumbers: string[]; total: number }
>

export function CatalogManager({
  catalogRooms,
  inventoryUnits,
  allAmenities,
  inventory,
}: {
  catalogRooms: RoomForAdmin[]
  inventoryUnits: RoomForAdmin[]
  allAmenities: AmenityWithCount[]
  inventory: InventorySummary
}) {
  const [activeType, setActiveType] = React.useState<RoomType>("TWIN")
  const [pending, startTransition] = React.useTransition()

  const catalog = catalogRooms.find((r) => r.type === activeType)
  const childRooms = inventoryUnits.filter((r) => r.type === activeType)
  const inventoryInfo = inventory[activeType]

  const {
    setPage,
    pageSize,
    currentPage,
    paginated: paginatedChildren,
    handlePageSizeChange,
  } = usePaginatedList(childRooms)

  React.useEffect(() => {
    setPage(1)
  }, [activeType, setPage])

  function saveQuantity(quantity: number) {
    startTransition(async () => {
      const result = await syncTypeQuantityAction(activeType, quantity)
      if (result.ok) toast.success(`${ROOM_TYPE_LABELS[activeType]} quantity updated`)
      else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={activeType}
        onValueChange={(v) => setActiveType(v as RoomType)}
      >
        <TabsList className="grid w-full grid-cols-4">
          {ROOM_TYPES.map((type) => (
            <TabsTrigger key={type} value={type}>
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {catalog ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>{catalog.name} — Room Type</CardTitle>
                <CardDescription className="mt-1 max-w-2xl">
                  {catalog.description}
                </CardDescription>
              </div>
              <RoomManageDialog
                room={catalog}
                allAmenities={allAmenities}
                defaultTab="images"
              />
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <span>{formatPrice(catalog.basePrice)}/night</span>
            <span>{catalog.images.length} image(s)</span>
            <span>{catalog.amenities.length} amenities</span>
            <span>{inventoryInfo.count} total units</span>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor={`qty-${activeType}`} className="text-xs">
                  Quantity
                </Label>
                <Input
                  id={`qty-${activeType}`}
                  type="number"
                  min={0}
                  defaultValue={inventoryInfo.count}
                  className="h-8 w-20"
                  disabled={pending}
                  onBlur={(e) => {
                    const next = Number.parseInt(e.target.value, 10)
                    if (Number.isFinite(next) && next !== inventoryInfo.count) {
                      saveQuantity(next)
                    }
                  }}
                />
              </div>
              <span className="text-muted-foreground pb-2 text-xs">
                of {TYPE_TOTALS[activeType]} slots
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg">
          Rooms in this category ({childRooms.length})
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[520px] text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Floor</th>
                <th className="px-3 py-2 font-medium">Room #</th>
                <th className="px-3 py-2 font-medium">Subcategory</th>
                <th className="px-3 py-2 font-medium">Base price</th>
                <th className="px-3 py-2 font-medium">Blackouts</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedChildren.length ? (
                paginatedChildren.map((room) => (
                  <tr key={room.id} className="bg-white border-b last:border-0">
                    <td className="px-3 py-2 text-sm">{room.floor ?? "—"}</td>
                    <td className="px-3 py-2 text-sm">{room.roomNumber}</td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">
                      {room.subcategory?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {formatPrice(room.basePrice)}
                    </td>
                    <td className="px-3 py-2 text-sm">{room.blackouts.length}</td>
                    <td className="px-3 py-2">
                      <RoomManageDialog
                        room={room}
                        allAmenities={allAmenities}
                        inventoryMode
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground px-3 py-8 text-center text-sm"
                  >
                    No inventory units for this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination
          page={currentPage}
          pageSize={pageSize}
          total={childRooms.length}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </section>
    </div>
  )
}
