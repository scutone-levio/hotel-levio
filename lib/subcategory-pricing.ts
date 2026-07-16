import { prisma, type ExtendedPrismaClient, type PrismaTransactionClient } from "@/lib/prisma"

type PrismaDb = ExtendedPrismaClient | PrismaTransactionClient

export type RoomPricingSnapshot = {
  basePrice: number
  priceRules: Array<{ price: number }>
}

/** Derive stored listing fields from inventory room pricing rows. */
export function computeSubcategoryPricingFromRooms(
  rooms: RoomPricingSnapshot[],
): { fromPriceCents: number; hasWeekendRates: boolean } {
  if (rooms.length === 0) {
    return { fromPriceCents: 0, hasWeekendRates: false }
  }

  let fromPriceCents = Number.POSITIVE_INFINITY
  let hasWeekendRates = false

  for (const room of rooms) {
    const nightlyRates = [
      room.basePrice,
      ...room.priceRules.map((rule) => rule.price),
    ]
    fromPriceCents = Math.min(fromPriceCents, ...nightlyRates)

    for (const rule of room.priceRules) {
      if (rule.price > room.basePrice) {
        hasWeekendRates = true
      }
    }
  }

  return {
    fromPriceCents: Number.isFinite(fromPriceCents) ? fromPriceCents : 0,
    hasWeekendRates,
  }
}

/** Pick lowest roomNumber among units not in bookedIds. */
export function pickLowestAvailableRoomNumber<
  T extends { id: string; roomNumber: string },
>(units: T[], bookedIds: Set<string>): T | null {
  const available = units
    .filter((unit) => !bookedIds.has(unit.id))
    .sort((a, b) =>
      a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }),
    )
  return available[0] ?? null
}

export async function recomputeSubcategoryPricing(
  subcategoryId: string,
  tx: PrismaDb = prisma,
): Promise<void> {
  const rooms = await tx.room.findMany({
    where: { subcategoryId, isCatalog: false },
    select: {
      basePrice: true,
      priceRules: { select: { price: true } },
    },
  })

  const { fromPriceCents, hasWeekendRates } =
    computeSubcategoryPricingFromRooms(rooms)

  await tx.roomSubcategory.update({
    where: { id: subcategoryId },
    data: { fromPriceCents, hasWeekendRates },
  })
}

export async function recomputeSubcategoryPricingForRoom(
  roomId: string,
): Promise<void> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { subcategoryId: true },
  })
  if (room?.subcategoryId) {
    await recomputeSubcategoryPricing(room.subcategoryId)
  }
}

export async function recomputeAllSubcategoryPricing(
  tx: PrismaDb = prisma,
): Promise<void> {
  const subcategories = await tx.roomSubcategory.findMany({
    select: { id: true },
  })
  for (const sub of subcategories) {
    await recomputeSubcategoryPricing(sub.id, tx)
  }
}

/** Set each inventory room basePrice to the subcategory default. */
export async function syncInventoryBasesToSubcategory(
  subcategoryId: string,
  tx: PrismaDb = prisma,
): Promise<void> {
  const sub = await tx.roomSubcategory.findUnique({
    where: { id: subcategoryId },
    select: { basePrice: true },
  })
  if (!sub) return

  await tx.room.updateMany({
    where: { subcategoryId, isCatalog: false },
    data: { basePrice: sub.basePrice },
  })
}

export async function deleteOrphanSubcategories(): Promise<number> {
  const orphans = await prisma.roomSubcategory.findMany({
    where: {
      rooms: { none: { isCatalog: false } },
      bookings: { none: {} },
    },
    select: { id: true },
  })

  if (orphans.length === 0) return 0

  await prisma.roomSubcategory.deleteMany({
    where: { id: { in: orphans.map((o) => o.id) } },
  })

  return orphans.length
}

/** Align inventory basePrice with subcategory where they differ. */
export async function syncMismatchedInventoryBases(): Promise<number> {
  const rooms = await prisma.room.findMany({
    where: { isCatalog: false, subcategoryId: { not: null } },
    select: {
      id: true,
      basePrice: true,
      subcategory: { select: { basePrice: true } },
    },
  })

  let updated = 0
  for (const room of rooms) {
    const subBase = room.subcategory?.basePrice
    if (subBase == null || room.basePrice === subBase) continue
    await prisma.room.update({
      where: { id: room.id },
      data: { basePrice: subBase },
    })
    updated += 1
  }
  return updated
}
