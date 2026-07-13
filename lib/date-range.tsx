"use client"

import * as React from "react"
import type { DateRange } from "react-day-picker"

const STORAGE_KEY = "hotellevio_date_range"

export const MIN_GUESTS = 1
export const MAX_GUESTS = 4

export function parseStoredDateRange(
  checkIn: string | null,
  checkOut: string | null,
): DateRange | undefined {
  if (!checkIn || !checkOut) return undefined

  const from = new Date(checkIn)
  const to = new Date(checkOut)
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return undefined

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (from < today) return undefined

  return { from, to }
}

function readStored(): { range: DateRange | undefined; guests: number } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { range: undefined, guests: MIN_GUESTS }

    const { checkIn, checkOut, guests } = JSON.parse(raw) as {
      checkIn?: string
      checkOut?: string
      guests?: number
    }
    const range = parseStoredDateRange(checkIn ?? null, checkOut ?? null)
    const parsedGuests =
      typeof guests === "number" &&
      guests >= MIN_GUESTS &&
      guests <= MAX_GUESTS
        ? guests
        : MIN_GUESTS
    return { range, guests: parsedGuests }
  } catch {
    return { range: undefined, guests: MIN_GUESTS }
  }
}

function persistStored(range: DateRange | undefined, guests: number) {
  try {
    if (range?.from && range?.to) {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          checkIn: range.from.toISOString(),
          checkOut: range.to.toISOString(),
          guests,
        }),
      )
    } else {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ guests }),
      )
    }
  } catch {}
}

type DateRangeCtx = {
  dateRange: DateRange | undefined
  setDateRange: (range: DateRange | undefined) => void
  clearDateRange: () => void
  isHydrated: boolean
  guests: number
  setGuests: (n: number) => void
}

const DateRangeContext = React.createContext<DateRangeCtx>({
  dateRange: undefined,
  setDateRange: () => {},
  clearDateRange: () => {},
  isHydrated: false,
  guests: MIN_GUESTS,
  setGuests: () => {},
})

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [dateRange, setDateRangeState] = React.useState<DateRange | undefined>()
  const [guests, setGuestsState] = React.useState(MIN_GUESTS)
  const [isHydrated, setIsHydrated] = React.useState(false)

  React.useEffect(() => {
    const stored = readStored()
    setDateRangeState(stored.range)
    setGuestsState(stored.guests)
    setIsHydrated(true)
  }, [])

  const setDateRange = React.useCallback(
    (range: DateRange | undefined) => {
      setDateRangeState(range)
      persistStored(range, guests)
    },
    [guests],
  )

  const setGuests = React.useCallback(
    (n: number) => {
      const clamped = Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, n))
      setGuestsState(clamped)
      persistStored(dateRange, clamped)
    },
    [dateRange],
  )

  const clearDateRange = React.useCallback(() => {
    setDateRangeState(undefined)
    persistStored(undefined, guests)
  }, [guests])

  const value = React.useMemo(
    () => ({ dateRange, setDateRange, clearDateRange, isHydrated, guests, setGuests }),
    [dateRange, setDateRange, clearDateRange, isHydrated, guests, setGuests],
  )

  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  return React.useContext(DateRangeContext)
}
