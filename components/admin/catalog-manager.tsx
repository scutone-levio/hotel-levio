"use client"

import * as React from "react"
import { toast } from "sonner"

import type { RoomWithDetails, AmenityWithCount } from "@/lib/queries"
import type { RoomTypeRecord } from "@/lib/room-types"
import { roomTypeTabLabel } from "@/lib/room-type-labels"
import { formatPrice } from "@/lib/rooms"
import { RoomManageDialog } from "@/components/admin/room-manage-dialog"
import { RoomTypeFormDialog } from "@/components/admin/room-type-form-dialog"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { usePaginatedList } from "@/components/admin/use-paginated-list"
import { syncTypeQuantityAction } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
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
  string,
  { count: number; roomNumbers: string[] }
>

export function CatalogManager({
  roomTypes,
  catalogRooms,
  inventoryUnits,
  allAmenities,
  inventory,
}: {
  roomTypes: RoomTypeRecord[]
  catalogRooms: RoomWithDetails[]
  inventoryUnits: RoomWithDetails[]
  allAmenities: AmenityWithCount[]
  inventory: InventorySummary
}) {
  const [showArchivedTypes, setShowArchivedTypes] = React.useState(false)
  const activeTypes = roomTypes.filter((t) => t.isActive)
  const archivedTypes = roomTypes.filter((t) => !t.isActive)
  const displayedTypes = showArchivedTypes ? archivedTypes : activeTypes
  const [activeTypeId, setActiveTypeId] = React.useState(
    () => activeTypes[0]?.id ?? "",
  )
  const [pending, startTransition] = React.useTransition()

  React.useEffect(() => {
    if (!displayedTypes.some((t) => t.id === activeTypeId)) {
      setActiveTypeId(displayedTypes[0]?.id ?? "")
    }
  }, [activeTypeId, displayedTypes])

  const activeType = displayedTypes.find((t) => t.id === activeTypeId)
  const catalog = catalogRooms.find((r) => r.roomTypeId === activeTypeId)
  const childRooms = inventoryUnits.filter((r) => r.roomTypeId === activeTypeId)
  const inventoryInfo = inventory[activeTypeId] ?? { count: 0, roomNumbers: [] }

  const {
    pageSize,
    currentPage,
    paginated: paginatedChildren,
    handlePageSizeChange,
    setPage,
  } = usePaginatedList(childRooms, { resetKey: activeTypeId })

  function saveQuantity(quantity: number) {
    if (!activeTypeId) return
    startTransition(async () => {
      const result = await syncTypeQuantityAction(activeTypeId, quantity)
      if (result.ok) {
        toast.success(
          `${activeType?.name ?? "Room type"} quantity updated`,
        )
        window.location.reload()
      } else toast.error(result.error)
    })
  }

  let catalogSection: React.ReactNode = null
  if (catalog) {
    catalogSection = (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>{catalog.name} — Room Type</CardTitle>
                <CardDescription className="mt-1 max-w-2xl">
                  {catalog.description}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeType ? (
                  <RoomTypeFormDialog mode="edit" roomType={activeType} />
                ) : null}
                <RoomManageDialog
                  room={catalog}
                  allAmenities={allAmenities}
                  defaultTab="images"
                  triggerVariant="blue"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <span>{formatPrice(catalog.basePrice)}/night</span>
            <span>{catalog.images.length} image(s)</span>
            <span>{catalog.amenities.length} amenities</span>
            <span>{inventoryInfo.count} inventory unit(s)</span>
            {!showArchivedTypes ? (
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`qty-${activeTypeId}`} className="text-xs">
                    Quantity
                  </Label>
                  <Input
                    id={`qty-${activeTypeId}`}
                    type="number"
                    min={0}
                    defaultValue={inventoryInfo.count}
                    key={inventoryInfo.count}
                    className="h-8 w-20"
                    disabled={pending}
                    onBlur={(e) => {
                      const raw = e.target.value.trim()
                      if (!/^\d+$/.test(raw)) return
                      const next = Number.parseInt(raw, 10)
                      if (next >= 0 && next !== inventoryInfo.count) {
                        saveQuantity(next)
                      }
                    }}
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
    )
  } else if (activeTypeId) {
    catalogSection = (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No catalog room for this type yet.
          </CardContent>
        </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!showArchivedTypes ? <RoomTypeFormDialog mode="create" /> : <span />}
        <div className="flex gap-1 rounded-lg border bg-white p-0.5">
          <Button
            type="button"
            variant={showArchivedTypes ? "ghost" : "default"}
            size="sm"
            onClick={() => setShowArchivedTypes(false)}
          >
            Active
          </Button>
          <Button
            type="button"
            variant={showArchivedTypes ? "default" : "ghost"}
            size="sm"
            onClick={() => setShowArchivedTypes(true)}
          >
            Archived
          </Button>
        </div>
      </div>

      {displayedTypes.length ? (
        <Tabs
          value={activeTypeId}
          onValueChange={setActiveTypeId}
        >
          <TabsList
            className="grid w-full bg-white"
            style={{
              gridTemplateColumns: `repeat(${displayedTypes.length}, minmax(0, 1fr))`,
            }}
          >
            {displayedTypes.map((type) => (
              <TabsTrigger
                key={type.id}
                value={type.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {roomTypeTabLabel(type)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : (
        <p className="text-muted-foreground text-sm">
          {showArchivedTypes
            ? "No archived room types."
            : "No active room types. Create one to get started."}
        </p>
      )}

      {catalogSection}

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
                        triggerVariant="blue"
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
