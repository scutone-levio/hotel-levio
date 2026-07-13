"use client"

import Link from "next/link"
import { format } from "date-fns"

import type { BookingListRow } from "@/lib/account-bookings"
import { formatPrice } from "@/lib/rooms"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function ReservationsList({
  upcoming,
  past,
}: {
  upcoming: BookingListRow[]
  past: BookingListRow[]
}) {
  return (
    <Tabs defaultValue="upcoming">
      <TabsList>
        <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
        <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming" className="mt-4 space-y-3">
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm">No upcoming reservations.</p>
        ) : (
          upcoming.map((b) => <ReservationCard key={b.id} booking={b} />)
        )}
      </TabsContent>

      <TabsContent value="past" className="mt-4 space-y-3">
        {past.length === 0 ? (
          <p className="text-muted-foreground text-sm">No past reservations.</p>
        ) : (
          past.map((b) => <ReservationCard key={b.id} booking={b} />)
        )}
      </TabsContent>
    </Tabs>
  )
}

function ReservationCard({ booking }: { booking: BookingListRow }) {
  return (
    <Link
      href={`/account/reservations/${booking.id}`}
      className="hover:bg-muted/40 block rounded-xl border p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{booking.roomName}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {format(booking.checkIn, "MMM d, yyyy")} →{" "}
            {format(booking.checkOut, "MMM d, yyyy")}
          </p>
        </div>
        <div className="text-right">
          <Badge variant={booking.status === "CANCELLED" ? "outline" : "secondary"}>
            {booking.status}
          </Badge>
          <p className="mt-2 text-sm font-semibold">
            {formatPrice(booking.totalPrice, "CAD")}
          </p>
        </div>
      </div>
    </Link>
  )
}
