import type Stripe from "stripe"
import { startOfDay } from "date-fns"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

const DATE_CHANGE_TRANSACTION_MAX_ATTEMPTS = 3

export function parseReservationDateChangeRange(
  checkInRaw: string,
  checkOutRaw: string,
):
  | { ok: true; checkIn: Date; checkOut: Date }
  | { ok: false; error: string } {
  const checkIn = startOfDay(new Date(checkInRaw))
  const checkOut = startOfDay(new Date(checkOutRaw))
  const today = startOfDay(new Date())

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    return { ok: false, error: "Invalid dates" }
  }
  if (checkOut <= checkIn) {
    return { ok: false, error: "Check-out must be after check-in" }
  }
  if (checkIn < today) {
    return { ok: false, error: "Check-in cannot be in the past" }
  }

  return { ok: true, checkIn, checkOut }
}

export async function checkDateChangeRoomConflict(input: {
  roomId: string
  bookingId: string
  checkIn: Date
  checkOut: Date
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const conflict = await prisma.booking.findFirst({
    where: {
      roomId: input.roomId,
      id: { not: input.bookingId },
      status: { in: ["PENDING", "CONFIRMED"] },
      checkIn: { lt: input.checkOut },
      checkOut: { gt: input.checkIn },
    },
  })
  if (conflict) {
    return { ok: false, error: "Room not available for those dates" }
  }
  return { ok: true }
}

export async function persistReservationDateChange(input: {
  bookingId: string
  userId: string
  checkIn: Date
  checkOut: Date
  quoteTotal: number
  priceDiff: number
  stripePaymentIntentId?: string
}) {
  for (
    let attempt = 1;
    attempt <= DATE_CHANGE_TRANSACTION_MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const bookingForUpdate = await tx.booking.findFirst({
            where: {
              id: input.bookingId,
              userId: input.userId,
              status: "CONFIRMED",
              checkOut: { gte: startOfDay(new Date()) },
            },
          })
          if (!bookingForUpdate) {
            throw new Error("Reservation not found")
          }

          const conflict = await tx.booking.findFirst({
            where: {
              roomId: bookingForUpdate.roomId,
              id: { not: bookingForUpdate.id },
              status: { in: ["PENDING", "CONFIRMED"] },
              checkIn: { lt: input.checkOut },
              checkOut: { gt: input.checkIn },
            },
          })
          if (conflict) {
            throw new Error("Room not available for those dates")
          }

          return tx.booking.update({
            where: { id: bookingForUpdate.id },
            data: buildDateChangeBookingUpdateData(
              bookingForUpdate,
              input.priceDiff > 0 ? input.stripePaymentIntentId : undefined,
              input.checkIn,
              input.checkOut,
              input.quoteTotal,
            ),
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (err) {
      const isSerializationFailure =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2034"
      if (!isSerializationFailure || attempt === DATE_CHANGE_TRANSACTION_MAX_ATTEMPTS) {
        throw err
      }
    }
  }
  throw new Error("Failed to persist date change")
}

export function validateDateChangePaymentIntentUsage(
  existingBooking: { id: string } | null,
): { ok: true } | { ok: false; error: string } {
  if (existingBooking) {
    return { ok: false, error: "Payment intent already used for a booking" }
  }
  return { ok: true }
}

export function verifyDateChangePaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
  bookingId: string,
  expectedAmountCents: number,
): { ok: true } | { ok: false; error: string } {
  if (paymentIntent.status !== "succeeded") {
    return { ok: false, error: "Payment has not completed successfully" }
  }
  if (paymentIntent.currency.toLowerCase() !== "cad") {
    return { ok: false, error: "Payment currency must be CAD" }
  }
  if (paymentIntent.amount !== expectedAmountCents) {
    return {
      ok: false,
      error: "Payment amount does not match the price difference",
    }
  }
  if (paymentIntent.metadata.bookingId !== bookingId) {
    return { ok: false, error: "Payment does not match this reservation" }
  }
  if (paymentIntent.metadata.type !== "date_change") {
    return { ok: false, error: "Invalid payment type for date change" }
  }
  return { ok: true }
}

export function buildDateChangeBookingUpdateData(
  _booking: { stripeSessionId: string | null },
  dateChangeStripePaymentId: string | undefined,
  checkIn: Date,
  checkOut: Date,
  totalPrice: number,
) {
  return {
    checkIn,
    checkOut,
    totalPrice,
    // stripeSessionId is intentionally not updated — original checkout reference preserved.
    dateChangeStripePaymentId: dateChangeStripePaymentId ?? null,
  }
}
