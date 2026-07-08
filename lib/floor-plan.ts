import type { RoomType } from "@prisma/client"

export type FloorSlot = {
  floor: number
  roomNumber: string
  type: RoomType
}

/** First room number per type used as the public catalog representative. */
export const CATALOG_ROOM_NUMBERS: Record<RoomType, string> = {
  TWIN: "101",
  QUEEN: "108",
  KING: "110",
  SUITE: "401",
}

export const FLOOR_PREFERENCES: Record<RoomType, number[]> = {
  TWIN: [1, 2, 3, 6],
  QUEEN: [2, 3, 1, 6],
  KING: [6, 4, 3, 2, 1],
  SUITE: [5, 4],
}

const SLOT_TYPES: Record<number, RoomType[]> = {
  1: ["TWIN", "TWIN", "TWIN", "TWIN", "TWIN", "TWIN", "TWIN", "QUEEN", "QUEEN", "KING"],
  2: ["TWIN", "TWIN", "TWIN", "TWIN", "TWIN", "TWIN", "QUEEN", "QUEEN", "QUEEN", "KING"],
  3: ["TWIN", "TWIN", "TWIN", "TWIN", "QUEEN", "QUEEN", "QUEEN", "QUEEN", "KING", "KING"],
  4: ["SUITE", "SUITE", "SUITE", "SUITE", "KING", "KING", "KING", "KING", "KING", "KING"],
  5: ["SUITE", "SUITE", "SUITE", "SUITE", "SUITE", "SUITE", "SUITE", "SUITE", "SUITE", "SUITE"],
  6: ["TWIN", "TWIN", "TWIN", "QUEEN", "KING", "KING", "KING", "KING", "KING", "KING"],
}

function buildDefaultFloorPlan(): FloorSlot[] {
  const slots: FloorSlot[] = []
  for (const [floorStr, types] of Object.entries(SLOT_TYPES)) {
    const floor = Number(floorStr)
    types.forEach((type, index) => {
      const unit = index + 1
      slots.push({
        floor,
        roomNumber: `${floor}${String(unit).padStart(2, "0")}`,
        type,
      })
    })
  }
  return slots
}

export const DEFAULT_FLOOR_PLAN = buildDefaultFloorPlan()

export const TYPE_TOTALS: Record<RoomType, number> = {
  TWIN: DEFAULT_FLOOR_PLAN.filter((s) => s.type === "TWIN").length,
  QUEEN: DEFAULT_FLOOR_PLAN.filter((s) => s.type === "QUEEN").length,
  KING: DEFAULT_FLOOR_PLAN.filter((s) => s.type === "KING").length,
  SUITE: DEFAULT_FLOOR_PLAN.filter((s) => s.type === "SUITE").length,
}

export function parseRoomNumber(roomNumber: string): { floor: number; unit: number } {
  const floor = Number.parseInt(roomNumber.slice(0, -2), 10)
  const unit = Number.parseInt(roomNumber.slice(-2), 10)
  return { floor, unit }
}

/** Trim and normalize a room number for storage and comparison. */
export function normalizeRoomNumber(value: string): string {
  return value.trim()
}

export function validateRoomNumber(value: string): string | null {
  const roomNumber = normalizeRoomNumber(value)
  if (!roomNumber) return "Room number is required"
  return null
}

export function validateRoomAssignment(type: RoomType, floor: number): string | null {
  if (type === "SUITE" && floor !== 4 && floor !== 5) {
    return "Suites may only be assigned to floors 4 or 5"
  }
  return null
}

export function catalogSlug(type: RoomType): string {
  return type.toLowerCase()
}

export function isCatalogRoomNumber(type: RoomType, roomNumber: string): boolean {
  return CATALOG_ROOM_NUMBERS[type] === roomNumber
}

/** Slots from the default plan for a given type, in preferred floor order. */
export function slotsForType(type: RoomType): FloorSlot[] {
  const prefs = FLOOR_PREFERENCES[type]
  const slots = DEFAULT_FLOOR_PLAN.filter((s) => s.type === type)
  return [...slots].sort((a, b) => {
    const ai = prefs.indexOf(a.floor)
    const bi = prefs.indexOf(b.floor)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.roomNumber.localeCompare(b.roomNumber)
  })
}

export function suggestSlotsForType(
  type: RoomType,
  quantity: number,
  takenRoomNumbers: Set<string>,
): FloorSlot[] {
  return slotsForType(type)
    .filter((s) => !takenRoomNumbers.has(s.roomNumber))
    .slice(0, quantity)
}

/** Summarize room numbers into ranges for display, e.g. "101–107, 201–206". */
export function summarizeRoomNumbers(numbers: string[]): string {
  if (!numbers.length) return "—"
  const sorted = [...numbers].sort((a, b) => Number(a) - Number(b))
  const ranges: string[] = []
  let start = sorted[0]
  let prev = sorted[0]

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i]
    if (current && Number(current) === Number(prev) + 1) {
      prev = current
      continue
    }
    ranges.push(start === prev ? start : `${start}–${prev}`)
    start = current
    prev = current
  }

  return ranges.join(", ")
}
