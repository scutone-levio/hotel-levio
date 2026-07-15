import { notFound, redirect } from "next/navigation"
import { startOfDay } from "date-fns"

import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { quoteRange } from "@/lib/pricing"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ReserveForm } from "@/components/reserve-form"
import { PageHeader } from "@/components/page-header"
import { getOAuthProviders, isOAuthEnabled } from "@/lib/oauth"
import { listingCoverImageUrl } from "@/lib/listing-images"
import { auth } from "@/auth"

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
    include: {
      priceRules: true,
      images: { orderBy: { sortOrder: "asc" } },
      subcategory: {
        include: { images: { orderBy: { sortOrder: "asc" } } },
      },
    },
  })
  if (!room) notFound()

  const catalogRoom = room.isCatalog
    ? room
    : await prisma.room.findFirst({
        where: { type: room.type, isCatalog: true },
        include: { images: { orderBy: { sortOrder: "asc" } } },
      })
  const catalogImages = catalogRoom?.images.length ? catalogRoom.images : room.images
  const listingImageUrl = listingCoverImageUrl(
    catalogImages,
    room.subcategory?.images,
  )

  const quote = quoteRange(room.basePrice, room.priceRules, checkInDate, checkOutDate)

  // Only create a PaymentIntent once the user is signed in — anonymous page
  // loads/refreshes must not spawn Stripe intents.
  const session = await auth()
  const paymentIntent = session?.user?.id
    ? await stripe.paymentIntents.create(
        {
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
        },
        {
          idempotencyKey: `reserve_${session.user.id}_${roomId}_${checkIn}_${checkOut}`,
        },
      )
    : null

  const callbackUrl = `/reserve?roomId=${roomId}&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${guestCount}`
  const oauthProviders = getOAuthProviders()
  const oauthEnabled = isOAuthEnabled()

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <PageHeader
            eyebrow="One more step"
            title="Complete your reservation"
            subtitle="Sign in to your account, then confirm payment."
          />

          <ReserveForm
            room={{
              id: room.id,
              name: room.name,
              imageUrl: listingImageUrl,
            }}
            checkIn={checkInDate.toISOString()}
            checkOut={checkOutDate.toISOString()}
            guests={guestCount}
            quote={{ nights: quote.nights, total: quote.total }}
            clientSecret={paymentIntent?.client_secret ?? null}
            publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
            callbackUrl={callbackUrl}
            oauthEnabled={oauthEnabled}
            oauthProviders={oauthProviders}
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}
