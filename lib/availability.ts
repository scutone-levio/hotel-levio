import { startOfDay } from "date-fns"

export type BlackoutLike = { startDate: Date | string; endDate: Date | string }

/** Normalize to a local start-of-day Date. */
function day(d: Date | string): Date {
  return startOfDay(typeof d === "string" ? new Date(d) : d)
}

/**
 * A stay occupies the nights [from, to) — i.e. check-out day is free again.
 * A blackout blocks the inclusive range [startDate, endDate].
 * They conflict when the stay covers any blacked-out night.
 */
export function isRangeAvailable(
  blackouts: BlackoutLike[],
  from: Date,
  to: Date,
): boolean {
  const f = day(from)
  const t = day(to)
  return !blackouts.some((b) => {
    const bs = day(b.startDate)
    const be = day(b.endDate)
    // overlap of [f, t) with [bs, be]  ->  f <= be && t > bs
    return f.getTime() <= be.getTime() && t.getTime() > bs.getTime()
  })
}

/**
 * Convert blackout ranges into react-day-picker `DateRange` matchers so the
 * calendar can disable them.
 */
export function blackoutMatchers(
  blackouts: BlackoutLike[],
): { from: Date; to: Date }[] {
  return blackouts.map((b) => ({ from: day(b.startDate), to: day(b.endDate) }))
}
