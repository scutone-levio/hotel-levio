import Link from "next/link"
import { notFound } from "next/navigation"
import { MapPin } from "lucide-react"

import { prisma } from "@/lib/prisma"
import { formatPrice } from "@/lib/rooms"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PrintButton } from "@/components/print-button"
import { ConfirmationHeader } from "@/components/confirmation-header"
import { ConfirmationDetailsCard } from "@/components/confirmation-details-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export const metadata = { title: "Order Confirmed — Hôtel Levio" }
export const dynamic = "force-dynamic"

export default async function CartConfirmationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ ids?: string }>
}>) {
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
    <div className="bg-background flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12">
          {/* Header */}
          <ConfirmationHeader
            eyebrow="You're all set"
            title={
              bookings.length > 1
                ? "Rooms confirmed!"
                : "Reservation confirmed!"
            }
            description={
              <>
                Thank you, {guestName.split(" ")[0]}. Confirmation emails have
                been sent to {guestEmail}.
              </>
            }
          />

          {/* One card per booking */}
          <div className="space-y-6">
            {bookings.map((booking, i) => {
              const checkIn = new Date(booking.checkIn)
              const checkOut = new Date(booking.checkOut)

              return (
                <div
                  key={booking.id}
                  className="bg-card rounded-2xl border shadow-sm"
                >
                  {/* Room header */}
                  <div className="flex items-start justify-between gap-3 border-b p-5">
                    <div>
                      <p className="text-muted-foreground mb-0.5 text-xs font-medium tracking-wider uppercase">
                        Room {i + 1}
                      </p>
                      <p className="text-lg font-semibold">
                        {booking.room.name}
                      </p>
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-sm">
                        <MapPin className="size-3.5" />
                        1801 av. McGill College, bureau 1055, Montréal (QC) H3A
                        2N4
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={
                          booking.status === "CONFIRMED"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {booking.status === "CONFIRMED"
                          ? "Confirmed"
                          : booking.status}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        #{booking.id.slice(-8).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <ConfirmationDetailsCard
                    checkIn={checkIn}
                    checkOut={checkOut}
                    guests={booking.guests}
                    totalPrice={booking.totalPrice}
                    compact
                    priceTitle="Room payment summary"
                    totalLabel="Room total"
                  />
                </div>
              )
            })}
          </div>

          {/* Grand total */}
          {bookings.length > 1 && (
            <div className="bg-card mt-6 flex justify-between rounded-xl border p-5 text-lg font-semibold">
              <span>Total charged (CAD)</span>
              <span>{formatPrice(grandTotal, "CAD")}</span>
            </div>
          )}

          {/* Guest details */}
          <div className="bg-card mt-6 space-y-2 rounded-xl border p-5 text-sm">
            <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
              Guest details
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">{guestName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{guestEmail}</p>
              </div>
              {first.guestPhone && (
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{first.guestPhone}</p>
                </div>
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
            <a
              href="mailto:bonjour@hotellevio.com"
              className="text-primary underline-offset-4 hover:underline"
            >
              bonjour@hotellevio.com
            </a>{" "}
            ·{" "}
            <a
              href="tel:+15145550199"
              className="text-primary underline-offset-4 hover:underline"
            >
              +1 (514) 555-0199
            </a>
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
