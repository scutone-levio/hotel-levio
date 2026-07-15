import { redirect } from "next/navigation"
import { startOfDay } from "date-fns"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { partitionBookings, getDisplayRoomName } from "@/lib/account-bookings"
import { ReservationsList } from "@/components/account/reservations-list"
import { PageHeader } from "@/components/page-header"
import { ExportCsvButton } from "@/components/account/export-csv-button"

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
    roomName: getDisplayRoomName(b.room.name),
  }))

  const { upcoming, past } = partitionBookings(rows, startOfDay(new Date()))

  return (
    <>
      <PageHeader
        eyebrow="My account"
        title="Reservations"
        subtitle="View upcoming stays and past bookings."
      />
      {rows.length > 0 && (
        <div className="mb-6">
          <ExportCsvButton />
        </div>
      )}
      <ReservationsList upcoming={upcoming} past={past} />
    </>
  )
}
