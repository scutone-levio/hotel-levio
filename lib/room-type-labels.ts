/** Client-safe room type display helpers (no Prisma). */

export type RoomTypeLabelInput = {
  name: string
  beds: number
  slug: string
}

export const LEGACY_TYPE_SLUGS = ["twin", "queen", "king", "suite"] as const

export function roomTypeLabel(type: Pick<RoomTypeLabelInput, "name" | "beds">): string {
  const bedLabel = type.beds === 1 ? "1 bed" : `${type.beds} beds`
  return `${type.name} (${bedLabel})`
}

export function roomTypeShortLabel(type: Pick<RoomTypeLabelInput, "name">): string {
  return type.name
}

export function roomTypeTabLabel(type: Pick<RoomTypeLabelInput, "slug" | "name">): string {
  if (LEGACY_TYPE_SLUGS.includes(type.slug as (typeof LEGACY_TYPE_SLUGS)[number])) {
    return type.slug.charAt(0).toUpperCase() + type.slug.slice(1)
  }
  return type.name
}
