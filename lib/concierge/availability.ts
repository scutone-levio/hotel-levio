import { quoteListing } from "@/app/actions"
import { getAvailableUnits } from "@/lib/inventory"
import { prisma } from "@/lib/prisma"
import { formatPrice } from "@/lib/rooms"

import { parseStayDates } from "@/lib/concierge/dates"

export type CheckAvailabilityResult =
  | { ok: true; available: true; availableUnitCount: number }
  | { ok: true; available: false; reason: string }
  | { ok: false; error: string }

export type QuoteStayResult =
  | {
      ok: true
      nights: number
      totalCents: number
      totalDisplay: string
      roomNumber: string | null
    }
  | { ok: false; error: string }

async function resolveListingContext(roomId: string, subcategoryId?: string) {
  const catalog = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      roomTypeId: true,
      capacity: true,
      archivedAt: true,
      isCatalog: true,
    },
  })

  if (!catalog || catalog.archivedAt || !catalog.isCatalog) {
    return { ok: false as const, error: "Room listing not found" }
  }

  if (subcategoryId) {
    const sub = await prisma.roomSubcategory.findFirst({
      where: {
        id: subcategoryId,
        roomTypeId: catalog.roomTypeId,
        isActive: true,
      },
      select: { id: true },
    })
    if (!sub) {
      return { ok: false as const, error: "Invalid subcategory for this room" }
    }
  }

  return { ok: true as const, catalog, subcategoryId }
}

export async function checkAvailability(input: {
  roomId: string
  subcategoryId?: string
  checkIn: string
  checkOut: string
  guests: number
}): Promise<CheckAvailabilityResult> {
  const dates = parseStayDates(input.checkIn, input.checkOut)
  if (!dates.ok) return dates

  const listing = await resolveListingContext(input.roomId, input.subcategoryId)
  if (!listing.ok) return listing

  if (!Number.isInteger(input.guests) || input.guests < 1) {
    return { ok: false, error: "Guest count must be a positive whole number" }
  }
  if (input.guests > listing.catalog.capacity) {
    return {
      ok: true,
      available: false,
      reason: `This room accommodates up to ${listing.catalog.capacity} guests`,
    }
  }

  const units = await getAvailableUnits(
    listing.catalog.roomTypeId,
    dates.checkIn,
    dates.checkOut,
    input.subcategoryId,
  )

  if (units.length === 0) {
    return {
      ok: true,
      available: false,
      reason: "No rooms available for those dates",
    }
  }

  return {
    ok: true,
    available: true,
    availableUnitCount: units.length,
  }
}

export async function quoteStay(input: {
  roomId: string
  subcategoryId?: string
  checkIn: string
  checkOut: string
  guests: number
}): Promise<QuoteStayResult> {
  const availability = await checkAvailability(input)
  if (!availability.ok) return availability
  if (!availability.available) {
    return { ok: false, error: availability.reason }
  }

  const quote = await quoteListing({
    roomId: input.roomId,
    subcategoryId: input.subcategoryId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: input.guests,
  })

  if (!quote.ok) return quote

  return {
    ok: true,
    nights: quote.nights,
    totalCents: quote.total,
    totalDisplay: formatPrice(quote.total, "CAD"),
    roomNumber: quote.roomNumber,
  }
}
