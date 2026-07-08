import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

// Stripe needs the raw request body to verify the signature, so this route
// must never be statically optimized or have its body parsed/cached.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(req: Request) {
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set")
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    )
  }

  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  // Read the raw body exactly as sent — required for signature verification.
  const payload = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("⚠️  Webhook signature verification failed:", message)
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 },
    )
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object
        // Confirm the matching booking once payment succeeds.
        await prisma.booking
          .updateMany({
            where: { stripeSessionId: session.id },
            data: { status: "CONFIRMED" },
          })
          .catch((e) => console.error("Failed to confirm booking:", e))
        break
      }

      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object
        await prisma.booking
          .updateMany({
            where: { stripeSessionId: session.id },
            data: { status: "CANCELLED" },
          })
          .catch((e) => console.error("Failed to cancel booking:", e))
        break
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        console.log(`Unhandled Stripe event: ${event.type}`)
    }
  } catch (err) {
    console.error("Error handling webhook event:", err)
    return NextResponse.json({ error: "Handler error" }, { status: 500 })
  }

  // Acknowledge receipt so Stripe does not retry.
  return NextResponse.json({ received: true })
}
