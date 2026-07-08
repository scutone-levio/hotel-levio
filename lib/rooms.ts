import type { RoomType, RoomSubcategory } from "@prisma/client"

// Display helpers and constants shared across the app.

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  TWIN: "Twin Room (2 twin beds)",
  QUEEN: "Queen Room (2 queen beds)",
  KING: "King Room (1 king bed)",
  SUITE: "Suite (2 king beds + whirlpool)",
}

export const ROOM_TYPES: RoomType[] = ["TWIN", "QUEEN", "KING", "SUITE"]

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

/** URL path for an individual room page. */
export function roomPath(slug: string) {
  return `/rooms/${slug}`
}

/** Get effective price for a room: subcategory price if assigned, otherwise basePrice. */
export function getRoomPrice(room: {
  basePrice: number
  subcategory?: { basePrice: number } | null
}): number {
  return room.subcategory?.basePrice ?? room.basePrice
}

/** Lowest nightly price across base rate and weekday rules, accounting for subcategory. */
export function fromPrice(room: {
  basePrice: number
  subcategory?: { basePrice: number } | null
  priceRules: { price: number }[]
}) {
  const effectiveBase = getRoomPrice(room)
  const prices = [effectiveBase, ...room.priceRules.map((r) => r.price)]
  return Math.min(...prices)
}

/** Format a price given in cents into a display string, e.g. 24900 -> "$249". */
export function formatPrice(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100).replace(/^([A-Z]{2})(\$)/, "$1 $2")
}

/** Rank rooms by similarity to `current` and return up to `limit` matches. */
export function pickSimilarRooms<
  T extends {
    id: string
    type: RoomType
    basePrice: number
    capacity: number
    beds: number
    featured: boolean
    name: string
    amenities: { id: string }[]
  },
>(current: T, candidates: T[], limit = 3): T[] {
  const currentAmenityIds = new Set(current.amenities.map((a) => a.id))

  const scored = candidates
    .filter((room) => room.id !== current.id)
    .map((room) => {
      let score = 0

      if (room.type === current.type) score += 100

      const sharedAmenities = room.amenities.filter((a) =>
        currentAmenityIds.has(a.id),
      ).length
      score += sharedAmenities * 8

      if (room.capacity === current.capacity) score += 15
      if (room.beds === current.beds) score += 10

      const priceDiff = Math.abs(room.basePrice - current.basePrice)
      score += Math.max(0, 40 - priceDiff / 500)

      if (room.featured) score += 5

      return { room, score }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.room.name.localeCompare(b.room.name)
    })

  return scored.slice(0, limit).map(({ room }) => room)
}
