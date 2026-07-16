import { differenceInCalendarDays, format } from "date-fns"

import { auth } from "@/auth"
import { buildCsv } from "@/lib/csv"
import { getDisplayRoomName } from "@/lib/account-bookings"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const NO_CACHE = "private, no-store"

const HEADERS = [
  "Booking ID",
  "Room",
  "Check-in",
  "Check-out",
  "Nights",
  "Guests",
  "Total (CAD)",
  "Status",
  "Special Requests",
]

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": NO_CACHE },
    })
  }
  if (session.user.role !== "CUSTOMER") {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Cache-Control": NO_CACHE },
    })
  }

  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: session.user.id },
      orderBy: { checkIn: "desc" },
      include: { room: { select: { name: true } } },
    })

    const rows = bookings.map((b) => [
      b.id.slice(-8).toUpperCase(),
      getDisplayRoomName(b.room.name),
      format(new Date(b.checkIn), "yyyy-MM-dd"),
      format(new Date(b.checkOut), "yyyy-MM-dd"),
      String(differenceInCalendarDays(new Date(b.checkOut), new Date(b.checkIn))),
      String(b.guests),
      (b.totalPrice / 100).toFixed(2),
      b.status,
      b.specialRequests,
    ])

    const filename = `my-reservations-${format(new Date(), "yyyy-MM-dd")}.csv`
    // UTF-8 BOM so Excel reliably detects the encoding instead of guessing
    // (guest names/addresses can contain accented characters).
    const csv = "\uFEFF" + buildCsv(HEADERS, rows)

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": NO_CACHE,
      },
    })
  } catch (err) {
    console.error("Customer CSV export error:", err)
    return new Response("Export failed. Please try again.", {
      status: 500,
      headers: { "Cache-Control": NO_CACHE },
    })
  }
}
