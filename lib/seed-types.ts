import { coverImageForType } from "./room-type-images"

export const SEED_TYPE_IDS = {
  twin: "rtdef_seed_twin",
  queen: "rtdef_seed_queen",
  king: "rtdef_seed_king",
  suite: "rtdef_seed_suite",
} as const

export type SeedTypeSlug = keyof typeof SEED_TYPE_IDS

export const SEED_TYPE_SLUGS: SeedTypeSlug[] = ["twin", "queen", "king", "suite"]

const SLOT_TYPES: Record<number, SeedTypeSlug[]> = {
  1: ["twin", "twin", "twin", "twin", "twin", "twin", "twin", "queen", "queen", "king"],
  2: ["twin", "twin", "twin", "twin", "twin", "twin", "queen", "queen", "queen", "king"],
  3: ["twin", "twin", "twin", "twin", "queen", "queen", "queen", "queen", "king", "king"],
  4: ["suite", "suite", "suite", "suite", "king", "king", "king", "king", "king", "king"],
  5: ["suite", "suite", "suite", "suite", "suite", "suite", "suite", "suite", "suite", "suite"],
  6: ["twin", "twin", "twin", "queen", "king", "king", "king", "king", "king", "king"],
}

export type SeedFloorSlot = {
  floor: number
  roomNumber: string
  slug: SeedTypeSlug
  roomTypeId: string
}

export function buildSeedFloorPlan(): SeedFloorSlot[] {
  const slots: SeedFloorSlot[] = []
  for (const [floorStr, types] of Object.entries(SLOT_TYPES)) {
    const floor = Number(floorStr)
    types.forEach((slug, index) => {
      const unit = index + 1
      slots.push({
        floor,
        roomNumber: `${floor}${String(unit).padStart(2, "0")}`,
        slug,
        roomTypeId: SEED_TYPE_IDS[slug],
      })
    })
  }
  return slots
}

export const roomTypeMeta: Record<
  SeedTypeSlug,
  {
    label: string
    description: string
    basePrice: number
    capacity: number
    beds: number
    image: string
  }
> = {
  twin: {
    label: "Twin Room",
    description:
      "A comfortable room with two single beds — ideal for friends or colleagues travelling together.",
    basePrice: 12900,
    capacity: 2,
    beds: 2,
    image: coverImageForType("twin"),
  },
  queen: {
    label: "Queen Room",
    description:
      "A spacious room with two queen beds, comfortably sleeping up to four guests.",
    basePrice: 18900,
    capacity: 4,
    beds: 2,
    image: coverImageForType("queen"),
  },
  king: {
    label: "King Room",
    description:
      "An elegant room anchored by a plush king bed and a luxury walk-in shower.",
    basePrice: 22900,
    capacity: 2,
    beds: 1,
    image: coverImageForType("king"),
  },
  suite: {
    label: "Suite",
    description:
      "A two-bedroom suite with two king beds, a separate living area, and a whirlpool bath.",
    basePrice: 39900,
    capacity: 4,
    beds: 2,
    image: coverImageForType("suite"),
  },
}

export const amenitiesByType: Record<SeedTypeSlug, string[]> = {
  twin: [
    "Two single mattresses",
    "Free high-speed Wi-Fi",
    "Flat-screen television",
    "Writing desk with chair",
    "Mini-refrigerator",
    "In-room coffee maker",
    "Electronic laptop safe",
    "Private en-suite bathroom",
    "Complimentary basic toiletries",
    "Individual climate control",
  ],
  queen: [
    "Two queen mattresses",
    "Free high-speed Wi-Fi",
    "Large flat-screen television",
    "Work desk with ergonomic chair",
    "Mini-refrigerator",
    "Microwave",
    "Premium coffee station",
    "Iron and ironing board",
    "Spacious full bathroom",
    "Hairdryer and toiletries",
  ],
  king: [
    "One king mattress",
    "Free high-speed Wi-Fi",
    "Smart flat-screen television",
    "Sofa bed or armchair",
    "Executive work desk",
    "Mini-refrigerator",
    "Nespresso coffee machine",
    "Bathrobes and slippers",
    "Luxury walk-in shower",
    "Electronic safe",
  ],
  suite: [
    "Two king mattresses",
    "Separate living area",
    "Multiple smart televisions",
    "Free premium Wi-Fi",
    "Wet bar and kitchenette",
    "Full-sized refrigerator",
    "Dining table and chairs",
    "Luxury bathrobes and slippers",
    "Master bathroom with soaking tub",
    "Powder room for guests",
  ],
}

export const nearbyPlacesByType: Record<
  SeedTypeSlug,
  { name: string; category: string; distance: string }[]
> = {
  twin: [
    { name: "Old Port Montréal", category: "attraction", distance: "5 min walk" },
    { name: "Brasserie Levio", category: "restaurant", distance: "On-site" },
    { name: "STM Champ-de-Mars", category: "transport", distance: "3 min walk" },
    { name: "Marché Bonsecours", category: "attraction", distance: "8 min walk" },
  ],
  queen: [
    { name: "Old Port Montréal", category: "attraction", distance: "5 min walk" },
    { name: "Brasserie Levio", category: "restaurant", distance: "On-site" },
    { name: "STM Champ-de-Mars", category: "transport", distance: "3 min walk" },
    { name: "Marché Bonsecours", category: "attraction", distance: "8 min walk" },
    { name: "L'Avenue Bistro", category: "restaurant", distance: "2 min walk" },
  ],
  king: [
    { name: "Old Port Montréal", category: "attraction", distance: "5 min walk" },
    { name: "Brasserie Levio", category: "restaurant", distance: "On-site" },
    { name: "STM Champ-de-Mars", category: "transport", distance: "3 min walk" },
    { name: "Spa & Fitness Centre", category: "wellness", distance: "Floor 2" },
    { name: "Marché Bonsecours", category: "attraction", distance: "8 min walk" },
  ],
  suite: [
    { name: "Old Port Montréal", category: "attraction", distance: "5 min walk" },
    { name: "Brasserie Levio", category: "restaurant", distance: "On-site" },
    { name: "STM Champ-de-Mars", category: "transport", distance: "3 min walk" },
    { name: "Spa & Fitness Centre", category: "wellness", distance: "Floor 2" },
    { name: "Rooftop Lounge", category: "bar", distance: "Floor 12" },
    { name: "Marché Bonsecours", category: "attraction", distance: "8 min walk" },
  ],
}
