import { startOfDay } from "date-fns"

import { prisma, type PrismaTransactionClient } from "@/lib/prisma"
import { isRangeAvailable } from "@/lib/availability"
import { quoteRange, type Quote } from "@/lib/pricing"
import {
  normalizeRoomNumber,
  parseRoomNumber,
  suggestNextRoomNumbers,
  validateRoomNumber,
} from "@/lib/floor-plan"
import {
  archiveRoom,
  assertRoomHasNoActiveBookings,
} from "@/lib/room-archive"
import { activeInventoryRoomFilter } from "@/lib/room-types"
import { subcategoryNameForInventoryRoom } from "@/lib/subcategories"
import type { Prisma } from "@prisma/client"

const inventoryInclude = {
  blackouts: true,
  priceRules: true,
  roomType: true,
} as const

type DbClient = PrismaTransactionClient | typeof prisma

export type InventoryUnit = Awaited<
  ReturnType<typeof getAvailableUnits>
>[number]

/** Non-archived rooms (catalog and inventory). */
export function inventoryRoomFilter(): Prisma.RoomWhereInput {
  return { archivedAt: null }
}

async function assertRoomNumberAvailable(
  roomNumber: string,
  excludeRoomId?: string,
  db: DbClient = prisma,
): Promise<void> {
  const conflict = await db.room.findFirst({
    where: {
      roomNumber,
      archivedAt: null,
      ...(excludeRoomId ? { NOT: { id: excludeRoomId } } : {}),
    },
    select: { id: true },
  })
  if (conflict) {
    throw new Error(`Room number ${roomNumber} is already in use`)
  }
}

export async function getAvailableUnits(
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  subcategoryId?: string,
) {
  const from = startOfDay(checkIn)
  const to = startOfDay(checkOut)

  const units = await prisma.room.findMany({
    where: {
      roomTypeId,
      ...activeInventoryRoomFilter(),
      ...(subcategoryId ? { subcategoryId } : {}),
      OR: [{ subcategoryId: null }, { subcategory: { isActive: true } }],
    },
    include: inventoryInclude,
    orderBy: { roomNumber: "asc" },
  })

  const booked = await prisma.booking.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      checkIn: { lt: to },
      checkOut: { gt: from },
      room: {
        roomTypeId,
        archivedAt: null,
        ...(subcategoryId ? { subcategoryId } : {}),
      },
    },
    select: { roomId: true },
  })
  const bookedIds = new Set(booked.map((b) => b.roomId))

  return units.filter(
    (unit) =>
      !bookedIds.has(unit.id) &&
      isRangeAvailable(unit.blackouts, from, to),
  )
}

export async function assignAvailableUnit(
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  subcategoryId?: string,
) {
  const available = await getAvailableUnits(
    roomTypeId,
    checkIn,
    checkOut,
    subcategoryId,
  )
  return available[0] ?? null
}

type UnitWithPricing = {
  basePrice: number
  priceRules: Array<{ dayOfWeek: number; price: number }>
}

export function quoteInventoryUnit(
  unit: UnitWithPricing,
  checkIn: Date,
  checkOut: Date,
): Quote {
  return quoteRange(unit.basePrice, unit.priceRules, checkIn, checkOut)
}

export async function resolveBookingRoom(input: {
  roomId: string
  checkIn: Date
  checkOut: Date
  subcategoryId?: string
}) {
  const catalog = await prisma.room.findUnique({
    where: { id: input.roomId },
    select: {
      id: true,
      roomTypeId: true,
      isCatalog: true,
      roomNumber: true,
      archivedAt: true,
    },
  })
  if (!catalog || catalog.archivedAt) return null

  if (catalog.isCatalog) {
    return assignAvailableUnit(
      catalog.roomTypeId,
      input.checkIn,
      input.checkOut,
      input.subcategoryId,
    )
  }

  const room = await prisma.room.findUnique({
    where: { id: input.roomId },
    include: {
      ...inventoryInclude,
      subcategory: { select: { isActive: true } },
    },
  })
  if (!room?.roomNumber || room.archivedAt) return null
  if (!room.roomType.isActive) return null
  if (room.subcategoryId && room.subcategory && !room.subcategory.isActive) {
    return null
  }

  if (!isRangeAvailable(room.blackouts, input.checkIn, input.checkOut)) {
    return null
  }

  const conflict = await prisma.booking.findFirst({
    where: {
      roomId: room.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      checkIn: { lt: input.checkOut },
      checkOut: { gt: input.checkIn },
    },
  })

  return conflict ? null : room
}

export async function getInventoryCountsByTypeId() {
  const rows = await prisma.room.groupBy({
    by: ["roomTypeId"],
    where: activeInventoryRoomFilter(),
    _count: { _all: true },
  })
  return Object.fromEntries(
    rows.map((r) => [r.roomTypeId, r._count._all]),
  ) as Record<string, number>
}

async function subcategoryIdForNewUnit(
  roomTypeId: string,
  floor: number,
  indexOnFloor: number,
  db: DbClient = prisma,
): Promise<string> {
  const name = subcategoryNameForInventoryRoom(floor, indexOnFloor)
  const sub = await db.roomSubcategory.findFirst({
    where: { roomTypeId, name, isActive: true },
    select: { id: true },
  })
  if (!sub) {
    throw new Error(
      `No "${name}" subcategory for this room type. Create it in admin before adding inventory.`,
    )
  }
  return sub.id
}

type CatalogRoom = Prisma.RoomGetPayload<{
  include: { amenities: true; priceRules: true; roomType: true }
}>

async function addInventoryUnits(
  roomTypeId: string,
  count: number,
  catalog: CatalogRoom,
  tx: PrismaTransactionClient,
) {
  // Include archived rooms so their numbers aren't handed out to new units.
  const taken = new Set(
    (await tx.room.findMany({ select: { roomNumber: true } })).map(
      (r) => r.roomNumber,
    ),
  )
  const slots = suggestNextRoomNumbers(count, taken)
  if (slots.length !== count) {
    throw new Error(
      `Only ${slots.length} of ${count} room numbers are available`,
    )
  }

  const existingOnFloor = await tx.room.groupBy({
    by: ["floor"],
    where: { roomTypeId, isCatalog: false, archivedAt: null },
    _count: { _all: true },
  })
  const countByFloor = new Map(
    existingOnFloor.map((row) => [row.floor ?? 0, row._count._all]),
  )

  for (const slot of slots) {
    await assertRoomNumberAvailable(slot.roomNumber, undefined, tx)
    const slug = `room-${slot.roomNumber}`
    const slugConflict = await tx.room.findUnique({ where: { slug } })
    if (slugConflict) {
      throw new Error(`Room number ${slot.roomNumber} is already in use`)
    }

    const indexOnFloor = countByFloor.get(slot.floor) ?? 0
    const subcategoryId = await subcategoryIdForNewUnit(
      roomTypeId,
      slot.floor,
      indexOnFloor,
      tx,
    )
    countByFloor.set(slot.floor, indexOnFloor + 1)

    await tx.room.create({
      data: {
        name: `${catalog.name} · ${slot.roomNumber}`,
        slug,
        description: catalog.description,
        roomTypeId,
        basePrice: catalog.basePrice,
        capacity: catalog.capacity,
        beds: catalog.beds,
        floor: slot.floor,
        roomNumber: slot.roomNumber,
        isCatalog: false,
        subcategoryId,
        amenities: { connect: catalog.amenities.map((a) => ({ id: a.id })) },
        priceRules: {
          create:
            catalog.priceRules.length > 0
              ? catalog.priceRules.map((r) => ({
                  dayOfWeek: r.dayOfWeek,
                  price: r.price,
                }))
              : [
                  { dayOfWeek: 5, price: Math.round(catalog.basePrice * 1.25) },
                  { dayOfWeek: 6, price: Math.round(catalog.basePrice * 1.25) },
                ],
        },
      },
    })
  }
}

export async function syncTypeQuantity(
  roomTypeId: string,
  targetQty: number,
  outerTx?: PrismaTransactionClient,
) {
  if (!Number.isInteger(targetQty) || targetQty < 0) {
    throw new Error("Quantity must be a non-negative integer")
  }

  const run = async (tx: PrismaTransactionClient) => {
    const roomType = await tx.roomTypeDefinition.findUnique({
      where: { id: roomTypeId },
      select: { isActive: true },
    })
    if (!roomType) throw new Error("Room type not found")
    if (!roomType.isActive) {
      throw new Error("Cannot sync inventory: room type is archived")
    }

    const current = await tx.room.findMany({
      where: {
        roomTypeId,
        ...activeInventoryRoomFilter(),
      },
      include: { bookings: { where: { status: { in: ["PENDING", "CONFIRMED"] } } } },
      orderBy: { roomNumber: "asc" },
    })

    if (targetQty > current.length) {
      const catalog = await tx.room.findFirst({
        where: { roomTypeId, isCatalog: true, archivedAt: null },
        include: { amenities: true, priceRules: true, roomType: true },
      })
      if (!catalog) throw new Error("No catalog room for this type")

      await addInventoryUnits(roomTypeId, targetQty - current.length, catalog, tx)
      return
    }

    if (targetQty < current.length) {
      const surplus = current.length - targetQty
      const removable = current
        .filter((r) => !r.isCatalog && r.bookings.length === 0)
        .slice(-surplus)

      if (removable.length < surplus) {
        throw new Error(
          `Cannot reduce below ${current.length - removable.length}: ${surplus - removable.length} unit(s) have active bookings or are catalog rooms`,
        )
      }

      for (const room of removable) {
        await archiveRoom(room.id, tx)
      }
    }
  }

  if (outerTx) return run(outerTx)
  return prisma.$transaction(run)
}

async function assertInventoryAssignmentValid(
  tx: PrismaTransactionClient,
  room: { roomTypeId: string; subcategoryId: string | null },
  input: {
    roomTypeId?: string
    subcategoryId?: string | null
  },
  roomTypeId: string,
  subcategoryId: string | null,
): Promise<void> {
  if (roomTypeId !== room.roomTypeId) {
    const type = await tx.roomTypeDefinition.findFirst({
      where: { id: roomTypeId, isActive: true },
      select: { id: true },
    })
    if (!type) throw new Error("Room type not found or is archived")
  }

  if (!subcategoryId) return

  const sub = await tx.roomSubcategory.findFirst({
    where: { id: subcategoryId, roomTypeId },
  })
  if (!sub) throw new Error("Subcategory does not match room type")

  const subcategoryChanged =
    input.subcategoryId !== undefined &&
    input.subcategoryId !== room.subcategoryId
  if (subcategoryChanged && !sub.isActive) {
    throw new Error("Subcategory is archived")
  }
}

export async function updateRoomInventory(
  roomId: string,
  input: {
    floor?: number
    roomNumber?: string
    roomTypeId?: string
    subcategoryId?: string | null
  },
) {
  await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({ where: { id: roomId } })
    if (!room) throw new Error("Room not found")
    if (room.isCatalog) throw new Error("Catalog rooms cannot be edited here")

    const roomTypeId = input.roomTypeId ?? room.roomTypeId
    const subcategoryId =
      input.subcategoryId === undefined ? room.subcategoryId : input.subcategoryId

    const assignmentChanged =
      (input.roomTypeId !== undefined && input.roomTypeId !== room.roomTypeId) ||
      (input.subcategoryId !== undefined &&
        input.subcategoryId !== room.subcategoryId)
    if (assignmentChanged) {
      await assertRoomHasNoActiveBookings(roomId, "change", tx)
    }

    await assertInventoryAssignmentValid(tx, room, input, roomTypeId, subcategoryId)

    const roomNumber = normalizeRoomNumber(input.roomNumber ?? room.roomNumber)
    const formatError = validateRoomNumber(roomNumber)
    if (formatError) throw new Error(formatError)

    const floor = input.floor ?? parseRoomNumber(roomNumber).floor

    await assertRoomNumberAvailable(roomNumber, roomId, tx)

    const slug = `room-${roomNumber}`
    const slugConflict = await tx.room.findFirst({
      where: { slug, NOT: { id: roomId } },
    })
    if (slugConflict) {
      throw new Error(`Room number ${roomNumber} is already in use`)
    }

    const catalog = await tx.room.findFirst({
      where: { roomTypeId, isCatalog: true, archivedAt: null },
      select: { name: true },
    })
    if (!catalog) {
      throw new Error("No active catalog room for the selected room type")
    }

    await tx.room.update({
      where: { id: roomId },
      data: {
        roomTypeId,
        subcategoryId,
        floor,
        roomNumber,
        slug,
        name: `${catalog.name} · ${roomNumber}`,
      },
    })
  })
}

export { archiveRoom, restoreRoom } from "@/lib/room-archive"
