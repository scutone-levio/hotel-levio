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
import { CalendarDays, Users } from "lucide-react"

import { finalizeBooking } from "@/app/actions"
import { formatPrice } from "@/lib/rooms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/* ---------- Types ---------- */

type RoomSummary = { id: string; name: string; imageUrl: string | null }
type Quote = { nights: number; total: number }

type FormProps = {
  room: RoomSummary
  checkIn: string
  checkOut: string
  guests: number
  quote: Quote
  clientSecret: string
  publishableKey: string
}

/* ---------- Inner form (needs Stripe context) ---------- */

function PaymentForm({
  room,
  checkIn,
  checkOut,
  guests,
  quote,
}: Omit<FormProps, "clientSecret" | "publishableKey">) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [specialRequests, setSpecialRequests] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [status, setStatus] = React.useState<"idle" | "processing" | "error">("idle")
  const [stripeError, setStripeError] = React.useState<string | null>(null)

  const checkInDate = new Date(checkIn)
  const checkOutDate = new Date(checkOut)

  function validate() {
    const e: Record<string, string> = {}
    if (!firstName.trim()) e.firstName = "First name is required."
    if (!lastName.trim()) e.lastName = "Last name is required."
    if (!email.trim()) {
      e.email = "Email is required."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = "Enter a valid email address."
    }
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setErrors({})
    setStripeError(null)
    setStatus("processing")

    // Confirm the PaymentIntent — stays on page (no redirect for card payments).
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
        guestName: `${firstName.trim()} ${lastName.trim()}`,
        guestEmail: email.trim(),
        guestPhone: phone.trim() || undefined,
        specialRequests: specialRequests.trim() || undefined,
        stripePaymentIntentId: paymentIntent.id,
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
        {/* Left — guest details + payment */}
        <div className="space-y-8 lg:col-span-3">
          {/* Guest info */}
          <section className="space-y-4">
            <h2 className="text-lg">Guest information</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">
                  First name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  placeholder="Marie"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value)
                    setErrors((p) => ({ ...p, firstName: "" }))
                  }}
                  aria-invalid={!!errors.firstName}
                />
                {errors.firstName && (
                  <p className="text-destructive text-xs">{errors.firstName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lastName">
                  Last name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  placeholder="Dupont"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value)
                    setErrors((p) => ({ ...p, lastName: "" }))
                  }}
                  aria-invalid={!!errors.lastName}
                />
                {errors.lastName && (
                  <p className="text-destructive text-xs">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">
                Email address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="marie@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setErrors((p) => ({ ...p, email: "" }))
                }}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-destructive text-xs">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Telephone number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (514) 555-0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="specialRequests">Special requests</Label>
              <textarea
                id="specialRequests"
                rows={3}
                placeholder="Early check-in, accessibility needs, dietary preferences…"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:ring-3"
              />
            </div>

            <p className="text-muted-foreground text-xs">
              Fields marked <span className="text-destructive">*</span> are required.
            </p>
          </section>

          {/* Payment */}
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
            <p className="text-destructive text-sm rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              {stripeError}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!stripe || status === "processing"}
          >
            {status === "processing"
              ? "Processing payment…"
              : `Pay ${formatPrice(quote.total)}`}
          </Button>
        </div>

        {/* Right — booking summary */}
        <aside className="lg:col-span-2">
          <div className="sticky top-24 rounded-xl border bg-card p-6 space-y-5">
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
              <p className="font-semibold text-lg">{room.name}</p>
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

            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {quote.nights} night{quote.nights > 1 ? "s" : ""}
                </span>
                <span>{formatPrice(quote.total)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base">
                <span>Total (CAD)</span>
                <span>{formatPrice(quote.total)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </form>
  )
}

/* ---------- Outer wrapper — provides Stripe context ---------- */

export function ReserveForm(props: FormProps) {
  const stripePromise = React.useMemo(
    () => loadStripe(props.publishableKey),
    [props.publishableKey],
  )

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: { theme: "stripe" },
      }}
    >
      <PaymentForm {...props} />
    </Elements>
  )
}
