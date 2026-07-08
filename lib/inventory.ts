import type { RoomType } from "@prisma/client"
import { startOfDay } from "date-fns"

import { prisma } from "@/lib/prisma"
import { isRangeAvailable } from "@/lib/availability"
import {
  normalizeRoomNumber,
  parseRoomNumber,
  slotsForType,
  suggestSlotsForType,
  validateRoomAssignment,
  validateRoomNumber,
} from "@/lib/floor-plan"

const inventoryInclude = {
  blackouts: true,
  priceRules: true,
} as const

export type InventoryUnit = Awaited<
  ReturnType<typeof getAvailableUnits>
>[number]

/** All rooms with assigned inventory (every room has a unique room number). */
export function inventoryRoomFilter() {
  return {} as const
}

async function assertRoomNumberAvailable(
  roomNumber: string,
  excludeRoomId?: string,
): Promise<void> {
  const conflict = await prisma.room.findFirst({
    where: {
      roomNumber,
      ...(excludeRoomId ? { NOT: { id: excludeRoomId } } : {}),
    },
    select: { id: true },
  })
  if (conflict) {
    throw new Error(`Room number ${roomNumber} is already in use`)
  }
}

export async function getAvailableUnits(
  type: RoomType,
  checkIn: Date,
  checkOut: Date,
) {
  const from = startOfDay(checkIn)
  const to = startOfDay(checkOut)

  const units = await prisma.room.findMany({
    where: { type, ...inventoryRoomFilter() },
    include: inventoryInclude,
    orderBy: { roomNumber: "asc" },
  })

  const booked = await prisma.booking.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      checkIn: { lt: to },
      checkOut: { gt: from },
      room: { type },
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
  type: RoomType,
  checkIn: Date,
  checkOut: Date,
) {
  const available = await getAvailableUnits(type, checkIn, checkOut)
  return available[0] ?? null
}

export async function resolveBookingRoom(input: {
  roomId: string
  checkIn: Date
  checkOut: Date
}) {
  const catalog = await prisma.room.findUnique({
    where: { id: input.roomId },
    select: { id: true, type: true, isCatalog: true, roomNumber: true },
  })
  if (!catalog) return null

  if (catalog.isCatalog) {
    return assignAvailableUnit(catalog.type, input.checkIn, input.checkOut)
  }

  const room = await prisma.room.findUnique({
    where: { id: input.roomId },
    include: inventoryInclude,
  })
  if (!room?.roomNumber) return null

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

export async function getInventoryCountsByType() {
  const rows = await prisma.room.groupBy({
    by: ["type"],
    where: inventoryRoomFilter(),
    _count: { _all: true },
  })
  return Object.fromEntries(
    rows.map((r) => [r.type, r._count._all]),
  ) as Record<RoomType, number>
}

export async function syncTypeQuantity(type: RoomType, targetQty: number) {
  if (!Number.isInteger(targetQty) || targetQty < 0) {
    throw new Error("Quantity must be a non-negative integer")
  }

  const current = await prisma.room.findMany({
    where: { type, ...inventoryRoomFilter() },
    include: { bookings: { where: { status: { in: ["PENDING", "CONFIRMED"] } } } },
    orderBy: { roomNumber: "asc" },
  })

  if (targetQty > current.length) {
    const taken = new Set(
      (await prisma.room.findMany({ select: { roomNumber: true } })).map(
        (r) => r.roomNumber,
      ),
    )
    const catalog = await prisma.room.findFirst({
      where: { type, isCatalog: true },
      include: { amenities: true, priceRules: true },
    })
    if (!catalog) throw new Error(`No catalog room for ${type}`)

    const toAdd = targetQty - current.length
    const slots = suggestSlotsForType(type, toAdd, taken)

    for (const slot of slots) {
      await assertRoomNumberAvailable(slot.roomNumber)
      const slug = `room-${slot.roomNumber}`
      const slugConflict = await prisma.room.findUnique({ where: { slug } })
      if (slugConflict) {
        throw new Error(`Room number ${slot.roomNumber} is already in use`)
      }

      await prisma.room.create({
        data: {
          name: `${catalog.name} · ${slot.roomNumber}`,
          slug,
          description: catalog.description,
          type,
          basePrice: catalog.basePrice,
          capacity: catalog.capacity,
          beds: catalog.beds,
          floor: slot.floor,
          roomNumber: slot.roomNumber,
          isCatalog: false,
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
      await prisma.room.delete({ where: { id: room.id } })
    }
  }
}

export async function updateRoomInventory(
  roomId: string,
  input: { floor?: number; roomNumber?: string; type?: RoomType },
) {
  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room) throw new Error("Room not found")

  const type = input.type ?? room.type
  const roomNumber = normalizeRoomNumber(input.roomNumber ?? room.roomNumber)
  const formatError = validateRoomNumber(roomNumber)
  if (formatError) throw new Error(formatError)

  const floor = input.floor ?? parseRoomNumber(roomNumber).floor

  const floorError = validateRoomAssignment(type, floor)
  if (floorError) throw new Error(floorError)

  await assertRoomNumberAvailable(roomNumber, roomId)

  const slug = room.isCatalog ? room.slug : `room-${roomNumber}`
  if (!room.isCatalog) {
    const slugConflict = await prisma.room.findFirst({
      where: { slug, NOT: { id: roomId } },
    })
    if (slugConflict) {
      throw new Error(`Room number ${roomNumber} is already in use`)
    }
  }

  await prisma.room.update({
    where: { id: roomId },
    data: {
      type,
      floor,
      roomNumber,
      slug,
      name: room.isCatalog
        ? room.name
        : `${room.name.split(" · ")[0]} · ${roomNumber}`,
    },
  })
}

export function preferredSlotsRemaining(
  type: RoomType,
  takenRoomNumbers: Set<string>,
) {
  return slotsForType(type).filter((s) => !takenRoomNumbers.has(s.roomNumber))
}
