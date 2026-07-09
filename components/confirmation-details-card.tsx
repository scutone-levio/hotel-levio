import { format } from "date-fns"
import { CalendarDays, Users } from "lucide-react"

import { formatPrice } from "@/lib/rooms"

type ConfirmationDetailsCardProps = Readonly<{
  checkIn: Date
  checkOut: Date
  guests: number
  totalPrice: number
  guestName?: string | null
  guestEmail?: string | null
  guestPhone?: string | null
  specialRequests?: string | null
  showGuestDetails?: boolean
  showTaxesRow?: boolean
  compact?: boolean
  priceTitle?: string
  totalLabel?: string
  currency?: string
}>

export function ConfirmationDetailsCard({
  checkIn,
  checkOut,
  guests,
  totalPrice,
  guestName,
  guestEmail,
  guestPhone,
  specialRequests,
  showGuestDetails = false,
  showTaxesRow = false,
  compact = false,
  priceTitle,
  totalLabel,
  currency = "CAD",
}: ConfirmationDetailsCardProps) {
  const nights = Math.round(
    (Date.UTC(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate()) -
      Date.UTC(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate())) /
      (1000 * 60 * 60 * 24),
  )
  const paddingClass = compact ? "p-5" : "p-6"

  return (
    <>
      <div className="grid border-b sm:grid-cols-3">
        <div className={`border-b ${paddingClass} sm:border-r sm:border-b-0`}>
          <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">
            Check-in
          </p>
          <p className="font-semibold">{format(checkIn, "EEE, MMM d, yyyy")}</p>
          <p className="text-muted-foreground text-sm">From 3:00 PM</p>
        </div>
        <div className={`border-b ${paddingClass} sm:border-r sm:border-b-0`}>
          <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">
            Check-out
          </p>
          <p className="font-semibold">
            {format(checkOut, "EEE, MMM d, yyyy")}
          </p>
          <p className="text-muted-foreground text-sm">By 12:00 PM</p>
        </div>
        <div className={paddingClass}>
          <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">
            Stay
          </p>
          <p className="flex items-center gap-1.5 font-semibold">
            <CalendarDays className="size-4" />
            {nights} night{nights !== 1 ? "s" : ""}
          </p>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Users className="size-3.5" />
            {guests} guest{guests !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {showGuestDetails && (
        <div className={`border-b ${paddingClass}`}>
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
            Guest details
          </p>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="font-medium">{guestName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{guestEmail}</p>
            </div>
            {guestPhone && (
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{guestPhone}</p>
              </div>
            )}
            {specialRequests && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Special requests</p>
                <p className="font-medium">{specialRequests}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={paddingClass}>
        {priceTitle && (
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
            {priceTitle}
          </p>
        )}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {nights} night{nights !== 1 ? "s" : ""}
            </span>
            <span className="font-semibold">
              {formatPrice(totalPrice, currency)}
            </span>
          </div>
          {showTaxesRow && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxes &amp; fees</span>
              <span>Included</span>
            </div>
          )}
          <div
            className={`flex justify-between ${showTaxesRow ? "border-t pt-2 text-base font-semibold" : "font-semibold"}`}
          >
            <span>
              {totalLabel ?? "Total charged"} ({currency})
            </span>
            <span>{formatPrice(totalPrice, currency)}</span>
          </div>
        </div>
      </div>
    </>
  )
}
