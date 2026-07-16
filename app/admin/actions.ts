"use server"

import { revalidatePath } from "next/cache"
import { differenceInCalendarDays } from "date-fns"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { UTApi } from "uploadthing/server"

import { prisma, type PrismaTransactionClient } from "@/lib/prisma"
import { quoteRange } from "@/lib/pricing"
import { syncTypeQuantity, updateRoomInventory } from "@/lib/inventory"
import {
  recomputeAllSubcategoryPricing,
  recomputeSubcategoryPricing,
  recomputeSubcategoryPricingForRoom,
  syncInventoryBasesToSubcategory,
} from "@/lib/subcategory-pricing"
import { sendMail } from "@/lib/mailer"
import {
  adminBookingModifiedEmail,
  adminBookingDeletedEmail,
} from "@/lib/email-templates"
import { isAllowedImageUrl } from "@/lib/image-hosts"
import {
  archiveRoom,
  archiveRoomType,
  archiveSubcategory,
  restoreRoom,
  restoreRoomType,
  restoreSubcategory,
} from "@/lib/room-archive"
import { suggestNextRoomNumbers } from "@/lib/floor-plan"

const ADMIN_EMAIL = "sergio.cutone@levio.ca"

export type ActionResult = { ok: true } | { ok: false; error: string }

// Best-effort cleanup of an UploadThing file that was uploaded client-side
// but whose metadata failed to persist, so it doesn't stay orphaned in storage.
async function cleanupOrphanedUpload(key?: string | null) {
  if (!key || !process.env.UPLOADTHING_TOKEN) return
  try {
    await new UTApi().deleteFiles(key)
  } catch (e) {
    console.error("Failed to clean up orphaned UploadThing file:", e)
  }
}

const imageUrlSchema = z
  .string()
  .url("A valid image URL is required")
  .refine(isAllowedImageUrl, "Image URL host is not on the approved allowlist")

function revalidate() {
  revalidatePath("/admin")
  revalidatePath("/admin/catalog")
  revalidatePath("/admin/rooms")
  revalidatePath("/rooms", "layout")
  revalidatePath("/")
}

async function run(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn()
    revalidate()
    return { ok: true }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(", ")
        : String(err.meta?.target ?? "field")
      if (target.includes("roomNumber")) {
        return { ok: false, error: "That room number is already in use" }
      }
      if (target.includes("slug")) {
        return {
          ok: false,
          error: "That slug is already in use. Choose a different slug.",
        }
      }
    }
    const message = err instanceof Error ? err.message : "Something went wrong"
    console.error("Admin action failed:", message)
    return { ok: false, error: message }
  }
}

/* -------------------------------------------------------------------------- */
/*  Amenities (catalog CRUD)                                                    */
/* -------------------------------------------------------------------------- */

const amenitySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  category: z.string().trim().optional(),
})

export async function createAmenity(input: {
  name: string
  category?: string
}): Promise<ActionResult> {
  const parsed = amenitySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  return run(async () => {
    await prisma.amenity.create({
      data: { name: parsed.data.name, category: parsed.data.category || null },
    })
  })
}

export async function updateAmenity(
  id: string,
  input: { name: string; category?: string },
): Promise<ActionResult> {
  const parsed = amenitySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  return run(async () => {
    await prisma.amenity.update({
      where: { id },
      data: { name: parsed.data.name, category: parsed.data.category || null },
    })
  })
}

// Deleting an amenity removes it from every room via the implicit join table.
export async function deleteAmenity(id: string): Promise<ActionResult> {
  return run(async () => {
    await prisma.amenity.delete({ where: { id } })
  })
}

/* -------------------------------------------------------------------------- */
/*  Room <-> Amenity assignment                                                 */
/* -------------------------------------------------------------------------- */

export async function setRoomAmenities(
  roomId: string,
  amenityIds: string[],
): Promise<ActionResult> {
  return run(async () => {
    await prisma.room.update({
      where: { id: roomId },
      data: { amenities: { set: amenityIds.map((id) => ({ id })) } },
    })
  })
}

/* -------------------------------------------------------------------------- */
/*  Room images                                                                 */
/* -------------------------------------------------------------------------- */

const addRoomImageSchema = z.object({
  roomId: z.string().min(1, "Room id is required"),
  url: imageUrlSchema,
  key: z.string().min(1).optional(),
})

export async function addRoomImage(
  roomId: string,
  url: string,
  key?: string,
): Promise<ActionResult> {
  const parsed = addRoomImageSchema.safeParse({ roomId, url, key })
  if (!parsed.success) {
    await cleanupOrphanedUpload(key)
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const result = await run(async () => {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Room" WHERE id = ${parsed.data.roomId} FOR UPDATE
      `
      if (locked.length === 0) {
        throw new Error("Room not found")
      }

      const count = await tx.roomImage.count({
        where: { roomId: parsed.data.roomId },
      })
      if (count >= 5) {
        throw new Error("Maximum of 5 images per room type")
      }

      await tx.roomImage.create({
        data: {
          roomId: parsed.data.roomId,
          url: parsed.data.url,
          key: parsed.data.key ?? null,
          sortOrder: count,
        },
      })
    })
  })
  if (!result.ok) await cleanupOrphanedUpload(parsed.data.key)
  return result
}

export async function deleteRoomImage(imageId: string): Promise<ActionResult> {
  return run(async () => {
    const image = await prisma.roomImage.delete({ where: { id: imageId } })
    // Best-effort removal from UploadThing storage.
    if (image.key && process.env.UPLOADTHING_TOKEN) {
      try {
        await new UTApi().deleteFiles(image.key)
      } catch (e) {
        console.error("Failed to delete file from UploadThing:", e)
      }
    }
  })
}

const addSubcategoryImageSchema = z.object({
  subcategoryId: z.string().min(1, "Subcategory id is required"),
  url: imageUrlSchema,
  key: z.string().min(1).optional(),
})

export async function addSubcategoryImage(
  subcategoryId: string,
  url: string,
  key?: string,
): Promise<ActionResult> {
  const parsed = addSubcategoryImageSchema.safeParse({ subcategoryId, url, key })
  if (!parsed.success) {
    await cleanupOrphanedUpload(key)
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const result = await run(async () => {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "RoomSubcategory" WHERE id = ${parsed.data.subcategoryId} FOR UPDATE
      `
      if (locked.length === 0) {
        throw new Error("Subcategory not found")
      }

      const count = await tx.subcategoryImage.count({
        where: { subcategoryId: parsed.data.subcategoryId },
      })
      if (count >= 5) {
        throw new Error("Maximum of 5 images per subcategory")
      }

      await tx.subcategoryImage.create({
        data: {
          subcategoryId: parsed.data.subcategoryId,
          url: parsed.data.url,
          key: parsed.data.key ?? null,
          sortOrder: count,
        },
      })
    })
  })
  if (!result.ok) await cleanupOrphanedUpload(parsed.data.key)
  return result
}

const deleteSubcategoryImageSchema = z.string().min(1, "Image id is required")

export async function deleteSubcategoryImage(
  imageId: string,
): Promise<ActionResult> {
  const parsed = deleteSubcategoryImageSchema.safeParse(imageId)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  return run(async () => {
    let deletedKey: string | null = null

    await prisma.$transaction(async (tx) => {
      const image = await tx.subcategoryImage.findUnique({
        where: { id: parsed.data },
      })
      if (!image) {
        throw new Error("Image not found")
      }

      await tx.$queryRaw`
        SELECT id FROM "RoomSubcategory" WHERE id = ${image.subcategoryId} FOR UPDATE
      `

      await tx.subcategoryImage.delete({ where: { id: parsed.data } })
      deletedKey = image.key

      const remaining = await tx.subcategoryImage.findMany({
        where: { subcategoryId: image.subcategoryId },
        orderBy: { sortOrder: "asc" },
      })
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].sortOrder !== i) {
          await tx.subcategoryImage.update({
            where: { id: remaining[i].id },
            data: { sortOrder: i },
          })
        }
      }
    })

    // Best-effort removal from UploadThing storage.
    if (deletedKey && process.env.UPLOADTHING_TOKEN) {
      try {
        await new UTApi().deleteFiles(deletedKey)
      } catch (e) {
        console.error("Failed to delete file from UploadThing:", e)
      }
    }
  })
}

/* -------------------------------------------------------------------------- */
/*  Blackout dates                                                              */
/* -------------------------------------------------------------------------- */

const blackoutSchema = z
  .object({
    roomId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().trim().optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })

export async function addBlackout(input: {
  roomId: string
  startDate: string | Date
  endDate: string | Date
  reason?: string
}): Promise<ActionResult> {
  const parsed = blackoutSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  return run(async () => {
    await prisma.roomBlackout.create({
      data: {
        roomId: parsed.data.roomId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        reason: parsed.data.reason || null,
      },
    })
  })
}

export async function deleteBlackout(id: string): Promise<ActionResult> {
  return run(async () => {
    await prisma.roomBlackout.delete({ where: { id } })
  })
}

/* -------------------------------------------------------------------------- */
/*  Featured flag (per subcategory)                                             */
/* -------------------------------------------------------------------------- */

export async function setSubcategoryFeatured(
  subcategoryId: string,
  featured: boolean,
): Promise<ActionResult> {
  return run(async () => {
    await prisma.roomSubcategory.update({
      where: { id: subcategoryId },
      data: { featured },
    })
  })
}

/* -------------------------------------------------------------------------- */
/*  Pricing                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateBasePrice(
  roomId: string,
  basePriceCents: number,
): Promise<ActionResult> {
  if (!Number.isFinite(basePriceCents) || basePriceCents < 0) {
    return { ok: false, error: "Price must be a positive number" }
  }
  return run(async () => {
    await prisma.room.update({
      where: { id: roomId },
      data: { basePrice: Math.round(basePriceCents) },
    })
    await recomputeSubcategoryPricingForRoom(roomId)
  })
}

// Upsert a weekday price override. Pass price = null to clear it (fall back to
// the room's base price for that day).
export async function setPriceRule(
  roomId: string,
  dayOfWeek: number,
  priceCents: number | null,
): Promise<ActionResult> {
  if (dayOfWeek < 0 || dayOfWeek > 6) {
    return { ok: false, error: "Invalid day of week" }
  }
  return run(async () => {
    if (priceCents === null) {
      await prisma.roomPriceRule.deleteMany({ where: { roomId, dayOfWeek } })
    } else {
      await prisma.roomPriceRule.upsert({
        where: { roomId_dayOfWeek: { roomId, dayOfWeek } },
        create: { roomId, dayOfWeek, price: Math.round(priceCents) },
        update: { price: Math.round(priceCents) },
      })
    }
    await recomputeSubcategoryPricingForRoom(roomId)
  })
}

/* -------------------------------------------------------------------------- */
/*  Room types                                                                */
/* -------------------------------------------------------------------------- */

const roomTypeSlugSchema = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters")
  .regex(
    /^[a-z0-9-]+$/,
    "Slug must be lowercase letters, numbers, and hyphens only",
  )

const roomTypeSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  slug: roomTypeSlugSchema,
  description: z.string().trim().min(10, "Description must be at least 10 characters"),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
  beds: z.coerce.number().int().min(1, "Beds must be at least 1"),
  basePriceCents: z.coerce
    .number()
    .int()
    .min(0, "Price must be non-negative"),
})

async function nextCatalogRoomNumber(
  db: PrismaTransactionClient | typeof prisma = prisma,
): Promise<string> {
  // Include archived rooms so their numbers aren't handed out to new units.
  const taken = new Set(
    (await db.room.findMany({ select: { roomNumber: true } })).map(
      (r) => r.roomNumber,
    ),
  )

  for (let n = 900; n <= 999; n++) {
    const candidate = String(n)
    if (!taken.has(candidate)) return candidate
  }

  const [slot] = suggestNextRoomNumbers(1, taken)
  if (!slot) throw new Error("No available room numbers for catalog room")
  return slot.roomNumber
}

export async function createRoomType(input: {
  name: string
  slug: string
  description: string
  capacity: number
  beds: number
  basePriceCents: number
}): Promise<ActionResult> {
  const parsed = roomTypeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  return run(async () => {
    await prisma.$transaction(async (tx) => {
      const maxSort = await tx.roomTypeDefinition.aggregate({
        _max: { sortOrder: true },
      })
      const sortOrder = (maxSort._max.sortOrder ?? -1) + 1

      const type = await tx.roomTypeDefinition.create({
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          description: parsed.data.description,
          capacity: parsed.data.capacity,
          beds: parsed.data.beds,
          basePrice: parsed.data.basePriceCents,
          sortOrder,
        },
      })

      const roomNumber = await nextCatalogRoomNumber(tx)
      const floor = Number.parseInt(roomNumber.slice(0, -2), 10)

      await tx.room.create({
        data: {
          name: type.name,
          slug: type.slug,
          description: type.description,
          roomTypeId: type.id,
          basePrice: type.basePrice,
          capacity: type.capacity,
          beds: type.beds,
          floor,
          roomNumber,
          isCatalog: true,
          priceRules: {
            create: [
              { dayOfWeek: 5, price: Math.round(type.basePrice * 1.25) },
              { dayOfWeek: 6, price: Math.round(type.basePrice * 1.25) },
            ],
          },
        },
      })
    })
  })
}

export async function updateRoomType(
  id: string,
  input: {
    name: string
    slug: string
    description: string
    capacity: number
    beds: number
    basePriceCents: number
  },
): Promise<ActionResult> {
  const parsed = roomTypeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  return run(async () => {
    await prisma.$transaction(async (tx) => {
      const type = await tx.roomTypeDefinition.update({
        where: { id },
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          description: parsed.data.description,
          capacity: parsed.data.capacity,
          beds: parsed.data.beds,
          basePrice: parsed.data.basePriceCents,
        },
      })

      const catalog = await tx.room.findFirst({
        where: { roomTypeId: id, isCatalog: true, archivedAt: null },
      })
      if (catalog) {
        await tx.room.update({
          where: { id: catalog.id },
          data: {
            name: type.name,
            slug: type.slug,
            description: type.description,
            basePrice: type.basePrice,
            capacity: type.capacity,
            beds: type.beds,
          },
        })
      }
    })
  })
}

export async function archiveRoomTypeAction(
  roomTypeId: string,
): Promise<ActionResult> {
  return run(async () => {
    await archiveRoomType(roomTypeId)
  })
}

export async function restoreRoomTypeAction(
  roomTypeId: string,
): Promise<ActionResult> {
  return run(async () => {
    await restoreRoomType(roomTypeId)
  })
}

/* -------------------------------------------------------------------------- */
/*  Inventory                                                                 */
/* -------------------------------------------------------------------------- */

export async function syncTypeQuantityAction(
  roomTypeId: string,
  quantity: number,
): Promise<ActionResult> {
  return run(async () => {
    await prisma.$transaction(async (tx) => {
      await syncTypeQuantity(roomTypeId, quantity, tx)
      await recomputeAllSubcategoryPricing(tx)
    })
  })
}

export async function updateRoomInventoryAction(
  roomId: string,
  input: {
    floor?: number
    roomNumber?: string
    roomTypeId?: string
    subcategoryId?: string | null
  },
): Promise<ActionResult> {
  return run(async () => {
    await updateRoomInventory(roomId, input)
  })
}

export async function archiveRoomAction(roomId: string): Promise<ActionResult> {
  return run(async () => {
    await archiveRoom(roomId)
  })
}

export async function restoreRoomAction(roomId: string): Promise<ActionResult> {
  return run(async () => {
    await restoreRoom(roomId)
  })
}

/* -------------------------------------------------------------------------- */
/*  Reservations                                                                */
/* -------------------------------------------------------------------------- */

export type BookingRow = {
  id: string
  checkIn: Date
  checkOut: Date
  guests: number
  totalPrice: number
  status: string
  stripeSessionId: string | null
  guestName: string | null
  guestEmail: string | null
  guestPhone: string | null
  specialRequests: string | null
  createdAt: Date
  room: {
    id: string
    name: string
    roomNumber: string | null
    roomType: { id: string; name: string; slug: string }
  }
  user: { name: string | null; email: string }
}

export async function getBookings(params: {
  page?: number
  pageSize?: number
  roomId?: string
  status?: string
  search?: string
}): Promise<{ bookings: BookingRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = params.pageSize ?? 10

  const where: Record<string, unknown> = {}
  if (params.roomId) where.roomId = params.roomId
  if (params.status && params.status !== "ALL") where.status = params.status
  if (params.search) {
    const q = params.search.trim()
    where.OR = [
      { guestName: { contains: q, mode: "insensitive" } },
      { guestEmail: { contains: q, mode: "insensitive" } },
      { room: { name: { contains: q, mode: "insensitive" } } },
    ]
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        room: {
          select: {
            id: true,
            name: true,
            roomNumber: true,
            roomType: { select: { id: true, name: true, slug: true } },
          },
        },
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.booking.count({ where }),
  ])

  return { bookings, total }
}

const updateBookingSchema = z
  .object({
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date(),
    guests: z.coerce.number().int().min(1),
    status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]),
    guestName: z.string().trim().optional(),
    guestEmail: z.string().trim().email().optional().or(z.literal("")),
    guestPhone: z.string().trim().optional(),
    specialRequests: z.string().trim().optional(),
  })
  .refine((v) => v.checkOut > v.checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  })

export async function updateBooking(
  id: string,
  input: {
    checkIn: string | Date
    checkOut: string | Date
    guests: number
    status: string
    guestName?: string
    guestEmail?: string
    guestPhone?: string
    specialRequests?: string
  },
): Promise<ActionResult> {
  const parsed = updateBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  return run(async () => {
    const before = await prisma.booking.findUniqueOrThrow({
      where: { id },
      include: {
        room: {
          select: { id: true, name: true, priceRules: true, basePrice: true },
        },
      },
    })

    const checkIn = parsed.data.checkIn
    const checkOut = parsed.data.checkOut
    const nights = differenceInCalendarDays(checkOut, checkIn)
    const quote = quoteRange(
      before.room.basePrice,
      before.room.priceRules,
      checkIn,
      checkOut,
    )

    const after = await prisma.booking.update({
      where: { id },
      data: {
        checkIn,
        checkOut,
        guests: parsed.data.guests,
        status: parsed.data.status,
        totalPrice: nights > 0 ? quote.total : before.totalPrice,
        guestName: parsed.data.guestName || before.guestName,
        guestEmail: parsed.data.guestEmail || before.guestEmail,
        guestPhone: parsed.data.guestPhone ?? before.guestPhone,
        specialRequests: parsed.data.specialRequests ?? before.specialRequests,
      },
    })

    const mail = adminBookingModifiedEmail({
      before,
      after,
      roomName: before.room.name,
    })
    Promise.resolve(sendMail({ to: ADMIN_EMAIL, ...mail })).catch((e) =>
      console.error("Email failed:", e),
    )
  })
}

export async function deleteBooking(id: string): Promise<ActionResult> {
  return run(async () => {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id },
      include: { room: { select: { id: true, name: true } } },
    })

    await prisma.booking.delete({ where: { id } })

    const mail = adminBookingDeletedEmail({
      booking,
      roomName: booking.room.name,
    })
    Promise.resolve(sendMail({ to: ADMIN_EMAIL, ...mail })).catch((e) =>
      console.error("Email failed:", e),
    )
  })
}

export async function createRoomSubcategory(
  roomTypeId: string,
  name: string,
  basePriceCents: number,
): Promise<ActionResult> {
  return run(async () => {
    const schema = z.object({
      roomTypeId: z.string().min(1, "Room type is required"),
      name: z.string().trim().min(1, "Name is required"),
      basePrice: z.number().int().min(0, "Price must be non-negative"),
    })

    const parsed = schema.safeParse({
      roomTypeId,
      name,
      basePrice: basePriceCents,
    })
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((e) => e.message).join("; "))
    }

    await prisma.$transaction(async (tx) => {
      const type = await tx.roomTypeDefinition.findFirst({
        where: { id: parsed.data.roomTypeId, isActive: true },
        select: { id: true },
      })
      if (!type) throw new Error("Room type not found")

      await tx.roomSubcategory.create({
        data: {
          roomTypeId: parsed.data.roomTypeId,
          name: parsed.data.name,
          basePrice: parsed.data.basePrice,
          fromPriceCents: parsed.data.basePrice,
        },
      })
    })
  })
}

export async function updateRoomSubcategory(
  id: string,
  name: string,
  basePriceCents: number,
): Promise<ActionResult> {
  return run(async () => {
    const schema = z.object({
      name: z.string().min(1, "Name is required"),
      basePrice: z.number().int().min(0, "Price must be non-negative"),
    })

    const parsed = schema.safeParse({ name, basePrice: basePriceCents })
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((e) => e.message).join("; "))
    }

    await prisma.$transaction(async (tx) => {
      await tx.roomSubcategory.update({
        where: { id },
        data: parsed.data,
      })
      await syncInventoryBasesToSubcategory(id, tx)
      await recomputeSubcategoryPricing(id, tx)
    })
  })
}

export async function archiveRoomSubcategory(
  id: string,
): Promise<ActionResult> {
  return run(async () => {
    await archiveSubcategory(id)
  })
}

export async function restoreRoomSubcategory(
  id: string,
): Promise<ActionResult> {
  return run(async () => {
    await restoreSubcategory(id)
  })
}

/** @deprecated Use archiveRoomSubcategory — archives instead of deleting. */
export async function deleteRoomSubcategory(id: string): Promise<ActionResult> {
  return archiveRoomSubcategory(id)
}

export async function assignRoomToSubcategory(
  roomId: string,
  subcategoryId: string | null,
): Promise<ActionResult> {
  return run(async () => {
    const before = await prisma.room.findUnique({
      where: { id: roomId },
      select: { subcategoryId: true },
    })

    await prisma.room.update({
      where: { id: roomId },
      data: { subcategoryId },
    })

    if (before?.subcategoryId) {
      await recomputeSubcategoryPricing(before.subcategoryId)
    }
    if (subcategoryId) {
      await recomputeSubcategoryPricing(subcategoryId)
    }
  })
}

export async function assignRoomsToSubcategoryBulk(
  roomIds: string[],
  subcategoryId: string | null,
): Promise<ActionResult> {
  return run(async () => {
    const before = await prisma.room.findMany({
      where: { id: { in: roomIds } },
      select: { subcategoryId: true },
    })

    await prisma.room.updateMany({
      where: { id: { in: roomIds } },
      data: { subcategoryId },
    })

    const affected = new Set<string>()
    for (const room of before) {
      if (room.subcategoryId) affected.add(room.subcategoryId)
    }
    if (subcategoryId) affected.add(subcategoryId)
    for (const id of affected) {
      await recomputeSubcategoryPricing(id)
    }
  })
}
