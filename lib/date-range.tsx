"use client"

import * as React from "react"
import type { DateRange } from "react-day-picker"

const STORAGE_KEY = "hotellevio_date_range"

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

function readStoredDateRange(): DateRange | undefined {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined

    const { checkIn, checkOut } = JSON.parse(raw) as {
      checkIn?: string
      checkOut?: string
    }
    return parseStoredDateRange(checkIn ?? null, checkOut ?? null)
  } catch {
    return undefined
  }
}

function persistDateRange(range: DateRange | undefined) {
  try {
    if (range?.from && range?.to) {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          checkIn: range.from.toISOString(),
          checkOut: range.to.toISOString(),
        }),
      )
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {}
}

type DateRangeCtx = {
  dateRange: DateRange | undefined
  setDateRange: (range: DateRange | undefined) => void
  clearDateRange: () => void
  isHydrated: boolean
}

const DateRangeContext = React.createContext<DateRangeCtx>({
  dateRange: undefined,
  setDateRange: () => {},
  clearDateRange: () => {},
  isHydrated: false,
})

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [dateRange, setDateRangeState] = React.useState<DateRange | undefined>()
  const [isHydrated, setIsHydrated] = React.useState(false)

  React.useEffect(() => {
    setDateRangeState(readStoredDateRange())
    setIsHydrated(true)
  }, [])

  function setDateRange(range: DateRange | undefined) {
    setDateRangeState(range)
    persistDateRange(range)
  }

  function clearDateRange() {
    setDateRange(undefined)
  }

  return (
    <DateRangeContext.Provider
      value={{ dateRange, setDateRange, clearDateRange, isHydrated }}
    >
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  return React.useContext(DateRangeContext)
}
