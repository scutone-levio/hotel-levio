// Display helpers shared across the app.

/** Navy/gold styling shared by primary booking CTAs (add to cart, book now, continue to payment). */
export const BOOKING_ACTION_BUTTON_CLASS =
  "!bg-[#0f2a3d] !text-[#f3ecda] hover:!bg-[#c69456] hover:!text-[#0f2a3d]"

/** Display name for a catalog room + subcategory listing, e.g. "Twin Room - Lower Level". */
export function formatListingName(catalogName: string, subcategoryName: string) {
  return `${catalogName} - ${subcategoryName}`
}

/** Unique key for a catalog + subcategory listing (shared catalog id across subcategories). */
export function listingAvailabilityKey(roomId: string, subcategoryId: string) {
  return `${roomId}:${subcategoryId}`
}

// dayOfWeek 0 = Sunday .. 6 = Saturday (matches JS Date.getDay()).
export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

/** URL path for an individual room page, optionally scoped to a subcategory listing. */
export function roomPath(slug: string, subcategoryId?: string) {
  const base = `/rooms/${slug}`
  if (!subcategoryId) return base
  return `${base}?subcategory=${subcategoryId}`
}

/** Whether a listing (or catalog room) should show the Featured badge. */
export function isListingFeatured(room: {
  featured?: boolean
  subcategory?: { featured: boolean } | null
}) {
  return room.featured ?? room.subcategory?.featured ?? false
}

/** Parse admin dollar input to cents, or null when invalid. */
export function parseDollarsToCents(value: string): number | null {
  const dollars = Number(value)
  if (!Number.isFinite(dollars) || dollars < 0) return null
  return Math.round(dollars * 100)
}

/** Format stored cents for admin dollar inputs. */
export function centsToDollarsString(cents: number): string {
  return String(cents / 100)
}

/** Stored listing "from" price; falls back to basePrice when not yet recomputed (0). */
export function listingFromPriceCents(subcategory: {
  basePrice: number
  fromPriceCents: number
}): number {
  return subcategory.fromPriceCents > 0
    ? subcategory.fromPriceCents
    : subcategory.basePrice
}

/** Get effective price for a room: subcategory from-price for listings, else basePrice. */
export function getRoomPrice(room: {
  basePrice: number
  subcategory?: { basePrice: number; fromPriceCents?: number } | null
}): number {
  if (room.subcategory) {
    return listingFromPriceCents({
      basePrice: room.subcategory.basePrice,
      fromPriceCents: room.subcategory.fromPriceCents ?? 0,
    })
  }
  return room.basePrice
}

/** Format a price given in cents into a display string, e.g. 24900 -> "$249". */
export function formatPrice(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100).replace(/^([A-Z]{2})(\$)/, "$1 $2")
}

/** Rank listings by similarity to `current` and return up to `limit` matches. Callers should exclude the current listing from `candidates`. */
type SimilarListing = {
  roomTypeId: string
  basePrice: number
  subcategory?: { basePrice: number } | null
  capacity: number
  beds: number
  name: string
  amenities: { id: string }[]
}

export function pickSimilarRooms<C extends SimilarListing>(
  current: SimilarListing,
  candidates: C[],
  limit = 3,
): C[] {
  const currentAmenityIds = new Set(current.amenities.map((a) => a.id))
  const currentPrice = getRoomPrice(current)

  const scored = candidates
    .map((room) => {
      let score = 0

      if (room.roomTypeId === current.roomTypeId) score += 100

      const sharedAmenities = room.amenities.filter((a) =>
        currentAmenityIds.has(a.id),
      ).length
      score += sharedAmenities * 8

      if (room.capacity === current.capacity) score += 15
      if (room.beds === current.beds) score += 10

      const priceDiff = Math.abs(getRoomPrice(room) - currentPrice)
      score += Math.max(0, 40 - priceDiff / 500)

      return { room, score }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.room.name.localeCompare(b.room.name)
    })

  return scored.slice(0, limit).map(({ room }) => room)
}
