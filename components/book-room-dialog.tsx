"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ShoppingCart } from "lucide-react"
import { toast } from "sonner"
import type { DateRange } from "react-day-picker"

import type { RoomWithDetails } from "@/lib/queries"
import { useDateRange } from "@/lib/date-range"
import { formatPrice, getRoomPrice } from "@/lib/rooms"
import { quoteRange } from "@/lib/pricing"
import { blackoutMatchers } from "@/lib/availability"
import { useCart } from "@/lib/cart"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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

export function BookRoomDialog({
  room,
  trigger,
}: {
  room: RoomWithDetails
  trigger: React.ReactNode
}) {
  const router = useRouter()
  const { items, addItem } = useCart()
  const { dateRange, setDateRange, isHydrated } = useDateRange()
  const [open, setOpen] = React.useState(false)
  const [range, setRange] = React.useState<DateRange | undefined>()
  const [guests, setGuests] = React.useState(1)

  React.useEffect(() => {
    if (isHydrated) setRange(dateRange)
  }, [dateRange, isHydrated])

  React.useEffect(() => {
    if (!open && isHydrated) setRange(dateRange)
  }, [dateRange, open, isHydrated])

  function handleSelect(next: DateRange | undefined) {
    setRange(next)
    setDateRange(next)
  }

  const quote =
    range?.from && range?.to
      ? quoteRange(
          getRoomPrice(room),
          room.priceRules,
          range.from,
          range.to,
        )
      : null

  const disabled = [{ before: new Date() }, ...blackoutMatchers(room.blackouts)]

  // Check if this room with overlapping dates is already in the cart.
  const alreadyInCart = items.some(
    (i) =>
      i.roomId === room.id &&
      (i.subcategoryId ?? null) === (room.subcategory?.id ?? null) &&
      range?.from &&
      range?.to &&
      new Date(i.checkIn) < range.to &&
      new Date(i.checkOut) > range.from,
  )

  function handleAddToCart() {
    if (!range?.from || !range?.to || !quote || quote.nights === 0) return
    addItem({
      roomId: room.id,
      roomName: room.name,
      imageUrl: room.images[0]?.url ?? null,
      checkIn: range.from.toISOString(),
      checkOut: range.to.toISOString(),
      guests,
      nights: quote.nights,
      totalPrice: quote.total,
      subcategoryId: room.subcategory?.id,
    })
    setOpen(false)
    toast.success(`${room.name} added to cart`, {
      action: {
        label: "View cart",
        onClick: () => router.push("/cart"),
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-fit">
        <DialogHeader>
          <DialogTitle className="text-lg">Book {room.name}</DialogTitle>
          <DialogDescription>
            Sleeps up to {room.capacity}. Select your dates then add to cart.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleSelect}
            numberOfMonths={2}
            disabled={disabled}
            defaultMonth={range?.from ?? new Date()}
            autoFocus
          />

          <div className="flex min-w-56 flex-col gap-3">
            <div className="space-y-1">
              <Label htmlFor={`guests-${room.id}`}>Guests</Label>
              <Input
                id={`guests-${room.id}`}
                type="number"
                min={1}
                max={room.capacity}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="w-24"
              />
            </div>

            <div className="rounded-lg border p-3 text-sm">
              {quote && quote.nights > 0 ? (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {quote.nights} night{quote.nights > 1 ? "s" : ""}
                    </span>
                    <span>{formatPrice(quote.total)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatPrice(quote.total)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Select dates to see the price. Weekend nights may cost more.
                </p>
              )}
            </div>

            {alreadyInCart && (
              <p className="text-amber-600 text-xs">
                This room is already in your cart for these dates.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAddToCart}
            disabled={!quote || quote.nights === 0 || alreadyInCart}
            className="cursor-pointer"
          >
            <ShoppingCart className="size-4" />
            Add to cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
