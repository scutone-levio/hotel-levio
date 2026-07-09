"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ShoppingCart, Users } from "lucide-react"
import { toast } from "sonner"
import type { DateRange } from "react-day-picker"

import type { RoomWithDetails } from "@/lib/queries"
import { useDateRange } from "@/lib/date-range"
import { formatPrice, fromPrice, getRoomPrice } from "@/lib/rooms"
import { quoteRange } from "@/lib/pricing"
import { blackoutMatchers } from "@/lib/availability"
import { useCart } from "@/lib/cart"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RoomBookingSidebar({ room }: { room: RoomWithDetails }) {
  const router = useRouter()
  const { items, addItem } = useCart()
  const { dateRange, setDateRange, isHydrated } = useDateRange()
  const [range, setRange] = React.useState<DateRange | undefined>()
  const [guests, setGuests] = React.useState(1)

  React.useEffect(() => {
    if (isHydrated) setRange(dateRange)
  }, [dateRange, isHydrated])

  function handleSelect(next: DateRange | undefined) {
    setRange(next)
    setDateRange(next)
  }

  const quote =
    range?.from && range?.to
      ? quoteRange(getRoomPrice(room), room.priceRules, range.from, range.to)
      : null

  const disabled = [{ before: new Date() }, ...blackoutMatchers(room.blackouts)]

  const alreadyInCart = items.some(
    (i) =>
      i.roomId === room.id &&
      (i.subcategoryId ?? null) === (room.subcategory?.id ?? null) &&
      range?.from &&
      range?.to &&
      new Date(i.checkIn) < range.to &&
      new Date(i.checkOut) > range.from,
  )

  const effectiveBase = getRoomPrice(room)
  const weekendRules = room.priceRules.filter((r) => r.price > effectiveBase)

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
    toast.success(`${room.name} added to cart`, {
      action: {
        label: "View cart",
        onClick: () => router.push("/cart"),
      },
    })
  }

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      {/* Price header */}
      <div className="flex items-baseline gap-1.5">
        <p className="text-2xl font-bold">
          {weekendRules.length > 0 ? "from " : ""}
          {formatPrice(fromPrice(room))}
        </p>
        <p className="text-muted-foreground text-sm">/ night</p>
      </div>

      <div className="border-t" />

      {/* Inline calendar */}
      <Calendar
        mode="range"
        selected={range}
        onSelect={handleSelect}
        numberOfMonths={1}
        disabled={disabled}
        defaultMonth={range?.from ?? new Date()}
        className="mx-auto"
      />

      <div className="border-t" />

      {/* Guests */}
      <div className="flex items-center justify-between">
        <Label
          htmlFor="guests-sidebar"
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          <Users className="size-4" /> Guests
        </Label>
        <Input
          id="guests-sidebar"
          type="number"
          min={1}
          max={room.capacity}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          className="w-20 text-center"
        />
      </div>

      {/* Price breakdown */}
      {quote && quote.nights > 0 ? (
        <div className="rounded-xl bg-muted/50 p-3 text-sm space-y-1.5">
          <div className="flex justify-between text-muted-foreground">
            <span>
              {formatPrice(fromPrice(room))} × {quote.nights} night
              {quote.nights !== 1 ? "s" : ""}
            </span>
            <span>{formatPrice(quote.total)}</span>
          </div>
          <div className="border-t" />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatPrice(quote.total)}</span>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm text-center">
          Select dates to see the total.
        </p>
      )}

      {alreadyInCart && (
        <p className="text-amber-600 text-xs">
          This room is already in your cart for overlapping dates.
        </p>
      )}

      <Button
        className="w-full cursor-pointer"
        size="lg"
        onClick={handleAddToCart}
        disabled={!quote || quote.nights === 0 || alreadyInCart}
      >
        <ShoppingCart className="size-4" />
        {range?.from ? "Add to cart" : "Select dates to book"}
      </Button>

      {range && (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground w-full text-center text-sm underline-offset-2 hover:underline"
          onClick={() => handleSelect(undefined)}
        >
          Clear dates
        </button>
      )}

      {weekendRules.length > 0 && (
        <p className="text-muted-foreground text-xs text-center">
          Weekend rate:{" "}
          {formatPrice(Math.max(...weekendRules.map((r) => r.price)))} / night
        </p>
      )}
    </div>
  )
}
