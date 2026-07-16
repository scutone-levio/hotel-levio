/** First room number per legacy type slug used as the public catalog representative. */
export const CATALOG_ROOM_NUMBERS: Record<string, string> = {
  twin: "101",
  queen: "108",
  king: "110",
  suite: "401",
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

export function isCatalogRoomNumber(slug: string, roomNumber: string): boolean {
  return CATALOG_ROOM_NUMBERS[slug] === roomNumber
}

/** Suggest the next available room numbers (floors 1–9, units 01–99). */
export function suggestNextRoomNumbers(
  count: number,
  takenRoomNumbers: Set<string>,
): { floor: number; roomNumber: string }[] {
  const slots: { floor: number; roomNumber: string }[] = []
  for (let floor = 1; floor <= 9 && slots.length < count; floor++) {
    for (let unit = 1; unit <= 99 && slots.length < count; unit++) {
      const roomNumber = `${floor}${String(unit).padStart(2, "0")}`
      if (!takenRoomNumbers.has(roomNumber)) {
        slots.push({ floor, roomNumber })
      }
    }
  }
  return slots
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
