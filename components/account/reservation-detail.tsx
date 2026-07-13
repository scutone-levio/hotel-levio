"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import { toast } from "sonner"
import type { DateRange } from "react-day-picker"

import {
  cancelReservation,
  changeReservationDates,
  updateReservationSpecialRequests,
} from "@/app/account/actions"
import { formatPrice } from "@/lib/rooms"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"

export type ReservationDetailData = {
  id: string
  checkIn: string
  checkOut: string
  guests: number
  totalPrice: number
  status: string
  specialRequests: string | null
  roomName: string
  roomNumber: string | null
  canModify: boolean
}

function DateChangePaymentForm({
  onPaid,
}: {
  onPaid: (paymentIntentId: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [pending, setPending] = React.useState(false)

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setPending(true)
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    })
    setPending(false)
    if (error) {
      toast.error(error.message ?? "Payment failed")
      return
    }
    if (paymentIntent?.status === "succeeded") {
      onPaid(paymentIntent.id)
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-3 rounded-xl border p-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || pending} className="cursor-pointer">
        {pending ? "Processing…" : "Pay price difference"}
      </Button>
    </form>
  )
}

export function ReservationDetail({
  booking,
  publishableKey,
}: {
  booking: ReservationDetailData
  publishableKey: string
}) {
  const [range, setRange] = React.useState<DateRange | undefined>({
    from: new Date(booking.checkIn),
    to: new Date(booking.checkOut),
  })
  const [specialRequests, setSpecialRequests] = React.useState(
    booking.specialRequests ?? "",
  )
  const [paymentClientSecret, setPaymentClientSecret] = React.useState<
    string | null
  >(null)
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const stripePromise = React.useMemo(
    () => loadStripe(publishableKey),
    [publishableKey],
  )

  function handleCancel() {
    if (!confirm("Cancel this reservation? Refunds are processed by the hotel.")) {
      return
    }
    startTransition(async () => {
      const result = await cancelReservation(booking.id)
      if (result.ok) {
        toast.success("Reservation cancelled")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleSaveRequests() {
    startTransition(async () => {
      const result = await updateReservationSpecialRequests(
        booking.id,
        specialRequests,
      )
      if (result.ok) toast.success("Special requests updated")
      else toast.error(result.error)
    })
  }

  function applyDateChange(stripePaymentIntentId?: string) {
    if (!range?.from || !range?.to) {
      toast.error("Select a date range")
      return
    }
    startTransition(async () => {
      const result = await changeReservationDates({
        bookingId: booking.id,
        checkIn: range.from!.toISOString(),
        checkOut: range.to!.toISOString(),
        stripePaymentIntentId,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if ("requiresPayment" in result && result.requiresPayment) {
        setPaymentClientSecret(result.clientSecret)
        toast.message("Additional payment required for new dates")
        return
      }
      if ("updated" in result && result.updated) {
        if (result.refundPending) {
          toast.success(
            "Dates updated. Any refund will be processed by the hotel.",
          )
        } else {
          toast.success("Dates updated")
        }
        setPaymentClientSecret(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{booking.roomName}</h1>
          {booking.roomNumber ? (
            <p className="text-muted-foreground text-sm">Room {booking.roomNumber}</p>
          ) : null}
        </div>
        <Badge>{booking.status}</Badge>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Check-in</dt>
          <dd className="font-medium">
            {format(new Date(booking.checkIn), "MMM d, yyyy")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Check-out</dt>
          <dd className="font-medium">
            {format(new Date(booking.checkOut), "MMM d, yyyy")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Guests</dt>
          <dd className="font-medium">{booking.guests}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total paid</dt>
          <dd className="font-medium">{formatPrice(booking.totalPrice, "CAD")}</dd>
        </div>
      </dl>

      {booking.canModify ? (
        <>
          <section className="space-y-3 border-t pt-6">
            <h2 className="text-lg font-semibold">Change dates</h2>
            <Calendar
              mode="range"
              selected={range}
              onSelect={setRange}
              numberOfMonths={2}
              disabled={{ before: new Date() }}
            />
            <Button
              onClick={() => applyDateChange()}
              disabled={pending}
              className="cursor-pointer"
            >
              {pending ? "Updating…" : "Update dates"}
            </Button>
            {paymentClientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: paymentClientSecret,
                  appearance: { theme: "stripe" },
                }}
              >
                <DateChangePaymentForm onPaid={(id) => applyDateChange(id)} />
              </Elements>
            ) : null}
          </section>

          <section className="space-y-3 border-t pt-6">
            <h2 className="text-lg font-semibold">Special requests</h2>
            <div className="space-y-1.5">
              <Label htmlFor="specialRequests">Optional notes for the hotel</Label>
              <textarea
                id="specialRequests"
                rows={3}
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:ring-3"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleSaveRequests}
              disabled={pending}
              className="cursor-pointer"
            >
              Save requests
            </Button>
          </section>

          <section className="border-t pt-6">
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={pending}
              className="cursor-pointer"
            >
              Cancel reservation
            </Button>
            <p className="text-muted-foreground mt-2 text-xs">
              Free cancellation policy applies where noted at booking. Refunds are
              processed manually by the hotel.
            </p>
          </section>
        </>
      ) : null}
    </div>
  )
}
