"use server"

import { revalidatePath } from "next/cache"
import { differenceInCalendarDays } from "date-fns"
import type { RoomType } from "@prisma/client"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { UTApi } from "uploadthing/server"

import { prisma } from "@/lib/prisma"
import { quoteRange } from "@/lib/pricing"
import { syncTypeQuantity, updateRoomInventory } from "@/lib/inventory"
import { sendMail } from "@/lib/mailer"
import {
  adminBookingModifiedEmail,
  adminBookingDeletedEmail,
} from "@/lib/email-templates"

const ADMIN_EMAIL = "sergio.cutone@levio.ca"

export type ActionResult = { ok: true } | { ok: false; error: string }

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
        return { ok: false, error: "That room number is already in use" }
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

export async function addRoomImage(
  roomId: string,
  url: string,
  key?: string,
): Promise<ActionResult> {
  const count = await prisma.roomImage.count({ where: { roomId } })
  if (count >= 5) {
    return { ok: false, error: "Maximum of 5 images per room type" }
  }
  return run(async () => {
    await prisma.roomImage.create({
      data: { roomId, url, key: key ?? null, sortOrder: count },
    })
  })
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
/*  Featured flag                                                               */
/* -------------------------------------------------------------------------- */

export async function setRoomFeatured(
  roomId: string,
  featured: boolean,
): Promise<ActionResult> {
  return run(async () => {
    await prisma.room.update({ where: { id: roomId }, data: { featured } })
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
      return
    }
    await prisma.roomPriceRule.upsert({
      where: { roomId_dayOfWeek: { roomId, dayOfWeek } },
      create: { roomId, dayOfWeek, price: Math.round(priceCents) },
      update: { price: Math.round(priceCents) },
    })
  })
}

/* -------------------------------------------------------------------------- */
/*  Inventory                                                                 */
/* -------------------------------------------------------------------------- */

export async function syncTypeQuantityAction(
  type: RoomType,
  quantity: number,
): Promise<ActionResult> {
  return run(async () => {
    await syncTypeQuantity(type, quantity)
  })
}

export async function updateRoomInventoryAction(
  roomId: string,
  input: { floor?: number; roomNumber?: string; type?: RoomType },
): Promise<ActionResult> {
  return run(async () => {
    await updateRoomInventory(roomId, input)
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
  room: { id: string; name: string; roomNumber: string | null; type: RoomType }
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
        room: { select: { id: true, name: true, roomNumber: true, type: true } },
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
      include: { room: { select: { id: true, name: true, priceRules: true, basePrice: true } } },
    })

    const checkIn = parsed.data.checkIn
    const checkOut = parsed.data.checkOut
    const nights = differenceInCalendarDays(checkOut, checkIn)
    const quote = quoteRange(before.room.basePrice, before.room.priceRules, checkIn, checkOut)

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

    const mail = adminBookingModifiedEmail({ before, after, roomName: before.room.name })
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

    const mail = adminBookingDeletedEmail({ booking, roomName: booking.room.name })
    Promise.resolve(sendMail({ to: ADMIN_EMAIL, ...mail })).catch((e) =>
      console.error("Email failed:", e),
    )
  })
}

export async function createRoomSubcategory(
  roomType: string,
  name: string,
  basePrice: number,
): Promise<ActionResult> {
  return run(async () => {
    const schema = z.object({
      roomType: z.enum(["TWIN", "QUEEN", "KING", "SUITE"]),
      name: z.string().min(1, "Name is required"),
      basePrice: z.number().int().min(0, "Price must be non-negative"),
    })

    const parsed = schema.safeParse({ roomType, name, basePrice })
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((e) => e.message).join("; "))
    }

    await prisma.roomSubcategory.create({
      data: parsed.data,
    })
  })
}

export async function updateRoomSubcategory(
  id: string,
  name: string,
  basePrice: number,
): Promise<ActionResult> {
  return run(async () => {
    const schema = z.object({
      name: z.string().min(1, "Name is required"),
      basePrice: z.number().int().min(0, "Price must be non-negative"),
    })

    const parsed = schema.safeParse({ name, basePrice })
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((e) => e.message).join("; "))
    }

    await prisma.roomSubcategory.update({
      where: { id },
      data: parsed.data,
    })
  })
}

export async function deleteRoomSubcategory(id: string): Promise<ActionResult> {
  return run(async () => {
    // Check if any rooms are using this subcategory
    const roomCount = await prisma.room.count({
      where: { subcategoryId: id },
    })

    if (roomCount > 0) {
      throw new Error(`Cannot delete: ${roomCount} room(s) are assigned to this subcategory`)
    }

    await prisma.roomSubcategory.delete({
      where: { id },
    })
  })
}

export async function assignRoomToSubcategory(
  roomId: string,
  subcategoryId: string | null,
): Promise<ActionResult> {
  return run(async () => {
    await prisma.room.update({
      where: { id: roomId },
      data: { subcategoryId },
    })
  })
}

export async function assignRoomsToSubcategoryBulk(
  roomIds: string[],
  subcategoryId: string | null,
): Promise<ActionResult> {
  return run(async () => {
    await prisma.room.updateMany({
      where: { id: { in: roomIds } },
      data: { subcategoryId },
    })
  })
}
