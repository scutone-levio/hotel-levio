import { addDays, differenceInCalendarDays } from "date-fns"

export type PriceRuleLike = { dayOfWeek: number; price: number }

/**
 * Price (in cents) for a single night starting on `date`.
 * A weekday rule (0=Sun..6=Sat) overrides the base price when present.
 */
export function priceForDate(
  basePrice: number,
  rules: PriceRuleLike[],
  date: Date,
): number {
  const rule = rules.find((r) => r.dayOfWeek === date.getDay())
  return rule ? rule.price : basePrice
}

export type Quote = {
  nights: number
  total: number // cents
  breakdown: { date: Date; price: number }[]
}

/**
 * Quote a stay from `from` (check-in) to `to` (check-out). The number of nights
 * is the number of calendar days between the two dates; check-out day is not
 * charged.
 */
export function quoteRange(
  basePrice: number,
  rules: PriceRuleLike[],
  from: Date,
  to: Date,
): Quote {
  const nights = Math.max(0, differenceInCalendarDays(to, from))
  const breakdown: { date: Date; price: number }[] = []
  let total = 0
  for (let i = 0; i < nights; i++) {
    const date = addDays(from, i)
    const price = priceForDate(basePrice, rules, date)
    breakdown.push({ date, price })
    total += price
  }
  return { nights, total, breakdown }
}
