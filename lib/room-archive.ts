import { prisma, type PrismaTransactionClient } from "@/lib/prisma"

const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED"] as const

type DbClient = PrismaTransactionClient | typeof prisma

export async function countActiveBookingsForRoom(
  roomId: string,
  db: DbClient = prisma,
): Promise<number> {
  return db.booking.count({
    where: {
      roomId,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
    },
  })
}

export async function assertRoomHasNoActiveBookings(
  roomId: string,
  action = "update",
  db: DbClient = prisma,
): Promise<void> {
  const count = await countActiveBookingsForRoom(roomId, db)
  if (count > 0) {
    throw new Error(
      `Cannot ${action} room: ${count} active booking${count === 1 ? "" : "s"} exist${count === 1 ? "s" : ""}.`,
    )
  }
}

export async function assertRoomTypeHasNoActiveInventoryBookings(
  roomTypeId: string,
): Promise<void> {
  const count = await prisma.booking.count({
    where: {
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      room: {
        roomTypeId,
        isCatalog: false,
        archivedAt: null,
      },
    },
  })
  if (count > 0) {
    throw new Error(
      `Cannot archive room type: ${count} active booking${count === 1 ? "" : "s"} exist on inventory rooms.`,
    )
  }
}

export async function assertSubcategoryHasNoActiveBookings(
  subcategoryId: string,
): Promise<void> {
  const count = await prisma.booking.count({
    where: {
      subcategoryId,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      room: { archivedAt: null },
    },
  })
  if (count > 0) {
    throw new Error(
      `Cannot archive subcategory: ${count} active booking${count === 1 ? "" : "s"} exist.`,
    )
  }
}

export async function archiveRoom(roomId: string, db: DbClient = prisma): Promise<void> {
  const doArchive = async (tx: DbClient) => {
    const locked = await tx.$queryRaw<{ id: string; isCatalog: boolean }[]>`
      SELECT id, "isCatalog" FROM "Room" WHERE id = ${roomId} FOR UPDATE
    `
    if (locked.length === 0) throw new Error("Room not found")
    if (locked[0].isCatalog) throw new Error("Catalog rooms cannot be archived")

    await assertRoomHasNoActiveBookings(roomId, "archive", tx)

    await tx.room.update({
      where: { id: roomId },
      data: { archivedAt: new Date() },
    })
  }

  // Lock the room row and recheck for active bookings immediately before
  // archiving so a booking created concurrently can't slip through. When
  // called from within an outer transaction (e.g. inventory sync), reuse it
  // instead of nesting.
  if (db === prisma) {
    await prisma.$transaction((tx) => doArchive(tx))
  } else {
    await doArchive(db)
  }
}

export async function restoreRoom(roomId: string, db: DbClient = prisma): Promise<void> {
  const doRestore = async (tx: DbClient) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        roomNumber: true,
        subcategoryId: true,
        roomType: { select: { isActive: true } },
        subcategory: { select: { isActive: true } },
      },
    })
    if (!room) throw new Error("Room not found")
    if (!room.roomType.isActive) {
      throw new Error("Cannot restore room: room type is archived")
    }
    if (room.subcategoryId && room.subcategory && !room.subcategory.isActive) {
      throw new Error("Cannot restore room: subcategory is archived")
    }

    const conflict = await tx.room.findFirst({
      where: {
        roomNumber: room.roomNumber,
        archivedAt: null,
        NOT: { id: roomId },
      },
      select: { id: true },
    })
    if (conflict) {
      throw new Error(`Room number ${room.roomNumber} is already in use`)
    }

    await tx.room.update({
      where: { id: roomId },
      data: { archivedAt: null },
    })
  }

  if (db === prisma) {
    await prisma.$transaction((tx) => doRestore(tx))
  } else {
    await doRestore(db)
  }
}

export async function archiveRoomType(roomTypeId: string): Promise<void> {
  const type = await prisma.roomTypeDefinition.findUnique({
    where: { id: roomTypeId },
    select: { id: true, isActive: true },
  })
  if (!type) throw new Error("Room type not found")
  if (!type.isActive) return

  await assertRoomTypeHasNoActiveInventoryBookings(roomTypeId)

  await prisma.roomTypeDefinition.update({
    where: { id: roomTypeId },
    data: { isActive: false },
  })
}

export async function restoreRoomType(roomTypeId: string): Promise<void> {
  const type = await prisma.roomTypeDefinition.findUnique({
    where: { id: roomTypeId },
    select: { id: true },
  })
  if (!type) throw new Error("Room type not found")

  await prisma.roomTypeDefinition.update({
    where: { id: roomTypeId },
    data: { isActive: true },
  })
}

export async function archiveSubcategory(subcategoryId: string): Promise<void> {
  const sub = await prisma.roomSubcategory.findUnique({
    where: { id: subcategoryId },
    select: { id: true, isActive: true },
  })
  if (!sub) throw new Error("Subcategory not found")
  if (!sub.isActive) return

  await assertSubcategoryHasNoActiveBookings(subcategoryId)

  await prisma.roomSubcategory.update({
    where: { id: subcategoryId },
    data: { isActive: false },
  })
}

export async function restoreSubcategory(subcategoryId: string): Promise<void> {
  const sub = await prisma.roomSubcategory.findUnique({
    where: { id: subcategoryId },
    select: { id: true },
  })
  if (!sub) throw new Error("Subcategory not found")

  await prisma.roomSubcategory.update({
    where: { id: subcategoryId },
    data: { isActive: true },
  })
}
