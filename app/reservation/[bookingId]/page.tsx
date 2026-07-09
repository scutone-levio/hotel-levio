import { notFound } from "next/navigation"
import { format } from "date-fns"
import { CalendarDays, CheckCircle, MapPin, Users } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { formatPrice } from "@/lib/rooms"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PrintButton } from "@/components/print-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export const metadata = { title: "Reservation Confirmed — Hôtel Levio" }
export const dynamic = "force-dynamic"

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
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
  const nights = Math.round(
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
  )
  const guestName = booking.guestName ?? booking.user.name ?? "Guest"
  const guestEmail = booking.guestEmail ?? booking.user.email

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12">

          {/* Header */}
          <div className="mb-10 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="text-primary size-14" />
            </div>
            <h1 className="text-3xl tracking-tight">
              Reservation confirmed!
            </h1>
            <p className="text-muted-foreground mt-2">
              Thank you, {guestName.split(" ")[0]}. A confirmation has been sent
              to {guestEmail}.
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <Badge
                variant={booking.status === "CONFIRMED" ? "default" : "secondary"}
              >
                {booking.status === "CONFIRMED" ? "Confirmed" : "Pending confirmation"}
              </Badge>
              <span className="text-muted-foreground text-sm">
                Booking #{booking.id.slice(-8).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Summary card */}
          <div className="rounded-2xl border bg-card shadow-sm">
            {/* Room */}
            <div className="border-b p-6">
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">
                Room
              </p>
              <p className="text-xl font-semibold">{booking.room.name}</p>
              <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                <MapPin className="size-3.5" />
                1801 av. McGill College, bureau 1055, Montréal (QC) H3A 2N4
              </div>
            </div>

            {/* Dates + guests */}
            <div className="grid sm:grid-cols-3 border-b">
              <div className="border-b sm:border-b-0 sm:border-r p-6">
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">
                  Check-in
                </p>
                <p className="font-semibold">{format(checkIn, "EEE, MMM d, yyyy")}</p>
                <p className="text-muted-foreground text-sm">From 3:00 PM</p>
              </div>
              <div className="border-b sm:border-b-0 sm:border-r p-6">
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">
                  Check-out
                </p>
                <p className="font-semibold">{format(checkOut, "EEE, MMM d, yyyy")}</p>
                <p className="text-muted-foreground text-sm">By 12:00 PM</p>
              </div>
              <div className="p-6">
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">
                  Stay
                </p>
                <p className="font-semibold flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  {nights} night{nights > 1 ? "s" : ""}
                </p>
                <p className="text-muted-foreground text-sm flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {booking.guests} guest{booking.guests > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Guest details */}
            <div className="border-b p-6">
              <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
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
                {booking.guestPhone && (
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{booking.guestPhone}</p>
                  </div>
                )}
                {booking.specialRequests && (
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">Special requests</p>
                    <p className="font-medium">{booking.specialRequests}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="p-6">
              <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
                Payment summary
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {nights} night{nights > 1 ? "s" : ""}
                  </span>
                  <span>{formatPrice(booking.totalPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes &amp; fees</span>
                  <span>Included</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold text-base">
                  <span>Total charged (CAD)</span>
                  <span>{formatPrice(booking.totalPrice)}</span>
                </div>
              </div>
            </div>
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
            .
          </p>

          {/* Actions */}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center print:hidden">
            <PrintButton />
            <Button asChild className="w-full sm:w-auto">
              <a href="/">Back to hotel</a>
            </Button>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}
