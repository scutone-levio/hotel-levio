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
const CART_QUOTE_METADATA_PREFIX = "cart_quote_"

function guestCountError(guests: number, capacity: number): string | null {
  if (!Number.isInteger(guests) || guests < 1) {
    return "Guest count must be a positive whole number"
  }
  if (guests > capacity) {
    return `This room sleeps up to ${capacity}`
  }
  return null
}

type PersistedCartQuoteItem = {
  roomId: string
  unitId: string
  subcategoryId: string | null
  checkIn: string
  checkOut: string
  guests: number
  total: number
  nights: number
}

function serializeCartQuoteMetadata(items: PersistedCartQuoteItem[]) {
  return Object.fromEntries(
    items.map((item, index) => [
      `${CART_QUOTE_METADATA_PREFIX}${index}`,
      JSON.stringify({
        roomId: item.roomId,
        unitId: item.unitId,
        subcategoryId: item.subcategoryId,
        checkIn: item.checkIn,
        checkOut: item.checkOut,
        guests: item.guests,
        total: item.total,
        nights: item.nights,
      }),
    ]),
  )
}

function parseCartQuoteMetadata(
  metadata: Record<string, string>,
  itemCount: number,
): PersistedCartQuoteItem[] | null {
  const items: PersistedCartQuoteItem[] = []

  for (let index = 0; index < itemCount; index += 1) {
    const raw = metadata[`${CART_QUOTE_METADATA_PREFIX}${index}`]
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as Partial<PersistedCartQuoteItem>
      if (
        typeof parsed.roomId !== "string" ||
        typeof parsed.unitId !== "string" ||
        (parsed.subcategoryId !== null &&
          typeof parsed.subcategoryId !== "string") ||
        typeof parsed.checkIn !== "string" ||
        typeof parsed.checkOut !== "string" ||
        !Number.isInteger(parsed.guests) ||
        typeof parsed.total !== "number" ||
        typeof parsed.nights !== "number"
      ) {
        return null
      }

      const guests = parsed.guests as number
      const total = parsed.total as number
      const nights = parsed.nights as number

      items.push({
        roomId: parsed.roomId,
        unitId: parsed.unitId,
        subcategoryId: parsed.subcategoryId ?? null,
        checkIn: parsed.checkIn,
        checkOut: parsed.checkOut,
        guests,
        total,
        nights,
      })
    } catch {
      return null
    }
  }

  return items
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
          unitId: result.unit.id,
          subcategoryId: result.subcategoryId,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          guests: item.guests,
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
        ...serializeCartQuoteMetadata(
          quoted.map(
            ({
              roomId,
              unitId,
              subcategoryId,
              checkIn,
              checkOut,
              guests,
              total,
              nights,
            }) => ({
              roomId,
              unitId,
              subcategoryId,
              checkIn,
              checkOut,
              guests,
              total,
              nights,
            }),
          ),
        ),
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

    const paymentIntent = await stripe.paymentIntents.retrieve(
      input.stripePaymentIntentId,
    )
    const quotedItems = parseCartQuoteMetadata(
      paymentIntent.metadata,
      input.items.length,
    )
    if (!quotedItems) {
      return {
        ok: false,
        error: "Unable to verify the quoted rooms. Please restart checkout.",
      }
    }

    const grandTotal = quotedItems.reduce((sum, item) => sum + item.total, 0)

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
        existingBookings.length === quotedItems.length &&
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

    const prepared = await Promise.all(
      input.items.map(async (item, index) => {
        const checkIn = startOfDay(new Date(item.checkIn))
        const checkOut = startOfDay(new Date(item.checkOut))
        if (checkOut <= checkIn) throw new Error("Invalid date range")
        if (checkIn < today) throw new Error("Check-in cannot be in the past")

        const quoted = quotedItems[index]
        if (
          quoted.roomId !== item.roomId ||
          quoted.checkIn !== checkIn.toISOString() ||
          quoted.checkOut !== checkOut.toISOString() ||
          quoted.guests !== item.guests ||
          quoted.subcategoryId !== (item.subcategoryId ?? null)
        ) {
          throw new Error("Cart contents changed. Please restart checkout.")
        }

        const [catalog, unit] = await Promise.all([
          prisma.room.findUnique({
            where: { id: item.roomId },
            select: { id: true, name: true },
          }),
          prisma.room.findUnique({
            where: { id: quoted.unitId },
            select: {
              id: true,
              roomNumber: true,
              capacity: true,
              subcategoryId: true,
            },
          }),
        ])
        if (!catalog || !unit) throw new Error("Room not found")
        if ((unit.subcategoryId ?? null) !== quoted.subcategoryId) {
          throw new Error("Quoted room is no longer valid. Please restart checkout.")
        }

        const guestsError = guestCountError(item.guests, unit.capacity)
        if (guestsError) {
          throw new Error(`${catalog.name}: ${guestsError}`)
        }

        return {
          catalog,
          unit,
          subcategoryId: quoted.subcategoryId,
          checkIn,
          checkOut,
          guests: item.guests,
          quote: {
            total: quoted.total,
            nights: quoted.nights,
          },
        }
      }),
    )

    const guest = await prisma.user.upsert({
      where: { email: input.guestEmail.toLowerCase() },
      update: { name: input.guestName },
      create: { email: input.guestEmail.toLowerCase(), name: input.guestName },
    })

    const bookingIds = await prisma.$transaction(async (tx) => {
      const ids: string[] = []
      for (const [index, p] of prepared.entries()) {
        const quoted = quotedItems[index]
        if (
          quoted.roomId !== p.catalog.id ||
          quoted.unitId !== p.unit.id ||
          quoted.subcategoryId !== p.subcategoryId ||
          quoted.checkIn !== p.checkIn.toISOString() ||
          quoted.checkOut !== p.checkOut.toISOString() ||
          quoted.guests !== p.guests ||
          quoted.total !== p.quote.total ||
          quoted.nights !== p.quote.nights
        ) {
          throw new Error("Cart contents changed. Please restart checkout.")
        }

        const conflicting = await tx.booking.findFirst({
          where: {
            roomId: p.unit.id,
            status: { in: ["PENDING", "CONFIRMED"] },
            checkIn: { lt: p.checkOut },
            checkOut: { gt: p.checkIn },
          },
          select: { id: true },
        })
        if (conflicting) {
          throw new Error("Quoted room is no longer available. Please restart checkout.")
        }

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
