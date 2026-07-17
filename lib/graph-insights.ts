import {
  isNeo4jConfigured,
  runReadQuery,
  verifyNeo4jConnection,
} from "@/lib/neo4j"

export type RoomTypeInventoryRow = {
  typeName: string
  typeSlug: string
  roomCount: number
  subcategoryLinked: number
}

export type AmenityReachRow = {
  amenityName: string
  category: string | null
  roomCount: number
}

export type BookingByTypeRow = {
  typeName: string
  confirmed: number
  pending: number
  cancelled: number
}

export type RoomRelationshipRow = {
  typeName: string
  subcategoryName: string | null
  roomNumber: string
  amenityNames: string[]
}

export type GraphInsights = {
  connected: true
  nodeCounts: {
    roomTypes: number
    subcategories: number
    rooms: number
    amenities: number
    users: number
    bookings: number
  }
  roomsWithSubcategoryPct: number
  pendingBookings: number
  inventoryByType: RoomTypeInventoryRow[]
  topAmenities: AmenityReachRow[]
  bookingsByType: BookingByTypeRow[]
  roomRelationships: RoomRelationshipRow[]
}

export type GraphInsightsUnavailable = {
  connected: false
  reason: "not_configured" | "unreachable"
}

export type GraphInsightsResult = GraphInsights | GraphInsightsUnavailable

function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber()
  }
  return Number(value ?? 0)
}

export async function getGraphInsights(): Promise<GraphInsightsResult> {
  if (!isNeo4jConfigured()) {
    return { connected: false, reason: "not_configured" }
  }

  try {
    await verifyNeo4jConnection()
  } catch {
    return { connected: false, reason: "unreachable" }
  }

  const [nodeCountsRows, subcategoryPctRows, pendingRows, inventoryRows, amenityRows, bookingRows, relationshipRows] =
    await Promise.all([
      runReadQuery<{ label: string; count: unknown }>(
        `
        MATCH (n)
        RETURN labels(n)[0] AS label, count(n) AS count
        `,
      ),
      runReadQuery<{ pct: unknown }>(
        `
        MATCH (r:Room)
        WITH count(r) AS total
        MATCH (r:Room)-[:IN_SUBCATEGORY]->(:Subcategory)
        WITH total, count(r) AS linked
        RETURN CASE WHEN total = 0 THEN 0 ELSE round(100.0 * linked / total) END AS pct
        `,
      ),
      runReadQuery<{ count: unknown }>(
        `
        MATCH (b:Booking {status: "PENDING"})
        RETURN count(b) AS count
        `,
      ),
      runReadQuery<{
        typeName: string
        typeSlug: string
        roomCount: unknown
        subcategoryLinked: unknown
      }>(
        `
        MATCH (rt:RoomType)
        OPTIONAL MATCH (r:Room)-[:INSTANCE_OF]->(rt)
        WITH rt, count(DISTINCT r) AS roomCount
        OPTIONAL MATCH (linked:Room)-[:INSTANCE_OF]->(rt)
        WHERE EXISTS { MATCH (linked)-[:IN_SUBCATEGORY]->(:Subcategory) }
        WITH rt, roomCount, count(DISTINCT linked) AS subcategoryLinked
        RETURN rt.name AS typeName, rt.slug AS typeSlug, roomCount, subcategoryLinked
        ORDER BY typeName
        `,
      ),
      runReadQuery<{
        amenityName: string
        category: string | null
        roomCount: unknown
      }>(
        `
        MATCH (a:Amenity)<-[:HAS_AMENITY]-(r:Room)
        RETURN a.name AS amenityName, a.category AS category, count(DISTINCT r) AS roomCount
        ORDER BY roomCount DESC, amenityName
        LIMIT 10
        `,
      ),
      runReadQuery<{
        typeName: string
        confirmed: unknown
        pending: unknown
        cancelled: unknown
      }>(
        `
        MATCH (rt:RoomType)
        OPTIONAL MATCH (b:Booking)-[:OF_TYPE]->(rt)
        WITH rt, b
        RETURN rt.name AS typeName,
               sum(CASE WHEN b.status = "CONFIRMED" THEN 1 ELSE 0 END) AS confirmed,
               sum(CASE WHEN b.status = "PENDING" THEN 1 ELSE 0 END) AS pending,
               sum(CASE WHEN b.status = "CANCELLED" THEN 1 ELSE 0 END) AS cancelled
        ORDER BY typeName
        `,
      ),
      runReadQuery<{
        typeName: string
        subcategoryName: string | null
        roomNumber: string
        amenityNames: unknown
      }>(
        `
        MATCH (rt:RoomType)<-[:INSTANCE_OF]-(r:Room)
        OPTIONAL MATCH (r)-[:IN_SUBCATEGORY]->(sc:Subcategory)
        OPTIONAL MATCH (r)-[:HAS_AMENITY]->(a:Amenity)
        RETURN rt.name AS typeName,
               sc.name AS subcategoryName,
               r.roomNumber AS roomNumber,
               collect(DISTINCT a.name) AS amenityNames
        ORDER BY typeName, roomNumber
        `,
      ),
    ])

  const countByLabel = Object.fromEntries(
    nodeCountsRows.map((row) => [row.label, toNumber(row.count)]),
  )

  return {
    connected: true,
    nodeCounts: {
      roomTypes: countByLabel.RoomType ?? 0,
      subcategories: countByLabel.Subcategory ?? 0,
      rooms: countByLabel.Room ?? 0,
      amenities: countByLabel.Amenity ?? 0,
      users: countByLabel.User ?? 0,
      bookings: countByLabel.Booking ?? 0,
    },
    roomsWithSubcategoryPct: toNumber(subcategoryPctRows[0]?.pct),
    pendingBookings: toNumber(pendingRows[0]?.count),
    inventoryByType: inventoryRows.map((row) => ({
      typeName: row.typeName,
      typeSlug: row.typeSlug,
      roomCount: toNumber(row.roomCount),
      subcategoryLinked: toNumber(row.subcategoryLinked),
    })),
    topAmenities: amenityRows.map((row) => ({
      amenityName: row.amenityName,
      category: row.category,
      roomCount: toNumber(row.roomCount),
    })),
    bookingsByType: bookingRows.map((row) => ({
      typeName: row.typeName,
      confirmed: toNumber(row.confirmed),
      pending: toNumber(row.pending),
      cancelled: toNumber(row.cancelled),
    })),
    roomRelationships: relationshipRows.map((row) => ({
      typeName: row.typeName,
      subcategoryName: row.subcategoryName,
      roomNumber: row.roomNumber,
      amenityNames: normalizeAmenityNames(row.amenityNames),
    })),
  }
}

export function normalizeAmenityNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const names = raw.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  )
  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}
