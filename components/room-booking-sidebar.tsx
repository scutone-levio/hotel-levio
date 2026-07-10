"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ShoppingCart, Users } from "lucide-react"
import { toast } from "sonner"
import type { DateRange } from "react-day-picker"

import type { RoomWithDetails } from "@/lib/queries"
import { quoteListing } from "@/app/actions"
import { useDateRange } from "@/lib/date-range"
import { formatPrice } from "@/lib/rooms"
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
  const [quote, setQuote] = React.useState<{
    total: number
    nights: number
  } | null>(null)
  const [quotePending, startQuoteTransition] = React.useTransition()

  const listingPrice =
    room.subcategory?.fromPriceCents && room.subcategory.fromPriceCents > 0
      ? room.subcategory.fromPriceCents
      : room.subcategory?.basePrice ?? room.basePrice
  const hasWeekendRates = room.subcategory?.hasWeekendRates ?? false

  React.useEffect(() => {
    if (isHydrated) setRange(dateRange)
  }, [dateRange, isHydrated])

  React.useEffect(() => {
    if (!range?.from || !range?.to) {
      setQuote(null)
      return
    }

    let isMounted = true

    startQuoteTransition(async () => {
      const result = await quoteListing({
        roomId: room.id,
        subcategoryId: room.subcategory?.id,
        checkIn: range.from!.toISOString(),
        checkOut: range.to!.toISOString(),
        guests,
      })
      if (isMounted) {
        if (result.ok) {
          setQuote({ total: result.total, nights: result.nights })
        } else {
          setQuote(null)
        }
      }
    })

    return () => {
      isMounted = false
    }
  }, [range, guests, room.id, room.subcategory?.id])

  function handleSelect(next: DateRange | undefined) {
    setRange(next)
    setDateRange(next)
  }

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
    <div className="bg-card space-y-4 rounded-2xl border p-5">
      <div className="flex items-baseline gap-1.5">
        <p className="text-2xl font-black">
          {hasWeekendRates ? "from " : ""}
          {formatPrice(listingPrice, "CAD")}
        </p>
        <p className="text-muted-foreground text-sm">/ night</p>
      </div>

      <div className="border-t" />

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

      {quotePending ? (
        <p className="text-muted-foreground text-center text-sm">
          Calculating price…
        </p>
      ) : quote && quote.nights > 0 ? (
        <div className="bg-muted/50 space-y-1.5 rounded-xl p-3 text-sm">
          <div className="text-muted-foreground flex justify-between">
            <span>
              {quote.nights} night{quote.nights !== 1 ? "s" : ""}
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
        <p className="text-muted-foreground text-center text-sm">
          Select dates to see the total.
        </p>
      )}

      {alreadyInCart && (
        <p className="text-xs text-amber-600">
          This room is already in your cart for overlapping dates.
        </p>
      )}

      <Button
        className="w-full cursor-pointer"
        size="lg"
        onClick={handleAddToCart}
        disabled={!quote || quote.nights === 0 || alreadyInCart || quotePending}
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

      {hasWeekendRates && (
        <p className="text-muted-foreground text-center text-xs">
          Weekend nights may cost more than the rate shown above.
        </p>
      )}
    </div>
  )
}
