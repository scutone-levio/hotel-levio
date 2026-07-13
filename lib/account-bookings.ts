import { startOfDay } from "date-fns"
import type { BookingStatus } from "@prisma/client"

export function getDisplayRoomName(fullName: string): string {
  return fullName.split(" · ")[0]
}

export type BookingListRow = {
  id: string
  checkIn: Date
  checkOut: Date
  status: BookingStatus
  totalPrice: number
  roomName: string
}

export function isUpcomingBooking(
  booking: { checkOut: Date; status: BookingStatus },
  today = startOfDay(new Date()),
): boolean {
  return booking.status === "CONFIRMED" && startOfDay(booking.checkOut) >= today
}

export function isPastBooking(
  booking: { checkOut: Date; status: BookingStatus },
  today = startOfDay(new Date()),
): boolean {
  if (booking.status === "CANCELLED") return true
  return booking.status === "CONFIRMED" && startOfDay(booking.checkOut) < today
}

export function partitionBookings<T extends BookingListRow>(
  bookings: T[],
  today = startOfDay(new Date()),
): { upcoming: T[]; past: T[] } {
  const upcoming = bookings
    .filter((b) => isUpcomingBooking(b, today))
    .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime())
  const past = bookings
    .filter((b) => isPastBooking(b, today))
    .sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime())
  return { upcoming, past }
}
