"use server"

import { revalidatePath } from "next/cache"
import { startOfDay } from "date-fns"

import { auth } from "@/auth"
import { registerSchema, profileSchema } from "@/lib/account-schemas"
import {
  checkDateChangeRoomConflict,
  parseReservationDateChangeRange,
  persistReservationDateChange,
  validateDateChangePaymentIntentUsage,
  verifyDateChangePaymentIntent,
} from "@/lib/account-date-change"
import { prisma } from "@/lib/prisma"
import { hashPassword, validatePassword, verifyPassword } from "@/lib/password"
import { isRangeAvailable } from "@/lib/availability"
import { quoteInventoryUnit } from "@/lib/inventory"
import { stripe } from "@/lib/stripe"

type ActionResult = { ok: true } | { ok: false; error: string }

async function requireUserId(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in required" }
  }
  return { ok: true, userId: session.user.id }
}

export async function registerCustomer(input: {
  name: string
  email: string
  password: string
}): Promise<ActionResult> {
  try {
    const parsed = registerSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join("; "),
      }
    }

    const passwordError = validatePassword(parsed.data.password)
    if (passwordError) return { ok: false, error: passwordError }

    const email = parsed.data.email
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return { ok: false, error: "An account with this email already exists" }
    }

    await prisma.user.create({
      data: {
        email,
        name: parsed.data.name,
        password: await hashPassword(parsed.data.password),
        role: "CUSTOMER",
      },
    })

    return { ok: true }
  } catch (err) {
    console.error("registerCustomer error:", err)
    return { ok: false, error: "Registration failed" }
  }
}

export async function updateProfile(input: {
  name: string
  phone?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
}): Promise<ActionResult> {
  try {
    const gate = await requireUserId()
    if (!gate.ok) return gate

    const parsed = profileSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join("; "),
      }
    }

    await prisma.user.update({
      where: { id: gate.userId },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        addressLine1: parsed.data.addressLine1 || null,
        addressLine2: parsed.data.addressLine2 || null,
        city: parsed.data.city || null,
        province: parsed.data.province || null,
        postalCode: parsed.data.postalCode || null,
        country: parsed.data.country || "CA",
      },
    })

    revalidatePath("/account")
    return { ok: true }
  } catch (err) {
    console.error("updateProfile error:", err)
    return { ok: false, error: "Failed to update profile" }
  }
}

export async function changePassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<ActionResult> {
  try {
    const gate = await requireUserId()
    if (!gate.ok) return gate

    const newPasswordError = validatePassword(input.newPassword)
    if (newPasswordError) return { ok: false, error: newPasswordError }

    const user = await prisma.user.findUnique({ where: { id: gate.userId } })
    if (!user?.password) {
      return {
        ok: false,
        error: "Password change is not available for social sign-in accounts",
      }
    }

    if (!(await verifyPassword(input.currentPassword, user.password))) {
      return { ok: false, error: "Current password is incorrect" }
    }

    await prisma.user.update({
      where: { id: gate.userId },
      data: { password: await hashPassword(input.newPassword) },
    })

    return { ok: true }
  } catch (err) {
    console.error("changePassword error:", err)
    return { ok: false, error: "Failed to change password" }
  }
}

export async function cancelReservation(
  bookingId: string,
): Promise<ActionResult> {
  try {
    const gate = await requireUserId()
    if (!gate.ok) return gate

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId: gate.userId,
        status: "CONFIRMED",
        checkOut: { gte: startOfDay(new Date()) },
      },
    })
    if (!booking) {
      return {
        ok: false,
        error: "Reservation not found or cannot be cancelled",
      }
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    })

    revalidatePath("/account/reservations")
    revalidatePath(`/account/reservations/${bookingId}`)
    revalidatePath("/admin")
    return { ok: true }
  } catch (err) {
    console.error("cancelReservation error:", err)
    return { ok: false, error: "Failed to cancel reservation" }
  }
}

export async function updateReservationSpecialRequests(
  bookingId: string,
  specialRequests: string,
): Promise<ActionResult> {
  try {
    const gate = await requireUserId()
    if (!gate.ok) return gate

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId: gate.userId,
        status: "CONFIRMED",
        checkOut: { gte: startOfDay(new Date()) },
      },
    })
    if (!booking) {
      return { ok: false, error: "Reservation not found" }
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { specialRequests: specialRequests.trim() || null },
    })

    revalidatePath(`/account/reservations/${bookingId}`)
    return { ok: true }
  } catch (err) {
    console.error("updateReservationSpecialRequests error:", err)
    return { ok: false, error: "Failed to update special requests" }
  }
}

export type ChangeDatesResult =
  | {
      ok: true
      updated: true
      totalPrice: number
      priceDiff: number
      refundPending: boolean
    }
  | {
      ok: true
      requiresPayment: true
      clientSecret: string
      priceDiff: number
      newTotal: number
    }
  | { ok: false; error: string }

async function prepareDateChangePayment(
  bookingId: string,
  priceDiff: number,
  newTotal: number,
): Promise<ChangeDatesResult> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: priceDiff,
    currency: "cad",
    automatic_payment_methods: { enabled: true },
    metadata: {
      bookingId,
      type: "date_change",
    },
  })
  if (!paymentIntent.client_secret) {
    return { ok: false, error: "Failed to prepare payment" }
  }
  return {
    ok: true,
    requiresPayment: true,
    clientSecret: paymentIntent.client_secret,
    priceDiff,
    newTotal,
  }
}

async function validateDateChangePayment(
  stripePaymentIntentId: string,
  bookingId: string,
  priceDiff: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existingBooking = await prisma.booking.findFirst({
    where: { dateChangeStripePaymentId: stripePaymentIntentId },
  })
  const usageCheck = validateDateChangePaymentIntentUsage(existingBooking)
  if (!usageCheck.ok) return usageCheck

  const paymentIntent = await stripe.paymentIntents.retrieve(
    stripePaymentIntentId,
  )
  return verifyDateChangePaymentIntent(
    paymentIntent,
    bookingId,
    priceDiff,
  )
}

async function getConfirmedBookingForDateChange(
  bookingId: string,
  userId: string,
) {
  return prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
      status: "CONFIRMED",
      checkOut: { gte: startOfDay(new Date()) },
    },
    include: {
      room: { include: { priceRules: true, blackouts: true } },
    },
  })
}

async function finalizeDateChange(input: {
  bookingId: string
  userId: string
  checkIn: Date
  checkOut: Date
  quoteTotal: number
  priceDiff: number
  stripePaymentIntentId?: string
}): Promise<ChangeDatesResult> {
  const updatedBooking = await persistReservationDateChange(input)
  if (!updatedBooking) {
    return { ok: false, error: "Failed to update reservation" }
  }

  revalidatePath("/account/reservations")
  revalidatePath(`/account/reservations/${input.bookingId}`)
  revalidatePath("/admin")

  return {
    ok: true,
    updated: true,
    totalPrice: input.quoteTotal,
    priceDiff: input.priceDiff,
    refundPending: input.priceDiff < 0,
  }
}

export async function changeReservationDates(input: {
  bookingId: string
  checkIn: string
  checkOut: string
  stripePaymentIntentId?: string
}): Promise<ChangeDatesResult> {
  try {
    const gate = await requireUserId()
    if (gate.ok === false) return { ok: false, error: gate.error }

    const booking = await getConfirmedBookingForDateChange(
      input.bookingId,
      gate.userId,
    )
    if (!booking) {
      return { ok: false, error: "Reservation not found" }
    }

    const parsedDates = parseReservationDateChangeRange(
      input.checkIn,
      input.checkOut,
    )
    if (!parsedDates.ok) return parsedDates

    const { checkIn, checkOut } = parsedDates

    if (!isRangeAvailable(booking.room.blackouts, checkIn, checkOut)) {
      return { ok: false, error: "Room not available for those dates" }
    }

    const conflictCheck = await checkDateChangeRoomConflict({
      roomId: booking.roomId,
      bookingId: booking.id,
      checkIn,
      checkOut,
    })
    if (!conflictCheck.ok) return conflictCheck

    const quote = quoteInventoryUnit(booking.room, checkIn, checkOut)
    const priceDiff = quote.total - booking.totalPrice

    if (priceDiff > 0 && !input.stripePaymentIntentId) {
      return prepareDateChangePayment(booking.id, priceDiff, quote.total)
    }

    if (priceDiff > 0 && input.stripePaymentIntentId) {
      const paymentCheck = await validateDateChangePayment(
        input.stripePaymentIntentId,
        booking.id,
        priceDiff,
      )
      if (!paymentCheck.ok) return paymentCheck
    }

    return finalizeDateChange({
      bookingId: booking.id,
      userId: gate.userId,
      checkIn,
      checkOut,
      quoteTotal: quote.total,
      priceDiff,
      stripePaymentIntentId: input.stripePaymentIntentId,
    })
  } catch (err) {
    console.error("changeReservationDates error:", err)
    const safe = new Set(["Reservation not found", "Room not available for those dates"])
    const msg = err instanceof Error ? err.message : ""
    return { ok: false, error: safe.has(msg) ? msg : "Failed to change dates" }
  }
}
