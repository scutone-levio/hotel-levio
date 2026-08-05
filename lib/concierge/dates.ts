import { startOfDay } from "date-fns"

export type ParsedStayDates =
  | { ok: true; checkIn: Date; checkOut: Date }
  | { ok: false; error: string }

export function parseStayDates(
  checkIn: string,
  checkOut: string,
): ParsedStayDates {
  const from = startOfDay(new Date(checkIn))
  const to = startOfDay(new Date(checkOut))
  const today = startOfDay(new Date())

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, error: "Invalid dates" }
  }
  if (to <= from) {
    return { ok: false, error: "Check-out must be after check-in" }
  }
  if (from < today) {
    return { ok: false, error: "Check-in cannot be in the past" }
  }

  return { ok: true, checkIn: from, checkOut: to }
}
