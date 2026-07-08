import { startOfDay, startOfMonth, endOfMonth } from "date-fns"

import { prisma } from "@/lib/prisma"
import { getRoomsForAdmin } from "@/lib/queries"
import { formatPrice } from "@/lib/rooms"
import { ReservationsTable } from "@/components/admin/reservations-table"

export const metadata = { title: "Reservations — Hôtel Levio Admin" }
export const dynamic = "force-dynamic"

async function getReservationStats() {
  const now = new Date()
  const today = startOfDay(now)
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const [arrivalsToday, pendingCount, revenueMTD, rooms] = await Promise.all([
    prisma.booking.count({
      where: {
        checkIn: today,
        status: { not: "CANCELLED" },
      },
    }),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: {
        status: "CONFIRMED",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    getRoomsForAdmin(),
  ])

  // Occupancy: rooms that have a confirmed booking overlapping today
  const occupiedToday = await prisma.booking.count({
    where: {
      status: "CONFIRMED",
      checkIn: { lt: new Date(today.getTime() + 86_400_000) },
      checkOut: { gt: today },
    },
  })

  const totalRooms = rooms.length || 1
  const occupancy = Math.round((occupiedToday / totalRooms) * 100)
  const revenue = revenueMTD._sum.totalPrice ?? 0

  return { arrivalsToday, occupancy, revenue, pendingCount }
}

export default async function AdminReservationsPage() {
  const stats = await getReservationStats()

  const statCards = [
    { label: "Arrivals today", value: String(stats.arrivalsToday), accent: false },
    { label: "Occupancy", value: `${stats.occupancy}%`, accent: false },
    { label: "Revenue MTD", value: formatPrice(stats.revenue, "CAD"), accent: false },
    { label: "Pending", value: String(stats.pendingCount), accent: true },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            All hotel bookings — search, filter, edit, or cancel.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border bg-card p-4 ${s.accent ? "border-primary/60" : ""}`}
          >
            <p
              className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${
                s.accent ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </p>
            <p
              className={`text-2xl font-bold tabular-nums ${
                s.accent ? "text-primary" : ""
              }`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <ReservationsTable />
    </div>
  )
}
