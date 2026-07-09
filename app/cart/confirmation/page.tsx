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

export const metadata = { title: "Order Confirmed — Hôtel Levio" }
export const dynamic = "force-dynamic"

export default async function CartConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const { ids } = await searchParams
  if (!ids) notFound()

  const bookingIds = ids.split(",").filter(Boolean)
  if (!bookingIds.length) notFound()

  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    include: { room: true, user: true },
    orderBy: { checkIn: "asc" },
  })
  if (!bookings.length) notFound()

  const grandTotal = bookings.reduce((s, b) => s + b.totalPrice, 0)
  const first = bookings[0]
  const guestName = first.guestName ?? first.user.name ?? "Guest"
  const guestEmail = first.guestEmail ?? first.user.email

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
              {bookings.length > 1 ? "Rooms confirmed!" : "Reservation confirmed!"}
            </h1>
            <p className="text-muted-foreground mt-2">
              Thank you, {guestName.split(" ")[0]}. Confirmation emails have been
              sent to {guestEmail}.
            </p>
          </div>

          {/* One card per booking */}
          <div className="space-y-6">
            {bookings.map((booking, i) => {
              const checkIn = new Date(booking.checkIn)
              const checkOut = new Date(booking.checkOut)
              const nights = Math.round(
                (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
              )
              return (
                <div key={booking.id} className="rounded-2xl border bg-card shadow-sm">
                  {/* Room header */}
                  <div className="border-b p-5 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-muted-foreground mb-0.5 text-xs font-medium uppercase tracking-wider">
                        Room {i + 1}
                      </p>
                      <p className="text-lg font-semibold">{booking.room.name}</p>
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-sm">
                        <MapPin className="size-3.5" />
                        1801 av. McGill College, bureau 1055, Montréal (QC) H3A 2N4
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={booking.status === "CONFIRMED" ? "default" : "secondary"}>
                        {booking.status === "CONFIRMED" ? "Confirmed" : booking.status}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        #{booking.id.slice(-8).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid sm:grid-cols-3 border-b">
                    <div className="border-b sm:border-b-0 sm:border-r p-5">
                      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">Check-in</p>
                      <p className="font-semibold">{format(checkIn, "EEE, MMM d, yyyy")}</p>
                      <p className="text-muted-foreground text-sm">From 3:00 PM</p>
                    </div>
                    <div className="border-b sm:border-b-0 sm:border-r p-5">
                      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">Check-out</p>
                      <p className="font-semibold">{format(checkOut, "EEE, MMM d, yyyy")}</p>
                      <p className="text-muted-foreground text-sm">By 12:00 PM</p>
                    </div>
                    <div className="p-5">
                      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">Stay</p>
                      <p className="font-semibold flex items-center gap-1.5">
                        <CalendarDays className="size-4" />
                        {nights} night{nights !== 1 ? "s" : ""}
                      </p>
                      <p className="text-muted-foreground text-sm flex items-center gap-1.5">
                        <Users className="size-3.5" />
                        {booking.guests} guest{booking.guests !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="p-5 flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{nights} night{nights !== 1 ? "s" : ""}</span>
                    <span className="font-semibold">{formatPrice(booking.totalPrice, "CAD")}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Grand total */}
          {bookings.length > 1 && (
            <div className="mt-6 rounded-xl border bg-card p-5 flex justify-between font-semibold text-lg">
              <span>Total charged (CAD)</span>
              <span>{formatPrice(grandTotal, "CAD")}</span>
            </div>
          )}

          {/* Guest details */}
          <div className="mt-6 rounded-xl border bg-card p-5 text-sm space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-3">Guest details</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Name</p><p className="font-medium">{guestName}</p></div>
              <div><p className="text-muted-foreground">Email</p><p className="font-medium">{guestEmail}</p></div>
              {first.guestPhone && (
                <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{first.guestPhone}</p></div>
              )}
              {first.specialRequests && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Special requests</p>
                  <p className="font-medium">{first.specialRequests}</p>
                </div>
              )}
            </div>
          </div>

          {/* Cancellation note */}
          <p className="text-muted-foreground mt-6 text-center text-sm">
            Free cancellation up to 48 hours before check-in.{" "}
            <a href="mailto:bonjour@hotellevio.com" className="text-primary underline-offset-4 hover:underline">
              bonjour@hotellevio.com
            </a>{" "}
            · <a href="tel:+15145550199" className="text-primary underline-offset-4 hover:underline">+1 (514) 555-0199</a>
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
