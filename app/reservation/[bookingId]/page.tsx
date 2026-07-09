import Link from "next/link"
import { notFound } from "next/navigation"
import { MapPin } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PrintButton } from "@/components/print-button"
import { ConfirmationHeader } from "@/components/confirmation-header"
import { ConfirmationDetailsCard } from "@/components/confirmation-details-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export const metadata = { title: "Reservation Confirmed — Hôtel Levio" }
export const dynamic = "force-dynamic"

export default async function ReservationPage({
  params,
}: Readonly<{
  params: Promise<{ bookingId: string }>
}>) {
  const { bookingId } = await params

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      room: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
      user: true,
    },
  })

  if (!booking) notFound()

  const checkIn = new Date(booking.checkIn)
  const checkOut = new Date(booking.checkOut)
  const guestName = booking.guestName ?? booking.user.name ?? "Guest"
  const guestEmail = booking.guestEmail ?? booking.user.email

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12">
          {/* Header */}
          <ConfirmationHeader
            eyebrow="You're all set"
            title="Reservation confirmed!"
            description={
              <>
                Thank you, {guestName.split(" ")[0]}. A confirmation has been
                sent to {guestEmail}.
              </>
            }
          >
            <div className="mt-3 flex items-center justify-center gap-2">
              <Badge
                variant={
                  booking.status === "CONFIRMED" ? "default" : "secondary"
                }
              >
                {booking.status === "CONFIRMED"
                  ? "Confirmed"
                  : "Pending confirmation"}
              </Badge>
              <span className="text-muted-foreground text-sm">
                Booking #{booking.id.slice(-8).toUpperCase()}
              </span>
            </div>
          </ConfirmationHeader>

          {/* Summary card */}
          <div className="bg-card rounded-2xl border shadow-sm">
            {/* Room */}
            <div className="border-b p-6">
              <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">
                Room
              </p>
              <p className="text-xl font-semibold">{booking.room.name}</p>
              <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                <MapPin className="size-3.5" />
                1801 av. McGill College, bureau 1055, Montréal (QC) H3A 2N4
              </div>
            </div>

            <ConfirmationDetailsCard
              checkIn={checkIn}
              checkOut={checkOut}
              guests={booking.guests}
              totalPrice={booking.totalPrice}
              guestName={guestName}
              guestEmail={guestEmail}
              guestPhone={booking.guestPhone}
              specialRequests={booking.specialRequests}
              showGuestDetails
              showTaxesRow
              priceTitle="Payment summary"
              totalLabel="Booking total"
            />
          </div>

          {/* Cancellation note */}
          <p className="text-muted-foreground mt-6 text-center text-sm">
            Free cancellation up to 48 hours before check-in. Contact us at{" "}
            <a
              href="mailto:bonjour@hotellevio.com"
              className="text-primary underline-offset-4 hover:underline"
            >
              bonjour@hotellevio.com
            </a>{" "}
            or{" "}
            <a
              href="tel:+15145550199"
              className="text-primary underline-offset-4 hover:underline"
            >
              +1 (514) 555-0199
            </a>
            {"."}
          </p>

          {/* Actions */}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center print:hidden">
            <PrintButton />
            <Button asChild className="w-full sm:w-auto">
              <Link href="/">Back to hotel</Link>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
