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
import { CalendarDays, Loader2, Trash2, Users } from "lucide-react"

import type { CartItem } from "@/lib/cart"
import { useCart } from "@/lib/cart"
import { BOOKING_ACTION_BUTTON_CLASS, formatPrice } from "@/lib/rooms"
import { createCartPaymentIntent, finalizeCartBookings } from "@/app/actions"
import { AuthPanel } from "@/components/auth-panel"
import type { OAuthProvider } from "@/lib/oauth"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Step = "review" | "account" | "payment"

function PaymentStep({
  items,
  serverTotal,
  specialRequests,
}: {
  items: CartItem[]
  serverTotal: number
  specialRequests: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const { clearCart } = useCart()

  const [status, setStatus] = React.useState<"idle" | "processing" | "error">(
    "idle",
  )
  const [stripeError, setStripeError] = React.useState<string | null>(null)

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setStatus("processing")
    setStripeError(null)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setStripeError(submitError.message ?? "Payment failed")
      setStatus("error")
      return
    }

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
        specialRequests: specialRequests.trim() || undefined,
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
        <code className="bg-muted rounded px-1 py-0.5 text-xs">
          4242 4242 4242 4242
        </code>{" "}
        · any future date · any CVC
      </p>

      {stripeError && (
        <p className="text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          {stripeError}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className={cn("w-full cursor-pointer", BOOKING_ACTION_BUTTON_CLASS)}
        disabled={!stripe || !elements || status === "processing"}
      >
        {status === "processing" ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Processing…
          </>
        ) : (
          `Pay ${formatPrice(serverTotal, "CAD")}`
        )}
      </Button>
    </form>
  )
}

function CartCheckoutStepPanel({
  step,
  isAuthenticated,
  oauthEnabled,
  oauthProviders,
  specialRequests,
  setSpecialRequests,
  setStep,
  startPayment,
  isPending,
  clientSecret,
  stripePromise,
  items,
  serverTotal,
}: {
  step: Step
  isAuthenticated: boolean
  oauthEnabled: boolean
  oauthProviders: OAuthProvider[]
  specialRequests: string
  setSpecialRequests: (value: string) => void
  setStep: (step: Step) => void
  startPayment: () => void
  isPending: boolean
  clientSecret: string | null
  stripePromise: ReturnType<typeof loadStripe>
  items: CartItem[]
  serverTotal: number
}) {
  if (step === "review") {
    return (
      <>
        <section className="space-y-4">
          <h2 className="text-lg">Review your stay</h2>
          <p className="text-muted-foreground text-sm">
            {isAuthenticated
              ? "Add any special requests, then continue to payment."
              : "Sign in or create an account before payment to complete your reservation."}
          </p>
        </section>
        <Button
          size="lg"
          className={cn("w-full cursor-pointer", BOOKING_ACTION_BUTTON_CLASS)}
          onClick={() => setStep("account")}
        >
          {isAuthenticated ? "Continue →" : "Continue to sign in →"}
        </Button>
      </>
    )
  }

  if (step === "account") {
    return (
      <>
        <div className="flex items-center justify-between">
          <h2 className="text-lg">Your account</h2>
          <Button variant="ghost" size="sm" onClick={() => setStep("review")}>
            ← Back
          </Button>
        </div>
        <AuthPanel
          callbackUrl="/cart"
          compact
          oauthEnabled={oauthEnabled}
          oauthProviders={oauthProviders}
        />
        {isAuthenticated ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="specialRequests">Special requests (optional)</Label>
              <textarea
                id="specialRequests"
                rows={3}
                placeholder="Early check-in, dietary needs…"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:ring-3"
              />
            </div>
            <Button
              size="lg"
              className={cn("w-full cursor-pointer", BOOKING_ACTION_BUTTON_CLASS)}
              onClick={startPayment}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Preparing payment…
                </>
              ) : (
                "Continue to payment →"
              )}
            </Button>
          </>
        ) : null}
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Payment</h2>
        <Button variant="ghost" size="sm" onClick={() => setStep("account")}>
          ← Back
        </Button>
      </div>
      {clientSecret && (
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, appearance: { theme: "stripe" } }}
        >
          <PaymentStep
            items={items}
            serverTotal={serverTotal}
            specialRequests={specialRequests}
          />
        </Elements>
      )}
    </>
  )
}

export function CartCheckoutForm({
  publishableKey,
  isAuthenticated: initialAuthenticated = false,
  oauthEnabled = false,
  oauthProviders = [],
}: {
  publishableKey: string
  isAuthenticated?: boolean
  oauthEnabled?: boolean
  oauthProviders?: OAuthProvider[]
}) {
  const { items, removeItem } = useCart()
  const router = useRouter()
  const { status: sessionStatus } = useSession()

  const isAuthenticated =
    sessionStatus === "authenticated" ||
    (sessionStatus === "loading" && initialAuthenticated)

  const [specialRequests, setSpecialRequests] = React.useState("")
  const [step, setStep] = React.useState<Step>("review")
  const [clientSecret, setClientSecret] = React.useState<string | null>(null)
  const [serverTotal, setServerTotal] = React.useState(0)
  const [isPending, startTransition] = React.useTransition()

  const clientTotal = items.reduce((s, i) => s + i.totalPrice, 0)
  const stripePromise = React.useMemo(
    () => loadStripe(publishableKey),
    [publishableKey],
  )

  const startPayment = React.useCallback(() => {
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
  }, [items])

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground text-lg">Your cart is empty.</p>
        <Button className={cn("mt-6 cursor-pointer", BOOKING_ACTION_BUTTON_CLASS)} onClick={() => router.push("/#rooms")}>
          Browse rooms
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-10 lg:grid-cols-5">
      <div className="space-y-8 lg:col-span-3">
        <CartCheckoutStepPanel
          step={step}
          isAuthenticated={isAuthenticated}
          oauthEnabled={oauthEnabled}
          oauthProviders={oauthProviders}
          specialRequests={specialRequests}
          setSpecialRequests={setSpecialRequests}
          setStep={setStep}
          startPayment={startPayment}
          isPending={isPending}
          clientSecret={clientSecret}
          stripePromise={stripePromise}
          items={items}
          serverTotal={serverTotal}
        />
      </div>

      <aside className="lg:col-span-2">
        <div className="bg-card sticky top-24 space-y-4 rounded-xl border p-6">
          <h2 className="text-lg">Order summary</h2>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                {item.imageUrl && (
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={item.imageUrl}
                      alt={item.roomName}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm leading-none font-medium">{item.roomName}</p>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <CalendarDays className="size-3" />
                    {format(new Date(item.checkIn), "MMM d")} –{" "}
                    {format(new Date(item.checkOut), "MMM d, yyyy")}
                  </p>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Users className="size-3" />
                    {item.guests} guest{item.guests !== 1 ? "s" : ""} · {item.nights}{" "}
                    night{item.nights !== 1 ? "s" : ""}
                  </p>
                  <p className="text-sm font-semibold">
                    {formatPrice(item.totalPrice, "CAD")}
                  </p>
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
          <div className="space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {items.length} room{items.length !== 1 ? "s" : ""}
              </span>
              <span>{formatPrice(clientTotal, "CAD")}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total (CAD)</span>
              <span>
                {formatPrice(step === "payment" ? serverTotal : clientTotal, "CAD")}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
