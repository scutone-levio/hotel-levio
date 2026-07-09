"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { CalendarDays, Loader2, Trash2, Users } from "lucide-react"

import type { CartItem } from "@/lib/cart"
import { useCart } from "@/lib/cart"
import { formatPrice } from "@/lib/rooms"
import { createCartPaymentIntent, finalizeCartBookings } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/* ---------- Guest info form (step 1) ---------- */

type GuestInfo = {
  firstName: string
  lastName: string
  email: string
  phone: string
  specialRequests: string
}

function validate(g: GuestInfo) {
  const e: Partial<Record<keyof GuestInfo, string>> = {}
  if (!g.firstName.trim()) e.firstName = "Required"
  if (!g.lastName.trim()) e.lastName = "Required"
  if (!g.email.trim()) e.email = "Required"
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email)) e.email = "Invalid email"
  return e
}

/* ---------- Payment step (step 2, needs Stripe context) ---------- */

function PaymentStep({
  items,
  serverTotal,
  guestInfo,
  publishableKey,
  clientSecret,
}: {
  items: CartItem[]
  serverTotal: number
  guestInfo: GuestInfo
  publishableKey: string
  clientSecret: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const { clearCart } = useCart()

  const [status, setStatus] = React.useState<"idle" | "processing" | "error">("idle")
  const [stripeError, setStripeError] = React.useState<string | null>(null)

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setStatus("processing")
    setStripeError(null)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    })

    if (error) {
      setStripeError(error.message ?? "Payment failed")
      setStatus("error")
      return
    }

    if (paymentIntent?.status === "succeeded") {
      const result = await finalizeCartBookings({
        items: items.map((i) => ({
          roomId: i.roomId,
          checkIn: i.checkIn,
          checkOut: i.checkOut,
          guests: i.guests,
          subcategoryId: i.subcategoryId,
        })),
        guestName: `${guestInfo.firstName.trim()} ${guestInfo.lastName.trim()}`,
        guestEmail: guestInfo.email.trim(),
        guestPhone: guestInfo.phone.trim() || undefined,
        specialRequests: guestInfo.specialRequests.trim() || undefined,
        stripePaymentIntentId: paymentIntent.id,
      })

      if (result.ok) {
        clearCart()
        router.push(`/cart/confirmation?ids=${result.bookingIds.join(",")}`)
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
    <form onSubmit={handlePay} className="space-y-5">
      <div className="rounded-xl border p-4">
        <PaymentElement />
      </div>
      <p className="text-muted-foreground text-sm">
        Test card:{" "}
        <code className="bg-muted rounded px-1 py-0.5 text-xs">4242 4242 4242 4242</code>{" "}
        · any future date · any CVC
      </p>

      {stripeError && (
        <p className="text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          {stripeError}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full cursor-pointer" disabled={!stripe || status === "processing"}>
        {status === "processing" ? (
          <><Loader2 className="size-4 animate-spin" /> Processing…</>
        ) : (
          `Pay ${formatPrice(serverTotal, "CAD")}`
        )}
      </Button>
    </form>
  )
}

/* ---------- Main form component ---------- */

export function CartCheckoutForm({ publishableKey }: { publishableKey: string }) {
  const { items, removeItem } = useCart()
  const router = useRouter()

  const [guest, setGuest] = React.useState<GuestInfo>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    specialRequests: "",
  })
  const [errors, setErrors] = React.useState<Partial<Record<keyof GuestInfo, string>>>({})
  const [step, setStep] = React.useState<"review" | "payment">("review")
  const [clientSecret, setClientSecret] = React.useState<string | null>(null)
  const [serverTotal, setServerTotal] = React.useState(0)
  const [isPending, startTransition] = React.useTransition()

  const clientTotal = items.reduce((s, i) => s + i.totalPrice, 0)

  const stripePromise = React.useMemo(() => loadStripe(publishableKey), [publishableKey])

  function field(key: keyof GuestInfo) {
    return {
      value: guest[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setGuest((g) => ({ ...g, [key]: e.target.value }))
        setErrors((err) => ({ ...err, [key]: undefined }))
      },
      "aria-invalid": !!errors[key],
    }
  }

  function handleProceed() {
    const errs = validate(guest)
    if (Object.keys(errs).length) { setErrors(errs); return }

    startTransition(async () => {
      const result = await createCartPaymentIntent(
        items.map((i) => ({
          roomId: i.roomId,
          checkIn: i.checkIn,
          checkOut: i.checkOut,
          guests: i.guests,
          subcategoryId: i.subcategoryId,
        })),
      )
      if (result.ok) {
        setClientSecret(result.clientSecret)
        setServerTotal(result.quotedItems.reduce((s, q) => s + q.total, 0))
        setStep("payment")
      } else {
        alert(result.error)
      }
    })
  }

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground text-lg">Your cart is empty.</p>
        <Button className="mt-6 cursor-pointer" onClick={() => router.push("/#rooms")}>
          Browse rooms
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-10 lg:grid-cols-5">
      {/* Left column */}
      <div className="space-y-8 lg:col-span-3">
        {step === "review" ? (
          <>
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Guest information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["firstName", "lastName"] as const).map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label htmlFor={k}>
                      {k === "firstName" ? "First name" : "Last name"}{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input id={k} placeholder={k === "firstName" ? "Marie" : "Dupont"} {...field(k)} />
                    {errors[k] && <p className="text-destructive text-xs">{errors[k]}</p>}
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input id="email" type="email" placeholder="marie@example.com" {...field("email")} />
                {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" placeholder="+1 (514) 555-0100" {...field("phone")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="specialRequests">Special requests</Label>
                <textarea
                  id="specialRequests"
                  rows={3}
                  placeholder="Early check-in, dietary needs…"
                  className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:ring-3"
                  {...field("specialRequests")}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                <span className="text-destructive">*</span> Required. Guest info applies to all rooms in this order.
              </p>
            </section>

            <Button
              size="lg"
              className="w-full cursor-pointer"
              onClick={handleProceed}
              disabled={isPending}
            >
              {isPending ? <><Loader2 className="size-4 animate-spin" /> Preparing payment…</> : "Proceed to payment →"}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Payment</h2>
              <Button variant="ghost" size="sm" onClick={() => setStep("review")}>
                ← Back
              </Button>
            </div>
            {clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
                <PaymentStep
                  items={items}
                  serverTotal={serverTotal}
                  guestInfo={guest}
                  publishableKey={publishableKey}
                  clientSecret={clientSecret}
                />
              </Elements>
            )}
          </>
        )}
      </div>

      {/* Right column — order summary */}
      <aside className="lg:col-span-2">
        <div className="sticky top-24 space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Order summary</h2>

          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                {item.imageUrl && (
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg">
                    <Image src={item.imageUrl} alt={item.roomName} fill sizes="64px" className="object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-medium leading-none">{item.roomName}</p>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <CalendarDays className="size-3" />
                    {format(new Date(item.checkIn), "MMM d")} – {format(new Date(item.checkOut), "MMM d, yyyy")}
                  </p>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Users className="size-3" />
                    {item.guests} guest{item.guests !== 1 ? "s" : ""} · {item.nights} night{item.nights !== 1 ? "s" : ""}
                  </p>
                  <p className="text-sm font-semibold">{formatPrice(item.totalPrice, "CAD")}</p>
                </div>
                {step === "review" && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
                    aria-label="Remove"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{items.length} room{items.length !== 1 ? "s" : ""}</span>
              <span>{formatPrice(clientTotal, "CAD")}</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span>Total (CAD)</span>
              <span>{formatPrice(step === "payment" ? serverTotal : clientTotal, "CAD")}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
