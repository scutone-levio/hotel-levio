import { startOfDay } from "date-fns"

import { quoteListing } from "@/app/actions"
import { listingCoverImageUrl } from "@/lib/listing-images"
import { prisma } from "@/lib/prisma"
import { formatListingName, formatPrice } from "@/lib/rooms"

import type { ConciergeCartPayload } from "@/lib/concierge/schemas"

export type PrepareCartItemResult =
  | { ok: true; item: ConciergeCartPayload }
  | { ok: false; error: string }

export async function prepareCartItem(input: {
  roomId: string
  subcategoryId?: string
  checkIn: string
  checkOut: string
  guests: number
}): Promise<PrepareCartItemResult> {
  const quote = await quoteListing({
    roomId: input.roomId,
    subcategoryId: input.subcategoryId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: input.guests,
  })

  if (!quote.ok) return quote

  const listing = await prisma.room.findUnique({
    where: { id: input.roomId },
    select: {
      id: true,
      name: true,
      roomTypeId: true,
      isCatalog: true,
      archivedAt: true,
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, sortOrder: true } },
    },
  })

  if (!listing || listing.archivedAt || !listing.isCatalog) {
    return { ok: false, error: "Room listing not found" }
  }

  const subcategory = input.subcategoryId
    ? await prisma.roomSubcategory.findFirst({
        where: {
          id: input.subcategoryId,
          roomTypeId: listing.roomTypeId,
          isActive: true,
        },
        include: {
          images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, sortOrder: true } },
        },
      })
    : null

  if (input.subcategoryId && !subcategory) {
    return { ok: false, error: "Invalid subcategory for this room" }
  }

  const roomName = subcategory
    ? formatListingName(listing.name, subcategory.name)
    : listing.name

  const item: ConciergeCartPayload = {
    roomId: listing.id,
    roomName,
    imageUrl: listingCoverImageUrl(listing.images, subcategory?.images ?? null),
    checkIn: startOfDay(new Date(input.checkIn)).toISOString(),
    checkOut: startOfDay(new Date(input.checkOut)).toISOString(),
    guests: input.guests,
    nights: quote.nights,
    totalPrice: quote.total,
    subcategoryId: input.subcategoryId,
    totalPriceDisplay: formatPrice(quote.total, "CAD"),
  }

  return { ok: true, item }
}
