import { notFound, redirect } from "next/navigation"
import { startOfDay } from "date-fns"

import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { quoteRange } from "@/lib/pricing"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ReserveForm } from "@/components/reserve-form"

export const metadata = { title: "Reserve — Hôtel Levio" }

export default async function ReservePage({
  searchParams,
}: {
  searchParams: Promise<{
    roomId?: string
    checkIn?: string
    checkOut?: string
    guests?: string
  }>
}) {
  const { roomId, checkIn, checkOut, guests } = await searchParams

  if (!roomId || !checkIn || !checkOut) redirect("/")

  const checkInDate = startOfDay(new Date(checkIn))
  const checkOutDate = startOfDay(new Date(checkOut))
  const guestCount = Math.max(1, parseInt(guests ?? "1", 10))

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) redirect("/")
  if (checkOutDate <= checkInDate) redirect("/")

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { priceRules: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  })
  if (!room) notFound()

  const quote = quoteRange(room.basePrice, room.priceRules, checkInDate, checkOutDate)

  // Create a PaymentIntent so the client can render Stripe Elements immediately.
  const paymentIntent = await stripe.paymentIntents.create({
    amount: quote.total,
    currency: "cad",
    automatic_payment_methods: { enabled: true },
    metadata: {
      roomId: room.id,
      roomName: room.name,
      checkIn: checkInDate.toISOString(),
      checkOut: checkOutDate.toISOString(),
      guests: String(guestCount),
      nights: String(quote.nights),
    },
  })

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">
              Complete your reservation
            </h1>
            <p className="text-muted-foreground mt-1">
              Review your stay and enter your details to confirm.
            </p>
          </div>

          <ReserveForm
            room={{
              id: room.id,
              name: room.name,
              imageUrl: room.images[0]?.url ?? null,
            }}
            checkIn={checkInDate.toISOString()}
            checkOut={checkOutDate.toISOString()}
            guests={guestCount}
            quote={{ nights: quote.nights, total: quote.total }}
            clientSecret={paymentIntent.client_secret!}
            publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}
