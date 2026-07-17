import { prisma } from "@/lib/prisma"
import {
  closeNeo4jDriver,
  isNeo4jConfigured,
  runWriteTransaction,
  verifyNeo4jConnection,
} from "@/lib/neo4j"

export type GraphSyncStats = {
  roomTypes: number
  subcategories: number
  rooms: number
  amenities: number
  users: number
  bookings: number
}

export async function syncGraphFromPostgres(): Promise<GraphSyncStats> {
  if (!isNeo4jConfigured()) {
    throw new Error(
      "Neo4j is not configured. Set NEO4J_URI and NEO4J_PASSWORD in .env",
    )
  }

  await verifyNeo4jConnection()

  const [roomTypes, subcategories, rooms, amenities, users, bookings] =
    await Promise.all([
      prisma.roomTypeDefinition.findMany({
        select: { id: true, name: true, slug: true, isActive: true },
      }),
      prisma.roomSubcategory.findMany({
        select: { id: true, name: true, roomTypeId: true, isActive: true },
      }),
      prisma.room.findMany({
        select: {
          id: true,
          name: true,
          roomNumber: true,
          roomTypeId: true,
          subcategoryId: true,
          isCatalog: true,
          archivedAt: true,
          amenities: { select: { id: true } },
        },
      }),
      prisma.amenity.findMany({
        select: { id: true, name: true, category: true },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
      }),
      prisma.booking.findMany({
        select: {
          id: true,
          userId: true,
          roomId: true,
          roomTypeId: true,
          subcategoryId: true,
          status: true,
          totalPrice: true,
          checkIn: true,
          checkOut: true,
        },
      }),
    ])

  await runWriteTransaction(async (tx) => {
    await tx.run("MATCH (n) DETACH DELETE n")

    if (roomTypes.length) {
      await tx.run(
        `
        UNWIND $rows AS row
        MERGE (rt:RoomType {id: row.id})
        SET rt.name = row.name,
            rt.slug = row.slug,
            rt.isActive = row.isActive
        `,
        {
          rows: roomTypes.map((rt) => ({
            id: rt.id,
            name: rt.name,
            slug: rt.slug,
            isActive: rt.isActive,
          })),
        },
      )
    }

    if (subcategories.length) {
      await tx.run(
        `
        UNWIND $rows AS row
        MERGE (sc:Subcategory {id: row.id})
        SET sc.name = row.name,
            sc.isActive = row.isActive
        WITH sc, row
        MATCH (rt:RoomType {id: row.roomTypeId})
        MERGE (sc)-[:OF_TYPE]->(rt)
        `,
        {
          rows: subcategories.map((sc) => ({
            id: sc.id,
            name: sc.name,
            roomTypeId: sc.roomTypeId,
            isActive: sc.isActive,
          })),
        },
      )
    }

    if (amenities.length) {
      await tx.run(
        `
        UNWIND $rows AS row
        MERGE (a:Amenity {id: row.id})
        SET a.name = row.name,
            a.category = row.category
        `,
        {
          rows: amenities.map((a) => ({
            id: a.id,
            name: a.name,
            category: a.category,
          })),
        },
      )
    }

    if (rooms.length) {
      await tx.run(
        `
        UNWIND $rows AS row
        MERGE (r:Room {id: row.id})
        SET r.name = row.name,
            r.roomNumber = row.roomNumber,
            r.isCatalog = row.isCatalog,
            r.archivedAt = row.archivedAt
        WITH r, row
        MATCH (rt:RoomType {id: row.roomTypeId})
        MERGE (r)-[:INSTANCE_OF]->(rt)
        `,
        {
          rows: rooms.map((r) => ({
            id: r.id,
            name: r.name,
            roomNumber: r.roomNumber,
            roomTypeId: r.roomTypeId,
            isCatalog: r.isCatalog,
            archivedAt: r.archivedAt?.toISOString() ?? null,
          })),
        },
      )

      const subcategoryLinks = rooms
        .filter((r) => r.subcategoryId)
        .map((r) => ({ roomId: r.id, subcategoryId: r.subcategoryId! }))

      if (subcategoryLinks.length) {
        await tx.run(
          `
          UNWIND $rows AS row
          MATCH (r:Room {id: row.roomId})
          MATCH (sc:Subcategory {id: row.subcategoryId})
          MERGE (r)-[:IN_SUBCATEGORY]->(sc)
          `,
          { rows: subcategoryLinks },
        )
      }

      const amenityLinks = rooms.flatMap((r) =>
        r.amenities.map((a) => ({ roomId: r.id, amenityId: a.id })),
      )

      if (amenityLinks.length) {
        await tx.run(
          `
          UNWIND $rows AS row
          MATCH (r:Room {id: row.roomId})
          MATCH (a:Amenity {id: row.amenityId})
          MERGE (r)-[:HAS_AMENITY]->(a)
          `,
          { rows: amenityLinks },
        )
      }
    }

    if (users.length) {
      await tx.run(
        `
        UNWIND $rows AS row
        MERGE (u:User {id: row.id})
        SET u.name = row.name,
            u.email = row.email,
            u.role = row.role
        `,
        {
          rows: users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
          })),
        },
      )
    }

    if (bookings.length) {
      await tx.run(
        `
        UNWIND $rows AS row
        MERGE (b:Booking {id: row.id})
        SET b.status = row.status,
            b.totalPrice = row.totalPrice,
            b.checkIn = row.checkIn,
            b.checkOut = row.checkOut
        WITH b, row
        MATCH (u:User {id: row.userId})
        MATCH (r:Room {id: row.roomId})
        MERGE (u)-[:BOOKED]->(b)
        MERGE (b)-[:FOR_ROOM]->(r)
        `,
        {
          rows: bookings.map((b) => ({
            id: b.id,
            userId: b.userId,
            roomId: b.roomId,
            status: b.status,
            totalPrice: b.totalPrice,
            checkIn: b.checkIn.toISOString(),
            checkOut: b.checkOut.toISOString(),
          })),
        },
      )

      const typeLinks = bookings.map((b) => ({
        bookingId: b.id,
        roomTypeId: b.roomTypeId,
        roomId: b.roomId,
      }))

      if (typeLinks.length) {
        await tx.run(
          `
          UNWIND $rows AS row
          MATCH (b:Booking {id: row.bookingId})
          OPTIONAL MATCH (rt:RoomType {id: row.roomTypeId})
          WITH b, row, rt
          OPTIONAL MATCH (b)-[:FOR_ROOM]->(r:Room {id: row.roomId})-[:INSTANCE_OF]->(rtFromRoom:RoomType)
          WITH b, coalesce(rt, rtFromRoom) AS roomType
          WHERE roomType IS NOT NULL
          MERGE (b)-[:OF_TYPE]->(roomType)
          `,
          { rows: typeLinks },
        )
      }
    }
  })

  return {
    roomTypes: roomTypes.length,
    subcategories: subcategories.length,
    rooms: rooms.length,
    amenities: amenities.length,
    users: users.length,
    bookings: bookings.length,
  }
}

export async function syncGraphFromPostgresAndClose(): Promise<GraphSyncStats> {
  try {
    return await syncGraphFromPostgres()
  } finally {
    await closeNeo4jDriver()
  }
}
