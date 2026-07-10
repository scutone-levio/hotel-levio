"use client"

import * as React from "react"
import { format } from "date-fns"
import { ImageIcon, Settings2, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"

import type { RoomForAdmin, AmenityWithCount } from "@/lib/queries"
import { ROOM_TYPE_LABELS, WEEKDAYS, parseDollarsToCents } from "@/lib/rooms"
import { ReservationsTable } from "@/components/admin/reservations-table"
import {
  setRoomAmenities,
  addRoomImage,
  deleteRoomImage,
  addBlackout,
  deleteBlackout,
  updateBasePrice,
  setPriceRule,
} from "@/app/admin/actions"
import { UploadDropzone } from "@/lib/uploadthing"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function AmenitiesPanel({
  room,
  allAmenities,
  readOnly,
}: {
  room: RoomForAdmin
  allAmenities: AmenityWithCount[]
  readOnly?: boolean
}) {
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(room.amenities.map((a) => a.id)),
  )
  const [pending, startTransition] = React.useTransition()

  if (readOnly) {
    return (
      <p className="text-muted-foreground text-sm">
        Amenities are managed on the catalog room for this type.
      </p>
    )
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function save() {
    startTransition(async () => {
      const result = await setRoomAmenities(room.id, [...selected])
      if (result.ok) toast.success("Amenities updated")
      else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {allAmenities.map((a) => (
          <label
            key={a.id}
            className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
          >
            <input
              type="checkbox"
              className="size-4"
              checked={selected.has(a.id)}
              onChange={() => toggle(a.id)}
            />
            {a.name}
          </label>
        ))}
      </div>
      <Button onClick={save} disabled={pending} size="sm">
        {pending ? "Saving…" : "Save amenities"}
      </Button>
    </div>
  )
}

function ImagesPanel({
  room,
  readOnly,
}: {
  room: RoomForAdmin
  readOnly?: boolean
}) {
  const [pending, startTransition] = React.useTransition()

  if (readOnly) {
    return (
      <p className="text-muted-foreground text-sm">
        Images are managed on the catalog room for this type.
      </p>
    )
  }

  function remove(imageId: string) {
    startTransition(async () => {
      const result = await deleteRoomImage(imageId)
      if (result.ok) toast.success("Image removed")
      else toast.error(result.error)
    })
  }

  const atLimit = room.images.length >= 5
  const remaining = Math.max(0, 5 - room.images.length)

  return (
    <div className="space-y-4">
      {room.images.length ? (
        <div className="grid grid-cols-3 gap-2">
          {room.images.map((img) => (
            <div
              key={img.id}
              className="group bg-muted relative aspect-square overflow-hidden rounded-md"
            >
              <Image
                src={img.url}
                alt="Room"
                fill
                sizes="150px"
                className="object-cover"
              />
              <button
                onClick={() => remove(img.id)}
                disabled={pending}
                className="bg-background/80 absolute top-1 right-1 rounded-full p-1 opacity-0 transition group-hover:opacity-100"
                title="Delete image"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-md border border-dashed p-6 text-sm">
          <ImageIcon className="size-6" />
          No images yet.
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        {atLimit
          ? "Maximum of 5 images reached. Delete one to upload a replacement."
          : `Upload up to ${remaining} more image${remaining === 1 ? "" : "s"} (${room.images.length}/5). The first image is the cover on room cards.`}
      </p>

      {!atLimit ? (
        <UploadDropzone
          endpoint="roomImage"
          onClientUploadComplete={(res) => {
            startTransition(async () => {
              let failed = false
              let uploaded = 0
              for (const f of res) {
                const url =
                  (f as { ufsUrl?: string; url: string }).ufsUrl ?? f.url
                const result = await addRoomImage(room.id, url, f.key)
                if (!result.ok) {
                  failed = true
                  toast.error(result.error)
                  break
                }
                uploaded += 1
              }
              if (!failed && uploaded > 0) {
                toast.success(
                  uploaded === 1
                    ? "1 image uploaded"
                    : `${uploaded} images uploaded`,
                )
              }
            })
          }}
          onUploadError={(e) => {
            toast.error(e.message)
          }}
        />
      ) : null}
    </div>
  )
}

function BlackoutsPanel({ room }: { room: RoomForAdmin }) {
  const [start, setStart] = React.useState("")
  const [end, setEnd] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  function add() {
    if (!start || !end) {
      toast.error("Pick a start and end date")
      return
    }
    startTransition(async () => {
      const result = await addBlackout({
        roomId: room.id,
        startDate: start,
        endDate: end,
        reason,
      })
      if (result.ok) {
        toast.success("Blackout added")
        setStart("")
        setEnd("")
        setReason("")
      } else {
        toast.error(result.error)
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteBlackout(id)
      if (result.ok) toast.success("Blackout removed")
      else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`start-${room.id}`}>From</Label>
          <Input
            id={`start-${room.id}`}
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`end-${room.id}`}>To</Label>
          <Input
            id={`end-${room.id}`}
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`reason-${room.id}`}>Reason (optional)</Label>
        <Input
          id={`reason-${room.id}`}
          placeholder="e.g. Maintenance"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <Button onClick={add} disabled={pending} size="sm">
        Add blackout
      </Button>

      <div className="space-y-2">
        {room.blackouts.length ? (
          room.blackouts.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-md border p-2 text-sm"
            >
              <span>
                {format(new Date(b.startDate), "MMM d, yyyy")} –{" "}
                {format(new Date(b.endDate), "MMM d, yyyy")}
                {b.reason ? (
                  <span className="text-muted-foreground"> · {b.reason}</span>
                ) : null}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(b.id)}
                disabled={pending}
              >
                <Trash2 className="text-destructive size-4" />
              </Button>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No blackout dates.</p>
        )}
      </div>
    </div>
  )
}

function PricingPanel({ room }: { room: RoomForAdmin }) {
  const [base, setBase] = React.useState((room.basePrice / 100).toString())
  const [pending, startTransition] = React.useTransition()
  const ruleByDay = new Map(room.priceRules.map((r) => [r.dayOfWeek, r.price]))

  function saveBase() {
    const trimmed = base.trim()
    if (trimmed === "") {
      toast.error("Enter a valid price")
      return
    }
    const basePriceCents = parseDollarsToCents(trimmed)
    if (basePriceCents === null) {
      toast.error("Enter a valid price")
      return
    }
    startTransition(async () => {
      const result = await updateBasePrice(room.id, basePriceCents)
      if (result.ok) toast.success("Base price updated")
      else toast.error(result.error)
    })
  }

  function saveDay(day: number, value: string) {
    const trimmed = value.trim()
    const cents = trimmed === "" ? null : parseDollarsToCents(trimmed)
    if (trimmed !== "" && cents === null) {
      toast.error("Enter a valid price")
      return
    }
    startTransition(async () => {
      const result = await setPriceRule(room.id, day, cents)
      if (result.ok) toast.success(`${WEEKDAYS[day]} price saved`)
      else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor={`base-${room.id}`}>Base price / night ($)</Label>
        <div className="flex gap-2">
          <Input
            id={`base-${room.id}`}
            type="number"
            min={0}
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="max-w-40"
          />
          <Button onClick={saveBase} disabled={pending} size="sm">
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Weekday overrides ($ / night)</Label>
        <div className="space-y-2">
          {WEEKDAYS.map((label, day) => (
            <DayPriceRow
              key={day}
              label={label}
              defaultValue={
                ruleByDay.has(day) ? (ruleByDay.get(day)! / 100).toString() : ""
              }
              onSave={(v) => saveDay(day, v)}
              disabled={pending}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function DayPriceRow({
  label,
  defaultValue,
  onSave,
  disabled,
}: {
  label: string
  defaultValue: string
  onSave: (value: string) => void
  disabled: boolean
}) {
  const [value, setValue] = React.useState(defaultValue)
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-sm">{label}</span>
      <Input
        type="number"
        min={0}
        placeholder="base"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="max-w-32"
      />
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onSave(value)}
      >
        Save
      </Button>
    </div>
  )
}

type RoomManageDialogProps = {
  room: RoomForAdmin
  allAmenities: AmenityWithCount[]
  /** When true, amenities/images tabs are read-only (inventory units). */
  inventoryMode?: boolean
  defaultTab?: string
}

export function RoomManageDialog({
  room,
  allAmenities,
  inventoryMode = false,
  defaultTab = "blackouts",
}: RoomManageDialogProps) {
  const readOnlyContent = inventoryMode || !room.isCatalog
  const title = room.isCatalog
    ? room.name
    : `Room ${room.roomNumber ?? "—"}`

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="size-4" /> Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {title}
            {room.isCatalog ? " (Catalog)" : ""}
          </DialogTitle>
          <DialogDescription>{ROOM_TYPE_LABELS[room.type]}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="reservations">Bookings</TabsTrigger>
            <TabsTrigger value="amenities">Amenities</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="blackouts">Blackouts</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
          </TabsList>
          <TabsContent value="reservations" className="mt-4">
            <ReservationsTable roomId={room.id} />
          </TabsContent>
          <TabsContent value="amenities" className="mt-4">
            <AmenitiesPanel
              room={room}
              allAmenities={allAmenities}
              readOnly={readOnlyContent}
            />
          </TabsContent>
          <TabsContent value="images" className="mt-4">
            <ImagesPanel room={room} readOnly={readOnlyContent} />
          </TabsContent>
          <TabsContent value="blackouts" className="mt-4">
            <BlackoutsPanel room={room} />
          </TabsContent>
          <TabsContent value="pricing" className="mt-4">
            <PricingPanel room={room} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
