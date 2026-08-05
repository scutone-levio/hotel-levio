import { z } from "zod"

export const searchRoomTypesInputSchema = z.object({
  minCapacity: z.number().int().positive().optional(),
  roomTypeSlug: z.string().min(1).optional(),
})

export const stayRequestInputSchema = z.object({
  roomId: z.string().min(1),
  subcategoryId: z.string().min(1).optional(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  guests: z.number().int().positive(),
})

export const conciergeCartPayloadSchema = z.object({
  roomId: z.string(),
  roomName: z.string(),
  imageUrl: z.string().nullable(),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number().int().positive(),
  nights: z.number().int().positive(),
  totalPrice: z.number().int().nonnegative(),
  subcategoryId: z.string().optional(),
  totalPriceDisplay: z.string(),
})

export type ConciergeCartPayload = z.infer<typeof conciergeCartPayloadSchema>

const weatherDateSchema = z.iso.date()

export const weatherInputSchema = z
  .object({
    start_date: weatherDateSchema.optional().describe("Stay start date as YYYY-MM-DD"),
    end_date: weatherDateSchema.optional().describe("Stay end date as YYYY-MM-DD"),
  })
  .refine(
    ({ start_date, end_date }) =>
      !start_date || !end_date || start_date <= end_date,
    {
      message: "end_date must be on or after start_date",
      path: ["end_date"],
    },
  )
