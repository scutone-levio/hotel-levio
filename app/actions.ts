"use server"

import { revalidatePath } from "next/cache"
import { startOfDay, differenceInCalendarDays } from "date-fns"
import type { RoomType, RoomSubcategory } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  getAvailableUnits,
  quoteInventoryUnit,
  resolveBookingRoom,
} from "@/lib/inventory"
import { stripe } from "@/lib/stripe"
import { sendMail } from "@/lib/mailer"
import {
  guestConfirmationEmail,
  adminNotificationEmail,
} from "@/lib/email-templates"
import { listingAvailabilityKey } from "@/lib/rooms"

const ADMIN_EMAIL = "sergio.cutone@levio.ca"

function guestCountError(guests: number, capacity: number): string | null {
  if (!Number.isInteger(guests) || guests < 1) {
    return "Guest count must be a positive whole number"
  }
  if (guests > capacity) {
    return `This room sleeps up to ${capacity}`
  }
  return null
}

async function assertPaymentIntentReady(
  stripePaymentIntentId: string,
  expectedAmountCents: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const paymentIntent =
    await stripe.paymentIntents.retrieve(stripePaymentIntentId)

  if (paymentIntent.status !== "succeeded") {
    return { ok: false, error: "Payment has not completed successfully" }
  }
  if (paymentIntent.currency.toLowerCase() !== "cad") {
    return { ok: false, error: "Payment currency must be CAD" }
  }
  if (paymentIntent.amount !== expectedAmountCents) {
    return { ok: false, error: "Payment amount does not match the booking total" }
  }

  return { ok: true }
}

/** Resolve subcategory for a catalog listing; scoped to the catalog room type. */
async function resolveListingSubcategory(
  catalog: { type: RoomType; subcategory: RoomSubcategory | null },
  subcategoryId?: string,
): Promise<RoomSubcategory | null> {
  if (subcategoryId) {
    return prisma.roomSubcategory.findFirst({
      where: { id: subcategoryId, roomType: catalog.type },
    })
  }
  return catalog.subcategory
}

type AssignedUnit = NonNullable<Awaited<ReturnType<typeof resolveBookingRoom>>>

async function resolveAndQuoteListing(input: {
  roomId: string
  checkIn: Date
  checkOut: Date
  subcategoryId?: string
}): Promise<
  | {
      ok: true
      unit: AssignedUnit
      subcategoryId: string | null
      quote: ReturnType<typeof quoteInventoryUnit>
    }
  | { ok: false; error: string }
> {
  const catalog = await prisma.room.findUnique({
    where: { id: input.roomId },
    select: {
      id: true,
      type: true,
      name: true,
      isCatalog: true,
      subcategory: true,
    },
  })
  if (!catalog) {
    return { ok: false, error: "Room not found" }
  }

  const subcategory = await resolveListingSubcategory(
    { type: catalog.type, subcategory: catalog.subcategory },
    input.subcategoryId,
  )
  if (input.subcategoryId && !subcategory) {
    return { ok: false, error: "Invalid subcategory for this room type" }
  }

  const unit = await resolveBookingRoom({
    roomId: input.roomId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    subcategoryId: input.subcategoryId ?? subcategory?.id,
  })
  if (!unit) {
    return { ok: false, error: "The room is not available for those dates" }
  }

  const resolvedSubcategoryId = unit.subcategoryId ?? null
  if (
    input.subcategoryId &&
    resolvedSubcategoryId &&
    input.subcategoryId !== resolvedSubcategoryId
  ) {
    return { ok: false, error: "Invalid subcategory for the assigned room" }
  }

  const quote = quoteInventoryUnit(unit, input.checkIn, input.checkOut)
  return {
    ok: true,
    unit,
    subcategoryId: resolvedSubcategoryId,
    quote,
  }
}

export type QuoteListingResult =
  | { ok: true; total: number; nights: number; roomNumber: string | null }
  | { ok: false; error: string }

export async function quoteListing(input: {
  roomId: string
  subcategoryId?: string
  checkIn: string | Date
  checkOut: string | Date
  guests: number
}): Promise<QuoteListingResult> {
  try {
    const checkIn = startOfDay(new Date(input.checkIn))
    const checkOut = startOfDay(new Date(input.checkOut))
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

    const result = await resolveAndQuoteListing({
      roomId: input.roomId,
      checkIn,
      checkOut,
      subcategoryId: input.subcategoryId,
    })
    if (!result.ok) return result

    const guestsError = guestCountError(input.guests, result.unit.capacity)
    if (guestsError) return { ok: false, error: guestsError }

    return {
      ok: true,
      total: result.quote.total,
      nights: result.quote.nights,
      roomNumber: result.unit.roomNumber,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to quote listing",
    }
  }
}

export type AvailabilityCount = { available: number; total: number }

export type ListingAvailabilityInput = {
  roomId: string
  type: RoomType
  subcategoryId: string
}

/**
 * Return listing availability keys (`roomId:subcategoryId`) for listings that
 * have at least one available unit in the date range. Keys match
 * `listingAvailabilityKey` — not bare catalog room IDs.
 */
export async function getAvailableRoomIds(
  checkIn: string,
  checkOut: string,
  listings: ListingAvailabilityInput[],
): Promise<string[]> {
  const counts = await getAvailabilityCountsByListing(
    checkIn,
    checkOut,
    listings,
  )
  return listings
    .filter(
      (listing) =>
        (counts[listingAvailabilityKey(listing.roomId, listing.subcategoryId)]
          ?.available ?? 0) > 0,
    )
    .map((listing) =>
      listingAvailabilityKey(listing.roomId, listing.subcategoryId),
    )
}

export async function getAvailabilityCountsByListing(
  checkIn: string,
  checkOut: string,
  listings: ListingAvailabilityInput[],
): Promise<Record<string, AvailabilityCount>> {
  const from = startOfDay(new Date(checkIn))
  const to = startOfDay(new Date(checkOut))

  const entries = await Promise.all(
    listings.map(async (listing) => {
      const key = listingAvailabilityKey(listing.roomId, listing.subcategoryId)
      const [total, available] = await Promise.all([
        prisma.room.count({
          where: {
            type: listing.type,
            subcategoryId: listing.subcategoryId,
            isCatalog: false,
          },
        }),
        getAvailableUnits(listing.type, from, to, listing.subcategoryId),
      ])
      return [key, { available: available.length, total }] as const
    }),
  )

  return Object.fromEntries(entries)
}

/** @deprecated Use getAvailabilityCountsByListing for homepage listings. */
export async function getAvailabilityCountsByType(
  checkIn: string,
  checkOut: string,
): Promise<Record<RoomType, AvailabilityCount>> {
  const from = startOfDay(new Date(checkIn))
  const to = startOfDay(new Date(checkOut))

  const totals = await prisma.room.groupBy({
    by: ["type"],
    where: { isCatalog: false },
    _count: { _all: true },
  })
  const totalByType = Object.fromEntries(
    totals.map((t) => [t.type, t._count._all]),
  ) as Record<RoomType, number>

  const result = {} as Record<RoomType, AvailabilityCount>
  for (const type of ["TWIN", "QUEEN", "KING", "SUITE"] as RoomType[]) {
    const available = await getAvailableUnits(type, from, to)
    result[type] = {
      available: available.length,
      total: totalByType[type] ?? 0,
    }
  }
  return result
}

export type FinalizeResult =
  { ok: true; bookingId: string } | { ok: false; error: string }

export async function finalizeBooking(input: {
  roomId: string
  checkIn: string | Date
  checkOut: string | Date
  guests: number
  guestName: string
  guestEmail: string
  guestPhone?: string
  specialRequests?: string
  stripePaymentIntentId: string
  subcategoryId?: string
}): Promise<FinalizeResult> {
  try {
    const checkIn = startOfDay(new Date(input.checkIn))
    const checkOut = startOfDay(new Date(input.checkOut))
    const today = startOfDay(new Date())

    if (checkOut <= checkIn) return { ok: false, error: "Invalid date range" }
    if (checkIn < today)
      return { ok: false, error: "Check-in cannot be in the past" }

    const catalog = await prisma.room.findUnique({
      where: { id: input.roomId },
      select: { id: true, name: true, type: true },
    })
    if (!catalog) return { ok: false, error: "Room not found" }

    const result = await resolveAndQuoteListing({
      roomId: input.roomId,
      checkIn,
      checkOut,
      subcategoryId: input.subcategoryId,
    })
    if (!result.ok) return result

    const guestsError = guestCountError(input.guests, result.unit.capacity)
    if (guestsError) return { ok: false, error: guestsError }

    const existingBookings = await prisma.booking.findMany({
      where: {
        stripeSessionId: input.stripePaymentIntentId,
        status: "CONFIRMED",
      },
      orderBy: { createdAt: "asc" },
    })
    if (existingBookings.length > 0) {
      const booking = existingBookings[0]
      if (
        existingBookings.length === 1 &&
        booking.totalPrice === result.quote.total
      ) {
        return { ok: true, bookingId: booking.id }
      }
      return { ok: false, error: "Payment intent already used for a booking" }
    }

    const paymentCheck = await assertPaymentIntentReady(
      input.stripePaymentIntentId,
      result.quote.total,
    )
    if (!paymentCheck.ok) return paymentCheck

    const guest = await prisma.user.upsert({
      where: { email: input.guestEmail.toLowerCase() },
      update: { name: input.guestName },
      create: { email: input.guestEmail.toLowerCase(), name: input.guestName },
    })

    const booking = await prisma.booking.create({
      data: {
        roomId: result.unit.id,
        subcategoryId: result.subcategoryId,
        userId: guest.id,
        checkIn,
        checkOut,
        guests: input.guests,
        totalPrice: result.quote.total,
        status: "CONFIRMED",
        stripeSessionId: input.stripePaymentIntentId,
        guestName: input.guestName,
        guestEmail: input.guestEmail.toLowerCase(),
        guestPhone: input.guestPhone || null,
        specialRequests: input.specialRequests || null,
      },
    })

    revalidatePath("/admin")

    const emailData = {
      bookingId: booking.id,
      roomName: catalog.name,
      roomNumber: result.unit.roomNumber ?? undefined,
      checkIn,
      checkOut,
      nights: differenceInCalendarDays(checkOut, checkIn),
      guests: input.guests,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone,
      specialRequests: input.specialRequests,
      totalPrice: result.quote.total,
    }

    const guestMail = guestConfirmationEmail(emailData)
    const adminMail = adminNotificationEmail(emailData)

    Promise.all([
      sendMail({ to: input.guestEmail, ...guestMail }),
      sendMail({ to: ADMIN_EMAIL, ...adminMail }),
    ]).catch((err) => console.error("Email send failed:", err))

    return { ok: true, bookingId: booking.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Booking failed"
    console.error("finalizeBooking failed:", message)
    return { ok: false, error: message }
  }
}

export type BookingResult =
  | { ok: true; bookingId: string; total: number; nights: number }
  | { ok: false; error: string }

export async function createBooking(input: {
  roomId: string
  checkIn: string | Date
  checkOut: string | Date
  guests: number
  subcategoryId?: string
}): Promise<BookingResult> {
  try {
    const checkIn = startOfDay(new Date(input.checkIn))
    const checkOut = startOfDay(new Date(input.checkOut))
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

    const result = await resolveAndQuoteListing({
      roomId: input.roomId,
      checkIn,
      checkOut,
      subcategoryId: input.subcategoryId,
    })
    if (!result.ok) return result

    const guestsError = guestCountError(input.guests, result.unit.capacity)
    if (guestsError) return { ok: false, error: guestsError }

    const guest = await prisma.user.upsert({
      where: { email: "guest@hotel.test" },
      update: {},
      create: { email: "guest@hotel.test", name: "Demo Guest" },
    })

    const booking = await prisma.booking.create({
      data: {
        roomId: result.unit.id,
        subcategoryId: result.subcategoryId,
        userId: guest.id,
        checkIn,
        checkOut,
        guests: input.guests,
        totalPrice: result.quote.total,
        status: "PENDING",
      },
    })

    revalidatePath("/admin")
    return {
      ok: true,
      bookingId: booking.id,
      total: result.quote.total,
      nights: result.quote.nights,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Booking failed"
    console.error("createBooking failed:", message)
    return { ok: false, error: message }
  }
}

export type CartCheckoutItem = {
  roomId: string
  checkIn: string
  checkOut: string
  guests: number
  subcategoryId?: string
}

export async function createCartPaymentIntent(
  items: CartCheckoutItem[],
): Promise<
  | {
      ok: true
      clientSecret: string
      quotedItems: Array<{ roomId: string; total: number; nights: number }>
    }
  | { ok: false; error: string }
> {
  try {
    if (!items.length) return { ok: false, error: "Cart is empty" }

    const quoted = await Promise.all(
      items.map(async (item) => {
        const checkIn = startOfDay(new Date(item.checkIn))
        const checkOut = startOfDay(new Date(item.checkOut))

        const catalog = await prisma.room.findUnique({
          where: { id: item.roomId },
          select: { id: true, name: true },
        })
        if (!catalog) throw new Error(`Room not found: ${item.roomId}`)

        const result = await resolveAndQuoteListing({
          roomId: item.roomId,
          checkIn,
          checkOut,
          subcategoryId: item.subcategoryId,
        })
        if (!result.ok) throw new Error(result.error)

        const guestsError = guestCountError(item.guests, result.unit.capacity)
        if (guestsError) {
          throw new Error(`${catalog.name}: ${guestsError}`)
        }

        return {
          roomId: catalog.id,
          roomName: catalog.name,
          total: result.quote.total,
          nights: result.quote.nights,
        }
      }),
    )

    const grandTotal = quoted.reduce((s, q) => s + q.total, 0)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: grandTotal,
      currency: "cad",
      automatic_payment_methods: { enabled: true },
      metadata: {
        roomCount: String(items.length),
        rooms: quoted.map((q) => q.roomName).join(", "),
      },
    })

    return {
      ok: true,
      clientSecret: paymentIntent.client_secret!,
      quotedItems: quoted.map(({ roomId, total, nights }) => ({
        roomId,
        total,
        nights,
      })),
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create payment",
    }
  }
}

export type CartFinalizeResult =
  { ok: true; bookingIds: string[] } | { ok: false; error: string }

export async function finalizeCartBookings(input: {
  items: CartCheckoutItem[]
  guestName: string
  guestEmail: string
  guestPhone?: string
  specialRequests?: string
  stripePaymentIntentId: string
}): Promise<CartFinalizeResult> {
  try {
    const today = startOfDay(new Date())

    const prepared = await Promise.all(
      input.items.map(async (item) => {
        const checkIn = startOfDay(new Date(item.checkIn))
        const checkOut = startOfDay(new Date(item.checkOut))
        if (checkOut <= checkIn) throw new Error("Invalid date range")
        if (checkIn < today) throw new Error("Check-in cannot be in the past")

        const catalog = await prisma.room.findUnique({
          where: { id: item.roomId },
          select: { id: true, name: true },
        })
        if (!catalog) throw new Error("Room not found")

        const result = await resolveAndQuoteListing({
          roomId: item.roomId,
          checkIn,
          checkOut,
          subcategoryId: item.subcategoryId,
        })
        if (!result.ok) throw new Error(result.error)

        const guestsError = guestCountError(item.guests, result.unit.capacity)
        if (guestsError) {
          throw new Error(`${catalog.name}: ${guestsError}`)
        }

        return {
          catalog,
          unit: result.unit,
          subcategoryId: result.subcategoryId,
          checkIn,
          checkOut,
          guests: item.guests,
          quote: result.quote,
        }
      }),
    )

    const grandTotal = prepared.reduce((sum, p) => sum + p.quote.total, 0)

    const existingBookings = await prisma.booking.findMany({
      where: {
        stripeSessionId: input.stripePaymentIntentId,
        status: "CONFIRMED",
      },
      orderBy: { createdAt: "asc" },
    })
    if (existingBookings.length > 0) {
      const existingTotal = existingBookings.reduce(
        (sum, b) => sum + b.totalPrice,
        0,
      )
      if (
        existingBookings.length === prepared.length &&
        existingTotal === grandTotal
      ) {
        return { ok: true, bookingIds: existingBookings.map((b) => b.id) }
      }
      return { ok: false, error: "Payment intent already used for a booking" }
    }

    const paymentCheck = await assertPaymentIntentReady(
      input.stripePaymentIntentId,
      grandTotal,
    )
    if (!paymentCheck.ok) return paymentCheck

    const guest = await prisma.user.upsert({
      where: { email: input.guestEmail.toLowerCase() },
      update: { name: input.guestName },
      create: { email: input.guestEmail.toLowerCase(), name: input.guestName },
    })

    const bookingIds = await prisma.$transaction(async (tx) => {
      const ids: string[] = []
      for (const p of prepared) {
        const b = await tx.booking.create({
          data: {
            roomId: p.unit.id,
            subcategoryId: p.subcategoryId,
            userId: guest.id,
            checkIn: p.checkIn,
            checkOut: p.checkOut,
            guests: p.guests,
            totalPrice: p.quote.total,
            status: "CONFIRMED",
            stripeSessionId: input.stripePaymentIntentId,
            guestName: input.guestName,
            guestEmail: input.guestEmail.toLowerCase(),
            guestPhone: input.guestPhone || null,
            specialRequests: input.specialRequests || null,
          },
        })
        ids.push(b.id)
      }
      return ids
    })

    revalidatePath("/admin")

    Promise.all(
      prepared.map((p, i) => {
        const nights = differenceInCalendarDays(p.checkOut, p.checkIn)
        const emailData = {
          bookingId: bookingIds[i],
          roomName: p.catalog.name,
          roomNumber: p.unit.roomNumber ?? undefined,
          checkIn: p.checkIn,
          checkOut: p.checkOut,
          nights,
          guests: p.guests,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          guestPhone: input.guestPhone,
          specialRequests: input.specialRequests,
          totalPrice: p.quote.total,
        }
        return Promise.all([
          sendMail({
            to: input.guestEmail,
            ...guestConfirmationEmail(emailData),
          }),
          sendMail({ to: ADMIN_EMAIL, ...adminNotificationEmail(emailData) }),
        ])
      }),
    ).catch((e) => console.error("Cart email failed:", e))

    return { ok: true, bookingIds }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Booking failed"
    console.error("finalizeCartBookings failed:", message)
    return { ok: false, error: message }
  }
}
