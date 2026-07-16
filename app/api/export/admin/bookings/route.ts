import { differenceInCalendarDays, format } from "date-fns"

import { auth } from "@/auth"
import { buildCsv } from "@/lib/csv"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const EXPORT_LIMIT = 20_000
const NO_CACHE = "private, no-store"
const VALID_STATUSES = new Set(["ALL", "PENDING", "CONFIRMED", "CANCELLED"])

const HEADERS = [
  "Booking ID",
  "Guest Name",
  "Guest Email",
  "Guest Phone",
  "Room",
  "Room Number",
  "Room Type",
  "Check-in",
  "Check-out",
  "Nights",
  "Guests",
  "Total (CAD)",
  "Status",
  "Special Requests",
  "Stripe Session ID",
  "Created",
]

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": NO_CACHE },
    })
  }
  if (session.user.role !== "ADMIN") {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Cache-Control": NO_CACHE },
    })
  }

  const { searchParams } = new URL(req.url)
  const rawStatus = searchParams.get("status")
  const status = !rawStatus ? "ALL" : rawStatus
  if (!VALID_STATUSES.has(status)) {
    return new Response("Invalid status filter.", {
      status: 400,
      headers: { "Cache-Control": NO_CACHE },
    })
  }
  const search = searchParams.get("search")?.trim() ?? ""
  const roomId = searchParams.get("roomId") ?? ""

  const where: Record<string, unknown> = {}
  if (roomId) where.roomId = roomId
  if (status !== "ALL") where.status = status
  if (search) {
    where.OR = [
      { guestName: { contains: search, mode: "insensitive" } },
      { guestEmail: { contains: search, mode: "insensitive" } },
      { room: { name: { contains: search, mode: "insensitive" } } },
    ]
  }

  try {
    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_LIMIT + 1,
      include: {
        room: {
          select: {
            name: true,
            roomNumber: true,
          },
        },
        roomType: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    })

    if (bookings.length > EXPORT_LIMIT) {
      return new Response(
        "Export exceeds 20,000 rows. Please narrow your filters and try again.",
        { status: 413, headers: { "Cache-Control": NO_CACHE } },
      )
    }

    const rows = bookings.map((b) => [
      b.id,
      b.guestName ?? b.user.name,
      b.guestEmail ?? b.user.email,
      b.guestPhone,
      b.room.name,
      b.room.roomNumber,
      b.roomType?.name ?? null,
      format(new Date(b.checkIn), "yyyy-MM-dd"),
      format(new Date(b.checkOut), "yyyy-MM-dd"),
      String(differenceInCalendarDays(new Date(b.checkOut), new Date(b.checkIn))),
      String(b.guests),
      (b.totalPrice / 100).toFixed(2),
      b.status,
      b.specialRequests,
      b.stripeSessionId,
      format(new Date(b.createdAt), "yyyy-MM-dd"),
    ])

    const filename = `reservations-${format(new Date(), "yyyy-MM-dd")}.csv`
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
    console.error("Admin CSV export error:", err)
    return new Response("Export failed. Please try again.", {
      status: 500,
      headers: { "Cache-Control": NO_CACHE },
    })
  }
}
