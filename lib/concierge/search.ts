import { getPublicRoomListings } from "@/lib/queries"
import { formatPrice, getRoomPrice } from "@/lib/rooms"

export type RoomListingSummary = {
  roomId: string
  subcategoryId: string
  name: string
  roomTypeSlug: string
  roomTypeName: string
  capacity: number
  fromPriceCents: number
  fromPriceDisplay: string
}

export type SearchRoomTypesResult =
  | { ok: true; listings: RoomListingSummary[] }
  | { ok: false; error: string }

export async function searchRoomTypes(input?: {
  minCapacity?: number
  roomTypeSlug?: string
}): Promise<SearchRoomTypesResult> {
  try {
    let listings = await getPublicRoomListings()

    if (input?.roomTypeSlug) {
      listings = listings.filter(
        (listing) => listing.roomType.slug === input.roomTypeSlug,
      )
    }

    if (input?.minCapacity) {
      listings = listings.filter(
        (listing) => listing.capacity >= input.minCapacity!,
      )
    }

    return {
      ok: true,
      listings: listings.map((listing) => ({
        roomId: listing.id,
        subcategoryId: listing.subcategory.id,
        name: listing.name,
        roomTypeSlug: listing.roomType.slug,
        roomTypeName: listing.roomType.name,
        capacity: listing.capacity,
        fromPriceCents: getRoomPrice(listing),
        fromPriceDisplay: formatPrice(getRoomPrice(listing), "CAD"),
      })),
    }
  } catch (err) {
    console.error("searchRoomTypes failed:", err)
    return {
      ok: false,
      error: "Failed to search rooms",
    }
  }
}
