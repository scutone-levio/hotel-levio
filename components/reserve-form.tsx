"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { useSession } from "next-auth/react"
import { CalendarDays, Users } from "lucide-react"

import { finalizeBooking } from "@/app/actions"
import { AuthPanel } from "@/components/auth-panel"
import type { OAuthProvider } from "@/lib/oauth"
import { formatPrice } from "@/lib/rooms"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type RoomSummary = { id: string; name: string; imageUrl: string | null }
type Quote = { nights: number; total: number }

type FormProps = {
  room: RoomSummary
  checkIn: string
  checkOut: string
  guests: number
  quote: Quote
  clientSecret: string | null
  publishableKey: string
  callbackUrl: string
  oauthEnabled?: boolean
  oauthProviders?: OAuthProvider[]
  subcategoryId?: string
}

function PaymentForm({
  room,
  checkIn,
  checkOut,
  guests,
  quote,
  subcategoryId,
}: Omit<FormProps, "clientSecret" | "publishableKey" | "callbackUrl">) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [specialRequests, setSpecialRequests] = React.useState("")
  const [status, setStatus] = React.useState<"idle" | "processing" | "error">(
    "idle",
  )
  const [stripeError, setStripeError] = React.useState<string | null>(null)

  const checkInDate = new Date(checkIn)
  const checkOutDate = new Date(checkOut)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setStripeError(null)
    setStatus("processing")

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    })

    if (error) {
      setStripeError(error.message ?? "Payment failed. Please try again.")
      setStatus("error")
      return
    }

    if (paymentIntent?.status === "succeeded") {
      const result = await finalizeBooking({
        roomId: room.id,
        checkIn,
        checkOut,
        guests,
        specialRequests: specialRequests.trim() || undefined,
        stripePaymentIntentId: paymentIntent.id,
        subcategoryId,
      })

      if (result.ok) {
        router.push(`/reservation/${result.bookingId}`)
      } else {
        setStripeError(result.error)
        setStatus("error")
      }
    } else {
      setStripeError("Payment was not completed. Please try again.")
      setStatus("error")
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-8 lg:col-span-3">
          <section className="space-y-4">
            <h2 className="text-lg">Special requests</h2>
            <div className="space-y-1.5">
              <Label htmlFor="specialRequests">Optional notes for the hotel</Label>
              <textarea
                id="specialRequests"
                rows={3}
                placeholder="Early check-in, accessibility needs, dietary preferences…"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:ring-3"
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg">Payment</h2>
            <p className="text-muted-foreground text-sm">
              Use test card{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">
                4242 4242 4242 4242
              </code>{" "}
              · any future date · any CVC.
            </p>
            <div className="rounded-xl border p-4">
              <PaymentElement />
            </div>
          </section>

          {stripeError && (
            <p className="text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
              {stripeError}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full cursor-pointer"
            disabled={!stripe || status === "processing"}
          >
            {status === "processing"
              ? "Processing payment…"
              : `Pay ${formatPrice(quote.total, "CAD")}`}
          </Button>
        </div>

        <aside className="lg:col-span-2">
          <div className="bg-card sticky top-24 space-y-5 rounded-xl border p-6">
            {room.imageUrl && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
                <Image
                  src={room.imageUrl}
                  alt={room.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 400px"
                  className="object-cover"
                />
              </div>
            )}

            <div>
              <p className="text-lg font-semibold">{room.name}</p>
              <p className="text-muted-foreground text-sm">Hôtel Levio · Montréal</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="text-muted-foreground size-4 shrink-0" />
                <span>
                  {format(checkInDate, "MMM d, yyyy")} →{" "}
                  {format(checkOutDate, "MMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="text-muted-foreground size-4 shrink-0" />
                <span>
                  {guests} guest{guests > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {quote.nights} night{quote.nights > 1 ? "s" : ""}
                </span>
                <span>{formatPrice(quote.total, "CAD")}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total (CAD)</span>
                <span>{formatPrice(quote.total, "CAD")}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </form>
  )
}

export function ReserveForm(props: FormProps) {
  const { status } = useSession()
  const stripePromise = React.useMemo(
    () => loadStripe(props.publishableKey),
    [props.publishableKey],
  )

  if (status === "loading") {
    return (
      <p className="text-muted-foreground text-center text-sm">Loading account…</p>
    )
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-muted-foreground text-sm">
          Sign in or create an account to complete payment.
        </p>
        <AuthPanel
          callbackUrl={props.callbackUrl}
          oauthEnabled={props.oauthEnabled}
          oauthProviders={props.oauthProviders}
        />
      </div>
    )
  }

  const { clientSecret } = props
  if (!clientSecret) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        Unable to prepare payment. Please refresh the page and try again.
      </p>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: "stripe" },
      }}
    >
      <PaymentForm {...props} />
    </Elements>
  )
}
