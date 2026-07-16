"use client"

import * as React from "react"
import { toast } from "sonner"

import type { RoomWithDetails, AmenityWithCount, RoomSubcategoryWithCount } from "@/lib/queries"
import type { RoomTypeRecord } from "@/lib/room-types"
import { roomTypeLabel } from "@/lib/room-type-labels"
import { formatPrice } from "@/lib/rooms"
import { pluralLabel, pluralize } from "@/lib/utils"
import { RoomManageDialog } from "@/components/admin/room-manage-dialog"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { usePaginatedList } from "@/components/admin/use-paginated-list"
import {
  archiveRoomAction,
  restoreRoomAction,
  updateRoomInventoryAction,
} from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TypeFilter = string | "ALL"
type ArchiveFilter = "active" | "archived"

export function InventoryManager({
  roomTypes,
  subcategories,
  rooms,
  allAmenities,
}: {
  roomTypes: RoomTypeRecord[]
  subcategories: RoomSubcategoryWithCount[]
  rooms: RoomWithDetails[]
  allAmenities: AmenityWithCount[]
}) {
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("ALL")
  const [archiveFilter, setArchiveFilter] = React.useState<ArchiveFilter>("active")

  const filtered = React.useMemo(() => {
    return rooms.filter((r) => {
      const matchesArchive =
        archiveFilter === "archived"
          ? r.archivedAt != null
          : r.archivedAt == null
      if (!matchesArchive) return false
      if (typeFilter === "ALL") return true
      return r.roomTypeId === typeFilter
    })
  }, [rooms, typeFilter, archiveFilter])

  const {
    setPage,
    pageSize,
    currentPage,
    paginated,
    handlePageSizeChange,
  } = usePaginatedList(filtered, { resetKey: `${typeFilter}-${archiveFilter}` })

  const filterLabel =
    typeFilter === "ALL"
      ? pluralLabel(filtered.length, "room")
      : `${filtered.length} ${pluralize(filtered.length, "room")}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{filterLabel}</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full border bg-white p-0.5">
            <Button
              type="button"
              variant={archiveFilter === "active" ? "default" : "ghost"}
              size="xs"
              className="rounded-full"
              onClick={() => setArchiveFilter("active")}
            >
              Active
            </Button>
            <Button
              type="button"
              variant={archiveFilter === "archived" ? "default" : "ghost"}
              size="xs"
              className="rounded-full"
              onClick={() => setArchiveFilter("archived")}
            >
              Archived
            </Button>
          </div>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as TypeFilter)}
          >
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {roomTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {roomTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Floor</th>
              <th className="px-3 py-2 font-medium">Room #</th>
              <th className="px-3 py-2 font-medium">Room Type</th>
              <th className="px-3 py-2 font-medium">Subcategory</th>
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
                  roomTypes={roomTypes}
                  subcategories={subcategories}
                  allAmenities={allAmenities}
                  archived={archiveFilter === "archived"}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
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
  roomTypes,
  subcategories,
  allAmenities,
  archived,
}: {
  room: RoomWithDetails
  roomTypes: RoomTypeRecord[]
  subcategories: RoomSubcategoryWithCount[]
  allAmenities: AmenityWithCount[]
  archived: boolean
}) {
  const [roomNumber, setRoomNumber] = React.useState(room.roomNumber ?? "")
  const [roomTypeId, setRoomTypeId] = React.useState(room.roomTypeId)
  const [subcategoryId, setSubcategoryId] = React.useState(
    room.subcategoryId ?? "none",
  )
  const [pending, startTransition] = React.useTransition()

  const typeSubcategories = subcategories.filter(
    (s) =>
      s.roomTypeId === roomTypeId &&
      (s.isActive || s.id === room.subcategoryId),
  )

  // Selectable options are restricted to active types, but the room's
  // current type is always included so its label still renders correctly
  // even if that type has since been archived.
  const currentType = roomTypes.find((t) => t.id === roomTypeId)
  const selectableRoomTypes =
    currentType && !currentType.isActive
      ? [currentType, ...roomTypes.filter((t) => t.isActive)]
      : roomTypes.filter((t) => t.isActive)

  function saveInventory() {
    const normalized = roomNumber.trim()
    if (!normalized) {
      toast.error("Room number is required")
      return
    }
    startTransition(async () => {
      const payload: {
        roomNumber: string
        roomTypeId?: string
        subcategoryId?: string | null
      } = { roomNumber: normalized }
      if (roomTypeId !== room.roomTypeId) payload.roomTypeId = roomTypeId
      const nextSubcategoryId = subcategoryId === "none" ? null : subcategoryId
      const currentSubcategoryId = room.subcategoryId ?? null
      if (nextSubcategoryId !== currentSubcategoryId) {
        payload.subcategoryId = nextSubcategoryId
      }
      const result = await updateRoomInventoryAction(room.id, payload)
      if (result.ok) {
        setRoomNumber(normalized)
        toast.success("Room updated")
        window.location.reload()
      } else toast.error(result.error)
    })
  }

  function toggleArchive() {
    startTransition(async () => {
      const result = archived
        ? await restoreRoomAction(room.id)
        : await archiveRoomAction(room.id)
      if (result.ok) {
        toast.success(archived ? "Room restored" : "Room archived")
        window.location.reload()
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
          disabled={archived}
        />
      </td>
      <td className="px-3 py-2">
        <Select
          value={roomTypeId}
          onValueChange={(v) => {
            setRoomTypeId(v)
            setSubcategoryId("none")
          }}
          disabled={archived}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {selectableRoomTypes.map((t) => (
              <SelectItem key={t.id} value={t.id} disabled={!t.isActive}>
                {roomTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Select
          value={subcategoryId}
          onValueChange={setSubcategoryId}
          disabled={archived}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {typeSubcategories.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2 text-sm">{formatPrice(room.basePrice)}</td>
      <td className="px-3 py-2 text-sm">{room.blackouts.length}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {!archived ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={saveInventory}
            >
              Save
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={toggleArchive}
          >
            {archived ? "Restore" : "Archive"}
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
