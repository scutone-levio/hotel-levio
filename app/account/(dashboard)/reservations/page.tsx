import { redirect } from "next/navigation"
import { startOfDay } from "date-fns"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { partitionBookings } from "@/lib/account-bookings"
import { ReservationsList } from "@/components/account/reservations-list"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "My Reservations — Hôtel Levio" }

export default async function AccountReservationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/account/login")

  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: {
      room: { select: { name: true } },
    },
    orderBy: { checkIn: "desc" },
  })

  const rows = bookings.map((b) => ({
    id: b.id,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    status: b.status,
    totalPrice: b.totalPrice,
    roomName: b.room.name.split(" · ")[0],
  }))

  const { upcoming, past } = partitionBookings(rows, startOfDay(new Date()))

  return (
    <>
      <PageHeader
        eyebrow="My account"
        title="Reservations"
        subtitle="View upcoming stays and past bookings."
      />
      <ReservationsList upcoming={upcoming} past={past} />
    </>
  )
}
