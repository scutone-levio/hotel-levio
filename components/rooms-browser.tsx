"use client"

import * as React from "react"
import { Loader2, SlidersHorizontal } from "lucide-react"
import type { RoomType } from "@prisma/client"
import { format } from "date-fns"

import type { PublicRoomListing } from "@/lib/queries"
import type { AvailabilityCount } from "@/app/actions"
import { useDateRange } from "@/lib/date-range"
import {
  listingAvailabilityKey,
  listingFromPriceCents,
  ROOM_TYPE_LABELS,
  ROOM_TYPE_SHORT_LABELS,
} from "@/lib/rooms"
import { subcategorySortIndex } from "@/lib/subcategories"
import { RoomCard } from "@/components/room-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

function CheckboxRow({
  checked,
  onChange,
  label,
}: Readonly<{
  checked: boolean
  onChange: () => void
  label: string
}>) {
  return (
    <label className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
      <input
        type="checkbox"
        className="size-4"
        checked={checked}
        onChange={onChange}
      />
      {label}
    </label>
  )
}

type SortKey =
  | "featured"
  | "price-asc"
  | "price-desc"
  | "name-asc"
  | "name-desc"
  | "capacity-asc"
  | "capacity-desc"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name-asc", label: "Name: A–Z" },
  { value: "name-desc", label: "Name: Z–A" },
  { value: "capacity-asc", label: "Size: small to large" },
  { value: "capacity-desc", label: "Size: large to small" },
]

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

const CATALOG_ORDER: RoomType[] = ["TWIN", "QUEEN", "KING", "SUITE"]

// Re-themes the sort/page-size/filter controls to sit on the section's fixed
// cream background — their dropdown panels are portaled and intentionally
// left in the app's default theme (see BookingPicker for the same tradeoff).
const listingsControlsTheme = {
  "--background": "#fbf8ee",
  "--foreground": "#0f2a3d",
  "--input": "rgba(15, 42, 61, 0.25)",
  "--border": "rgba(15, 42, 61, 0.25)",
  "--muted": "rgba(15, 42, 61, 0.06)",
  "--muted-foreground": "rgba(15, 42, 61, 0.55)",
  "--ring": "#a9793c",
  "--accent": "rgba(169, 121, 60, 0.12)",
  "--accent-foreground": "#0f2a3d",
  "--primary": "#a9793c",
  "--primary-foreground": "#fbf8ee",
} as React.CSSProperties

type Props = {
  rooms: PublicRoomListing[]
  /** Listing availability keys (`roomId:subcategoryId`) with stock for the selected dates. Null = no date filter. */
  availableIds?: Set<string> | null
  availabilityCounts?: Record<string, AvailabilityCount> | null
  isCheckingAvailability?: boolean
}

export function RoomsBrowser({
  rooms,
  availableIds = null,
  availabilityCounts = null,
  isCheckingAvailability = false,
}: Readonly<Props>) {
  const { dateRange } = useDateRange()
  const [open, setOpen] = React.useState(false)
  const [types, setTypes] = React.useState<Set<RoomType>>(new Set())
  const [amenityIds, setAmenityIds] = React.useState<Set<string>>(new Set())
  const [sort, setSort] = React.useState<SortKey>("featured")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState<PageSize>(10)

  const availableTypes = React.useMemo(
    () => [...new Set(rooms.map((r) => r.type))],
    [rooms],
  )
  const availableAmenities = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rooms) for (const a of r.amenities) map.set(a.id, a.name)
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rooms])

  const filtered = React.useMemo(() => {
    const result = rooms.filter((r) => {
      if (availableIds != null) {
        const listingKey = r.subcategory?.id
          ? listingAvailabilityKey(r.id, r.subcategory.id)
          : null
        if (listingKey == null || !availableIds.has(listingKey)) {
          return false
        }
      }
      const typeOk = types.size === 0 || types.has(r.type)
      const roomAmenities = new Set(r.amenities.map((a) => a.id))
      const amenityOk =
        amenityIds.size === 0 ||
        [...amenityIds].every((id) => roomAmenities.has(id))
      return typeOk && amenityOk
    })

    switch (sort) {
      case "price-asc":
        return [...result].sort(
          (a, b) =>
            listingFromPriceCents(a.subcategory) -
            listingFromPriceCents(b.subcategory),
        )
      case "price-desc":
        return [...result].sort(
          (a, b) =>
            listingFromPriceCents(b.subcategory) -
            listingFromPriceCents(a.subcategory),
        )
      case "name-asc":
        return [...result].sort((a, b) => a.name.localeCompare(b.name))
      case "name-desc":
        return [...result].sort((a, b) => b.name.localeCompare(a.name))
      case "capacity-asc":
        return [...result].sort((a, b) => a.capacity - b.capacity)
      case "capacity-desc":
        return [...result].sort((a, b) => b.capacity - a.capacity)
      default:
        return [...result].sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1
          const subOrder =
            subcategorySortIndex(a.subcategory.name) -
            subcategorySortIndex(b.subcategory.name)
          if (subOrder !== 0) return subOrder
          return (
            listingFromPriceCents(b.subcategory) -
            listingFromPriceCents(a.subcategory)
          )
        })
    }
  }, [rooms, types, amenityIds, sort, availableIds])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  const paginated = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage, pageSize])

  const grouped = React.useMemo(() => {
    const byType = new Map<RoomType, PublicRoomListing[]>()
    for (const room of paginated) {
      const list = byType.get(room.type) ?? []
      list.push(room)
      byType.set(room.type, list)
    }
    return CATALOG_ORDER.filter((type) => byType.has(type)).map((type) => ({
      type,
      rooms: byType.get(type)!,
    }))
  }, [paginated])

  React.useEffect(() => {
    setPage(1)
  }, [types, amenityIds, sort, availableIds, pageSize])

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const rangeStart =
    filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length)

  const activeCount = types.size + amenityIds.size
  const hasDates = dateRange?.from && dateRange?.to

  function subtitle() {
    if (isCheckingAvailability) return "Checking availability…"
    if (hasDates && availableIds !== null) {
      const dateLabel = `${format(dateRange.from!, "MMM d")} – ${format(dateRange.to!, "MMM d, yyyy")}`
      return `${filtered.length} room${filtered.length === 1 ? "" : "s"} available · ${dateLabel}`
    }
    if (activeCount > 0)
      return `Showing ${filtered.length} of ${rooms.length} rooms`
    return "Handpicked stays for every kind of traveller."
  }

  function toggleType(t: RoomType) {
    setTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  function toggleAmenity(id: string) {
    setAmenityIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearAll() {
    setTypes(new Set())
    setAmenityIds(new Set())
  }

  return (
    <>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-primary mb-2 block text-[0.72rem] tracking-[0.24em] uppercase">
            The Collection
          </span>
          <h2 className="text-primary-foreground text-[1.7rem] sm:text-[2.1rem]">
            Available rooms
          </h2>
          <p
            className="text-primary-foreground/60 mt-2 flex items-center gap-1.5"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {isCheckingAvailability && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            {subtitle()}
          </p>
        </div>

        <div
          className="text-foreground flex flex-wrap items-center justify-end gap-2"
          style={listingsControlsTheme}
        >
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setPageSize(Number(v) as PageSize)}
          >
            <SelectTrigger
              className="h-9 w-[70px] text-sm"
              data-testid="page-size"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger
              className="h-9 text-sm"
              data-testid="rooms-sort-trigger"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="rooms-filter-trigger">
                <SlidersHorizontal className="size-4" />
                Filters
                {activeCount > 0 ? (
                  <Badge className="ml-1">{activeCount}</Badge>
                ) : null}
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-h-[85vh] overflow-y-auto"
              data-testid="rooms-filter-modal"
            >
              <DialogHeader>
                <DialogTitle>Filter rooms</DialogTitle>
                <DialogDescription>
                  Narrow results by room type and amenities.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <section className="space-y-2">
                  <h3 className="text-sm">Room type</h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {availableTypes.map((t) => (
                      <CheckboxRow
                        key={t}
                        label={ROOM_TYPE_LABELS[t]}
                        checked={types.has(t)}
                        onChange={() => toggleType(t)}
                      />
                    ))}
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm">Amenities</h3>
                  <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                    {availableAmenities.map((a) => (
                      <CheckboxRow
                        key={a.id}
                        label={a.name}
                        checked={amenityIds.has(a.id)}
                        onChange={() => toggleAmenity(a.id)}
                      />
                    ))}
                  </div>
                </section>
              </div>

              <DialogFooter className="flex-row justify-between sm:justify-between">
                <Button
                  variant="ghost"
                  onClick={clearAll}
                  disabled={activeCount === 0}
                >
                  Clear all
                </Button>
                <Button onClick={() => setOpen(false)}>
                  Show {filtered.length} room{filtered.length === 1 ? "" : "s"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isCheckingAvailability && filtered.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.slice(0, 6).map((room) => (
            <div
              key={`${room.id}-${room.subcategory?.id ?? "default"}`}
              className="bg-muted aspect-[3/4] animate-pulse rounded-xl"
            />
          ))}
        </div>
      ) : filtered.length ? (
        <>
          <div
            className={`space-y-10 transition-opacity duration-200 ${isCheckingAvailability ? "opacity-50" : ""}`}
            aria-busy={isCheckingAvailability}
          >
            {grouped.map(({ type, rooms: sectionRooms }) => (
              <section key={type}>
                <h3 className="text-primary-foreground mb-4 text-xl">
                  {ROOM_TYPE_SHORT_LABELS[type]}
                </h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionRooms.map((room) => (
                    <RoomCard
                      key={`${room.id}-${room.subcategory?.id ?? "default"}`}
                      room={room}
                      availability={
                        room.subcategory?.id
                          ? (availabilityCounts?.[
                              listingAvailabilityKey(
                                room.id,
                                room.subcategory.id,
                              )
                            ] ?? null)
                          : null
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div
            className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            data-testid="rooms-pagination"
          >
            <p className="text-muted-foreground text-sm">
              Showing {rangeStart}–{rangeEnd} of {filtered.length} room
              {filtered.length === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => p - 1)}
                data-testid="pagination-prev"
              >
                Previous
              </Button>
              <span className="text-muted-foreground min-w-24 text-center text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                data-testid="pagination-next"
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
          {hasDates && availableIds !== null
            ? "No rooms are available for the selected dates."
            : "No rooms match your filters."}{" "}
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className="text-foreground underline underline-offset-4"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </>
  )
}
