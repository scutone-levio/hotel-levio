"use client"

import * as React from "react"
import type { RoomType } from "@prisma/client"
import { toast } from "sonner"

import type { RoomForAdmin, AmenityWithCount } from "@/lib/queries"
import {
  ROOM_TYPE_LABELS,
  ROOM_TYPES,
  formatPrice,
} from "@/lib/rooms"
import { RoomManageDialog } from "@/components/admin/room-manage-dialog"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { usePaginatedList } from "@/components/admin/use-paginated-list"
import { updateRoomInventoryAction } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TypeFilter = RoomType | "ALL"

export function InventoryManager({
  rooms,
  allAmenities,
}: {
  rooms: RoomForAdmin[]
  allAmenities: AmenityWithCount[]
}) {
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("ALL")

  const filtered = React.useMemo(() => {
    if (typeFilter === "ALL") return rooms
    return rooms.filter((r) => r.type === typeFilter)
  }, [rooms, typeFilter])

  const {
    setPage,
    pageSize,
    currentPage,
    paginated,
    handlePageSizeChange,
  } = usePaginatedList(filtered)

  React.useEffect(() => {
    setPage(1)
  }, [typeFilter, setPage])

  const filterLabel =
    typeFilter === "ALL"
      ? `${filtered.length} rooms`
      : `${filtered.length} ${typeFilter.toLowerCase()} room${filtered.length === 1 ? "" : "s"}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{filterLabel}</p>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as TypeFilter)}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {ROOM_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {ROOM_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Floor</th>
              <th className="px-3 py-2 font-medium">Room #</th>
              <th className="px-3 py-2 font-medium">Room Type</th>
              <th className="px-3 py-2 font-medium">Base price</th>
              <th className="px-3 py-2 font-medium">Blackouts</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length ? (
              paginated.map((room) => (
                <InventoryRow
                  key={room.id}
                  room={room}
                  allAmenities={allAmenities}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground px-3 py-8 text-center text-sm"
                >
                  No rooms match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        page={currentPage}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}

function InventoryRow({
  room,
  allAmenities,
}: {
  room: RoomForAdmin
  allAmenities: AmenityWithCount[]
}) {
  const [roomNumber, setRoomNumber] = React.useState(room.roomNumber ?? "")
  const [type, setType] = React.useState<RoomType>(room.type)
  const [pending, startTransition] = React.useTransition()

  function saveInventory() {
    const normalized = roomNumber.trim()
    if (!normalized) {
      toast.error("Room number is required")
      return
    }
    startTransition(async () => {
      const result = await updateRoomInventoryAction(room.id, {
        roomNumber: normalized,
        type,
      })
      if (result.ok) {
        setRoomNumber(normalized)
        toast.success("Room updated")
      } else toast.error(result.error)
    })
  }

  return (
    <tr className="bg-white border-b last:border-0">
      <td className="px-3 py-2 text-sm">{room.floor ?? "—"}</td>
      <td className="px-3 py-2">
        <Input
          value={roomNumber}
          onChange={(e) => setRoomNumber(e.target.value)}
          className="h-8 w-20 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <Select value={type} onValueChange={(v) => setType(v as RoomType)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROOM_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {ROOM_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2 text-sm">{formatPrice(room.basePrice)}</td>
      <td className="px-3 py-2 text-sm">{room.blackouts.length}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={saveInventory}
          >
            Save
          </Button>
          <RoomManageDialog
            room={room}
            allAmenities={allAmenities}
            inventoryMode
          />
        </div>
      </td>
    </tr>
  )
}
