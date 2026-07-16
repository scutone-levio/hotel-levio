"use client"

import * as React from "react"
import { format, differenceInCalendarDays } from "date-fns"
import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import type { BookingRow } from "@/app/admin/actions"
import { getBookings, updateBooking, deleteBooking } from "@/app/admin/actions"
import { formatPrice } from "@/lib/rooms"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  CONFIRMED: "default",
  PENDING: "secondary",
  CANCELLED: "destructive",
}

function toDateInput(d: Date) {
  return format(new Date(d), "yyyy-MM-dd")
}

function nights(b: BookingRow) {
  return differenceInCalendarDays(new Date(b.checkOut), new Date(b.checkIn))
}

/* -------------------------------------------------------------------------- */
/*  Edit dialog                                                                 */
/* -------------------------------------------------------------------------- */

function EditDialog({
  booking,
  open,
  onClose,
  onSaved,
}: {
  booking: BookingRow
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [checkIn, setCheckIn] = React.useState(toDateInput(booking.checkIn))
  const [checkOut, setCheckOut] = React.useState(toDateInput(booking.checkOut))
  const [guests, setGuests] = React.useState(booking.guests)
  const [status, setStatus] = React.useState(booking.status)
  const [guestName, setGuestName] = React.useState(booking.guestName ?? "")
  const [guestEmail, setGuestEmail] = React.useState(booking.guestEmail ?? "")
  const [guestPhone, setGuestPhone] = React.useState(booking.guestPhone ?? "")
  const [specialRequests, setSpecialRequests] = React.useState(
    booking.specialRequests ?? "",
  )
  const [pending, startTransition] = React.useTransition()

  // Reset fields when the target booking changes.
  React.useEffect(() => {
    setCheckIn(toDateInput(booking.checkIn))
    setCheckOut(toDateInput(booking.checkOut))
    setGuests(booking.guests)
    setStatus(booking.status)
    setGuestName(booking.guestName ?? "")
    setGuestEmail(booking.guestEmail ?? "")
    setGuestPhone(booking.guestPhone ?? "")
    setSpecialRequests(booking.specialRequests ?? "")
  }, [booking])

  function save() {
    startTransition(async () => {
      const result = await updateBooking(booking.id, {
        checkIn,
        checkOut,
        guests,
        status,
        guestName,
        guestEmail,
        guestPhone,
        specialRequests,
      })
      if (result.ok) {
        toast.success("Reservation updated")
        onSaved()
        onClose()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit reservation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Check-in</Label>
              <Input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Check-out</Label>
              <Input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>

          {/* Guests + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Guests</Label>
              <Input
                type="number"
                min={1}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Guest info */}
          <div className="space-y-1.5">
            <Label>Guest name</Label>
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Special requests */}
          <div className="space-y-1.5">
            <Label>Special requests</Label>
            <textarea
              rows={2}
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:ring-3"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*  Delete confirm dialog                                                       */
/* -------------------------------------------------------------------------- */

function DeleteDialog({
  booking,
  open,
  onClose,
  onDeleted,
}: {
  booking: BookingRow
  open: boolean
  onClose: () => void
  onDeleted: () => void
}) {
  const [pending, startTransition] = React.useTransition()

  function confirm() {
    startTransition(async () => {
      const result = await deleteBooking(booking.id)
      if (result.ok) {
        toast.success("Reservation deleted")
        onDeleted()
        onClose()
      } else {
        toast.error(result.error)
      }
    })
  }

  const guestLabel = booking.guestName ?? booking.guestEmail ?? "this guest"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete reservation?</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          This will permanently delete booking{" "}
          <strong>#{booking.id.slice(-8).toUpperCase()}</strong> for{" "}
          <strong>{guestLabel}</strong>. An email notification will be sent to
          the admin. This action cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*  Expanded row detail                                                         */
/* -------------------------------------------------------------------------- */

function ExpandedRow({
  booking,
  onEdit,
  onDelete,
}: {
  booking: BookingRow
  onEdit: () => void
  onDelete: () => void
}) {
  const n = nights(booking)
  return (
    <tr>
      <td
        colSpan={7}
        className="bg-muted/30 border-b px-4 pb-4 pt-3"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Guest
            </p>
            <p className="text-sm font-medium">
              {booking.guestName ?? booking.user.name ?? "—"}
            </p>
            <p className="text-muted-foreground text-sm">
              {booking.guestEmail ?? booking.user.email}
            </p>
            {booking.guestPhone && (
              <p className="text-muted-foreground text-sm">{booking.guestPhone}</p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Stay
            </p>
            <p className="text-sm">
              {format(new Date(booking.checkIn), "MMM d")} →{" "}
              {format(new Date(booking.checkOut), "MMM d, yyyy")}
            </p>
            <p className="text-muted-foreground text-sm">
              {n} night{n !== 1 ? "s" : ""} · {booking.guests} guest
              {booking.guests !== 1 ? "s" : ""}
            </p>
            {booking.specialRequests && (
              <p className="text-muted-foreground text-sm italic">
                &ldquo;{booking.specialRequests}&rdquo;
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Payment
            </p>
            <p className="text-sm font-semibold">
              {formatPrice(booking.totalPrice, "CAD")}
            </p>
            {booking.stripeSessionId && (
              <p className="text-muted-foreground font-mono text-xs">
                {booking.stripeSessionId.slice(0, 24)}…
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Created {format(new Date(booking.createdAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
      </td>
    </tr>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                              */
/* -------------------------------------------------------------------------- */

const STATUS_FILTERS = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Cancelled", value: "CANCELLED" },
]

export function ReservationsTable({ roomId }: { roomId?: string }) {
  const pageSize = roomId ? 5 : 10

  const [page, setPage] = React.useState(1)
  const [statusFilter, setStatusFilter] = React.useState("ALL")
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [data, setData] = React.useState<{
    bookings: BookingRow[]
    total: number
  } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [editTarget, setEditTarget] = React.useState<BookingRow | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<BookingRow | null>(null)
  const [isPending, startTransition] = React.useTransition()
  const [isExporting, setIsExporting] = React.useState(false)

  function handleExport() {
    setIsExporting(true)
    const params = new URLSearchParams()
    if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter)
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (roomId) params.set("roomId", roomId)
    window.location.href = `/api/export/admin/bookings?${params.toString()}`
    setTimeout(() => setIsExporting(false), 1000)
  }

  // Debounce search input.
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset to page 1 when filters change.
  React.useEffect(() => { setPage(1) }, [statusFilter, debouncedSearch])

  const load = React.useCallback(() => {
    startTransition(async () => {
      setLoading(true)
      const result = await getBookings({
        page,
        pageSize,
        roomId,
        status: statusFilter,
        search: debouncedSearch,
      })
      setData(result)
      setLoading(false)
    })
  }, [page, pageSize, roomId, statusFilter, debouncedSearch])

  React.useEffect(() => {
    load()
  }, [load])

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1

  const showRoomColumn = !roomId
  const columnCount = showRoomColumn ? 7 : 6
  const hasResults = (data?.bookings.length ?? 0) > 0
  const exportDisabled =
    isExporting || loading || (data?.total ?? 0) === 0

  function renderTableBody() {
    if (loading && !data) {
      return (
        <tr>
          <td colSpan={columnCount} className="px-3 py-12 text-center">
            <Loader2 className="text-muted-foreground mx-auto size-6 animate-spin" />
          </td>
        </tr>
      )
    }
    if (!hasResults) {
      return (
        <tr>
          <td
            colSpan={columnCount}
            className="text-muted-foreground px-3 py-8 text-center text-sm"
          >
            No reservations found.
          </td>
        </tr>
      )
    }
    return data!.bookings.map((b) => {
      const isExpanded = expandedId === b.id
      return (
        <React.Fragment key={b.id}>
          <tr
            className="bg-white hover:bg-muted/30 border-b cursor-pointer transition-colors"
            onClick={() => setExpandedId(isExpanded ? null : b.id)}
          >
            <td className="px-3 py-2.5 text-muted-foreground">
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </td>
            <td className="px-3 py-2.5">
              <p className="font-medium leading-none">
                {b.guestName ?? b.user.name ?? "—"}
              </p>
              <p className="text-muted-foreground text-xs mt-0.5">
                #{b.id.slice(-8).toUpperCase()}
              </p>
            </td>
            {showRoomColumn && (
              <td className="px-3 py-2.5 text-muted-foreground">
                {b.room.roomNumber
                  ? `${b.room.name} · Room ${b.room.roomNumber}`
                  : b.room.name}
              </td>
            )}
            <td className="px-3 py-2.5 whitespace-nowrap">
              {format(new Date(b.checkIn), "MMM d, yyyy")}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap">
              {format(new Date(b.checkOut), "MMM d, yyyy")}
            </td>
            <td className="px-3 py-2.5">
              <Badge
                variant={STATUS_VARIANT[b.status] ?? "secondary"}
                className="text-xs"
              >
                {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
              </Badge>
            </td>
            <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
              {formatPrice(b.totalPrice, "CAD")}
            </td>
          </tr>

          {isExpanded && (
            <ExpandedRow
              booking={b}
              onEdit={() => setEditTarget(b)}
              onDelete={() => setDeleteTarget(b)}
            />
          )}
        </React.Fragment>
      )
    })
  }

  return (
    <>
      {/* Filter bar */}
      {!roomId && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 size-3.5" />
            <Input
              placeholder="Search guest or room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "border bg-white text-muted-foreground hover:bg-white hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportDisabled}
            className="bg-white hover:bg-white"
          >
            <Download className="size-4" />
            {isExporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-left">
                <th className="w-8 px-3 py-2.5" />
                <th className="px-3 py-2.5 font-medium">Guest</th>
                {showRoomColumn && (
                  <th className="px-3 py-2.5 font-medium">Room</th>
                )}
                <th className="px-3 py-2.5 font-medium">Check-in</th>
                <th className="px-3 py-2.5 font-medium">Check-out</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>{renderTableBody()}</tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {data.total} reservation{data.total !== 1 ? "s" : ""} ·{" "}
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {editTarget && (
        <EditDialog
          booking={editTarget}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={load}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          booking={deleteTarget}
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={load}
        />
      )}
    </>
  )
}
