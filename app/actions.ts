"use server"

import { revalidatePath } from "next/cache"
import { startOfDay, differenceInCalendarDays } from "date-fns"
import type { RoomType, RoomSubcategory } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { quoteRange } from "@/lib/pricing"
import { getRoomPrice, listingAvailabilityKey } from "@/lib/rooms"
import {
  assignAvailableUnit,
  getAvailableUnits,
  resolveBookingRoom,
} from "@/lib/inventory"
import { stripe } from "@/lib/stripe"
import { sendMail } from "@/lib/mailer"
import { guestConfirmationEmail, adminNotificationEmail } from "@/lib/email-templates"

const ADMIN_EMAIL = "sergio.cutone@levio.ca"

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
  const counts = await getAvailabilityCountsByListing(checkIn, checkOut, listings)
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
  // Keys are listing availability keys from listingAvailabilityKey(roomId, subcategoryId).
  const from = startOfDay(new Date(checkIn))
  const to = startOfDay(new Date(checkOut))

  const result: Record<string, AvailabilityCount> = {}

  for (const listing of listings) {
    const key = listingAvailabilityKey(listing.roomId, listing.subcategoryId)
    const total = await prisma.room.count({
      where: {
        type: listing.type,
        subcategoryId: listing.subcategoryId,
        isCatalog: false,
      },
    })
    const available = await getAvailableUnits(
      listing.type,
      from,
      to,
      listing.subcategoryId,
    )
    result[key] = {
      available: available.length,
      total,
    }
  }

  return result
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
  | { ok: true; bookingId: string }
  | { ok: false; error: string }

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
    if (checkIn < today) return { ok: false, error: "Check-in cannot be in the past" }

    const catalog = await prisma.room.findUnique({
      where: { id: input.roomId },
      include: { priceRules: true, subcategory: true },
    })
    if (!catalog) return { ok: false, error: "Room not found" }

    const subcategory = await resolveListingSubcategory(
      catalog,
      input.subcategoryId,
    )
    if (input.subcategoryId && !subcategory) {
      return { ok: false, error: "Invalid subcategory for this room type" }
    }

    const room = await resolveBookingRoom({
      roomId: input.roomId,
      checkIn,
      checkOut,
      subcategoryId: input.subcategoryId ?? subcategory?.id,
    })
    if (!room) {
      return { ok: false, error: "Those dates are no longer available" }
    }

    if (input.guests < 1 || input.guests > room.capacity) {
      return { ok: false, error: `This room sleeps up to ${room.capacity}` }
    }

    const quote = quoteRange(
      getRoomPrice({ basePrice: catalog.basePrice, subcategory }),
      catalog.priceRules,
      checkIn,
      checkOut,
    )

    const guest = await prisma.user.upsert({
      where: { email: input.guestEmail.toLowerCase() },
      update: { name: input.guestName },
      create: { email: input.guestEmail.toLowerCase(), name: input.guestName },
    })

    const booking = await prisma.booking.create({
      data: {
        roomId: room.id,
        userId: guest.id,
        checkIn,
        checkOut,
        guests: input.guests,
        totalPrice: quote.total,
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
      roomNumber: room.roomNumber ?? undefined,
      checkIn,
      checkOut,
      nights: differenceInCalendarDays(checkOut, checkIn),
      guests: input.guests,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone,
      specialRequests: input.specialRequests,
      totalPrice: quote.total,
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

    const catalog = await prisma.room.findUnique({
      where: { id: input.roomId },
      include: { priceRules: true, subcategory: true },
    })
    if (!catalog) {
      return { ok: false, error: "Room not found" }
    }

    const subcategory = await resolveListingSubcategory(
      catalog,
      input.subcategoryId,
    )
    if (input.subcategoryId && !subcategory) {
      return { ok: false, error: "Invalid subcategory for this room type" }
    }

    const room = await resolveBookingRoom({
      roomId: input.roomId,
      checkIn,
      checkOut,
      subcategoryId: input.subcategoryId ?? subcategory?.id,
    })
    if (!room) {
      return { ok: false, error: "The room is not available for those dates" }
    }

    if (input.guests < 1 || input.guests > room.capacity) {
      return { ok: false, error: `This room sleeps up to ${room.capacity}` }
    }

    const quote = quoteRange(
      getRoomPrice({ basePrice: catalog.basePrice, subcategory }),
      catalog.priceRules,
      checkIn,
      checkOut,
    )

    const guest = await prisma.user.upsert({
      where: { email: "guest@hotel.test" },
      update: {},
      create: { email: "guest@hotel.test", name: "Demo Guest" },
    })

    const booking = await prisma.booking.create({
      data: {
        roomId: room.id,
        userId: guest.id,
        checkIn,
        checkOut,
        guests: input.guests,
        totalPrice: quote.total,
        status: "PENDING",
      },
    })

    revalidatePath("/admin")
    return {
      ok: true,
      bookingId: booking.id,
      total: quote.total,
      nights: quote.nights,
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

export async function createCartPaymentIntent(items: CartCheckoutItem[]): Promise<
  | { ok: true; clientSecret: string; quotedItems: Array<{ roomId: string; total: number; nights: number }> }
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
          include: { priceRules: true, subcategory: true },
        })
        if (!catalog) throw new Error(`Room not found: ${item.roomId}`)

        const subcategory = await resolveListingSubcategory(
          catalog,
          item.subcategoryId,
        )
        if (item.subcategoryId && !subcategory) {
          throw new Error(`Invalid subcategory for ${catalog.name}`)
        }

        const unit = await assignAvailableUnit(
          catalog.type,
          checkIn,
          checkOut,
          item.subcategoryId ?? subcategory?.id,
        )
        if (!unit) throw new Error(`${catalog.name} is not available for those dates`)

        const quote = quoteRange(
          getRoomPrice({ basePrice: catalog.basePrice, subcategory }),
          catalog.priceRules,
          checkIn,
          checkOut,
        )
        return { roomId: catalog.id, roomName: catalog.name, total: quote.total, nights: quote.nights }
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
      quotedItems: quoted.map(({ roomId, total, nights }) => ({ roomId, total, nights })),
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create payment" }
  }
}

export type CartFinalizeResult =
  | { ok: true; bookingIds: string[] }
  | { ok: false; error: string }

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
          include: { priceRules: true, subcategory: true },
        })
        if (!catalog) throw new Error("Room not found")

        const subcategory = await resolveListingSubcategory(
          catalog,
          item.subcategoryId,
        )
        if (item.subcategoryId && !subcategory) {
          throw new Error(`Invalid subcategory for ${catalog.name}`)
        }

        const room = await assignAvailableUnit(
          catalog.type,
          checkIn,
          checkOut,
          item.subcategoryId ?? subcategory?.id,
        )
        if (!room) throw new Error(`${catalog.name}: those dates are no longer available`)

        if (item.guests < 1 || item.guests > room.capacity) {
          throw new Error(`${catalog.name} sleeps up to ${room.capacity}`)
        }

        const quote = quoteRange(
          getRoomPrice({ basePrice: catalog.basePrice, subcategory }),
          catalog.priceRules,
          checkIn,
          checkOut,
        )
        return { catalog, room, checkIn, checkOut, guests: item.guests, quote }
      }),
    )

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
            roomId: p.room.id,
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
          roomNumber: p.room.roomNumber ?? undefined,
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
          sendMail({ to: input.guestEmail, ...guestConfirmationEmail(emailData) }),
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
