import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { isUpcomingBooking, getDisplayRoomName } from "@/lib/account-bookings"
import { ReservationDetail } from "@/components/account/reservation-detail"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Reservation — Hôtel Levio" }

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/account/login")

  const { id } = await params
  const booking = await prisma.booking.findFirst({
    where: { id, userId: session.user.id },
    include: { room: { select: { name: true, roomNumber: true } } },
  })
  if (!booking) notFound()

  const canModify = isUpcomingBooking(booking)

  return (
    <>
      <PageHeader eyebrow="My account" title="Reservation details" />
      <ReservationDetail
        booking={{
          id: booking.id,
          checkIn: booking.checkIn.toISOString(),
          checkOut: booking.checkOut.toISOString(),
          guests: booking.guests,
          totalPrice: booking.totalPrice,
          status: booking.status,
          specialRequests: booking.specialRequests,
          roomName: getDisplayRoomName(booking.room.name),
          roomNumber: booking.room.roomNumber,
          canModify,
        }}
        publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
      />
    </>
  )
}
