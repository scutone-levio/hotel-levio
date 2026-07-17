"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import type { RoomTypeRecord } from "@/lib/room-types"
import { centsToDollarsString, parseDollarsToCents } from "@/lib/rooms"
import {
  archiveRoomTypeAction,
  createRoomType,
  restoreRoomTypeAction,
  updateRoomType,
} from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type RoomTypeFormDialogProps =
  | {
      mode: "create"
      roomType?: undefined
      trigger?: React.ReactNode
    }
  | {
      mode: "edit"
      roomType: RoomTypeRecord
      trigger?: React.ReactNode
    }

export function RoomTypeFormDialog(props: RoomTypeFormDialogProps) {
  const { mode, trigger } = props
  const roomType = props.mode === "edit" ? props.roomType : undefined

  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(roomType?.name ?? "")
  const [slug, setSlug] = React.useState(roomType?.slug ?? "")
  const [description, setDescription] = React.useState(
    roomType?.description ?? "",
  )
  const [capacity, setCapacity] = React.useState(
    roomType ? String(roomType.capacity) : "2",
  )
  const [beds, setBeds] = React.useState(
    roomType ? String(roomType.beds) : "1",
  )
  const [basePrice, setBasePrice] = React.useState(
    roomType ? centsToDollarsString(roomType.basePrice) : "",
  )
  const [pending, startTransition] = React.useTransition()

  React.useEffect(() => {
    if (!open) return
    setName(roomType?.name ?? "")
    setSlug(roomType?.slug ?? "")
    setDescription(roomType?.description ?? "")
    setCapacity(roomType ? String(roomType.capacity) : "2")
    setBeds(roomType ? String(roomType.beds) : "1")
    setBasePrice(roomType ? centsToDollarsString(roomType.basePrice) : "")
  }, [open, roomType])

  function handleSubmit() {
    const basePriceCents = parseDollarsToCents(basePrice)
    if (basePriceCents === null) {
      toast.error("Enter a valid base price")
      return
    }

    const capacityValue = Number(capacity)
    if (!Number.isInteger(capacityValue) || capacityValue < 1) {
      toast.error("Capacity must be a whole number of at least 1")
      return
    }

    const bedsValue = Number(beds)
    if (!Number.isInteger(bedsValue) || bedsValue < 1) {
      toast.error("Beds must be a whole number of at least 1")
      return
    }

    const payload = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description: description.trim(),
      capacity: capacityValue,
      beds: bedsValue,
      basePriceCents,
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createRoomType(payload)
          : await updateRoomType(roomType!.id, payload)

      if (result.ok) {
        toast.success(mode === "create" ? "Room type created" : "Room type updated")
        setOpen(false)
        window.location.reload()
      } else {
        toast.error(result.error)
      }
    })
  }

  const defaultTrigger =
    mode === "create" ? (
      <Button variant="blue" size="sm">
        <Plus className="size-4 mr-1" /> New Room Type
      </Button>
    ) : (
      <Button variant="blue" size="sm">
        Edit type
      </Button>
    )

  let submitLabel = "Save"
  if (pending) submitLabel = "Saving…"
  else if (mode === "create") submitLabel = "Create"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New room type" : "Edit room type"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Creates a room type and its catalog room for listings."
              : "Updates the type definition and syncs the catalog room."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="rt-name">Name</Label>
            <Input
              id="rt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Queen Room"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rt-slug">Slug</Label>
            <Input
              id="rt-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="queen"
              disabled={mode === "edit"}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rt-description">Description</Label>
            <textarea
              id="rt-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="rt-capacity">Capacity</Label>
              <Input
                id="rt-capacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rt-beds">Beds</Label>
              <Input
                id="rt-beds"
                type="number"
                min={1}
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rt-price">Base price / night ($)</Label>
            <Input
              id="rt-price"
              type="number"
              min={0}
              step="0.01"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="189"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {mode === "edit" && roomType ? (
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = roomType.isActive
                    ? await archiveRoomTypeAction(roomType.id)
                    : await restoreRoomTypeAction(roomType.id)
                  if (result.ok) {
                    toast.success(
                      roomType.isActive ? "Room type archived" : "Room type restored",
                    )
                    setOpen(false)
                    window.location.reload()
                  } else {
                    toast.error(result.error)
                  }
                })
              }}
            >
              {roomType.isActive ? "Archive type" : "Restore type"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="blue" onClick={handleSubmit} disabled={pending}>
              {submitLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
