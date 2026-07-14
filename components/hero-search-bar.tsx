"use client"

import * as React from "react"
import { CalendarIcon, Users } from "lucide-react"
import { differenceInCalendarDays, format } from "date-fns"
import type { DateRange } from "react-day-picker"

import { useDateRange, MIN_GUESTS, MAX_GUESTS } from "@/lib/date-range"
import { pluralize } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover"

// Themes the pill bar for the hero's navy gradient. The calendar popover
// is intentionally left in the app's default theme for legibility.
const heroTheme = {
  "--background": "#12324a",
  "--foreground": "#f3ecda",
  "--border": "rgba(198, 148, 86, 0.45)",
  "--muted": "rgba(198, 148, 86, 0.16)",
  "--muted-foreground": "#dcae70",
  "--ring": "#c69456",
} as React.CSSProperties

const DIVIDER_H = (
  <div className="block h-px bg-[#c69456]/20 sm:hidden" />
)
const DIVIDER_V = (
  <div className="hidden w-px self-stretch bg-[#c69456]/20 sm:block" />
)

export function HeroSearchBar() {
  const { dateRange, setDateRange, guests, setGuests } = useDateRange()
  const [open, setOpen] = React.useState(false)
  const [range, setRange] = React.useState<DateRange | undefined>(dateRange)

  React.useEffect(() => {
    setRange(dateRange)
  }, [dateRange])

  const nights =
    range?.from && range?.to
      ? differenceInCalendarDays(range.to, range.from)
      : 0

  function handleSelect(next: DateRange | undefined) {
    setRange(next)
    // Only commit to context (and sessionStorage) once the range is complete.
    // Partial first-click ranges ({from, to:undefined}) stay in local state only.
    if (!next || (next.from && next.to)) {
      setDateRange(next)
    }
  }

  const checkInLabel = range?.from ? format(range.from, "LLL dd, y") : "Add date"
  const checkOutLabel = range?.to ? format(range.to, "LLL dd, y") : "Add date"
  const nightsLabel =
    nights > 0
      ? `${nights} ${pluralize(nights, "night")} selected`
      : "Select your dates"

  return (
    <div style={heroTheme} className="text-[#f3ecda]">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            className="overflow-hidden rounded-xl border border-[#c69456]/20 sm:flex"
            style={{ background: "rgba(8,26,39,0.35)", backdropFilter: "blur(4px)" }}
          >
            {/* Check In */}
            <button
              type="button"
              data-testid="booking-date-trigger"
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[rgba(198,148,86,0.1)] sm:flex-1"
              onClick={() => setOpen(true)}
            >
              <CalendarIcon className="size-4 shrink-0 text-[#dcae70]" />
              <div>
                <div className="text-[0.65rem] tracking-[0.18em] text-[#dcae70]/70 uppercase">
                  Check in
                </div>
                <div className="text-sm">{checkInLabel}</div>
              </div>
            </button>

            {DIVIDER_H}
            {DIVIDER_V}

            {/* Check Out */}
            <button
              type="button"
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[rgba(198,148,86,0.1)] sm:flex-1"
              onClick={() => setOpen(true)}
            >
              <CalendarIcon className="size-4 shrink-0 text-[#dcae70]" />
              <div>
                <div className="text-[0.65rem] tracking-[0.18em] text-[#dcae70]/70 uppercase">
                  Check out
                </div>
                <div className="text-sm">{checkOutLabel}</div>
              </div>
            </button>

            {DIVIDER_H}
            {DIVIDER_V}

            {/* Guests */}
            <div className="flex items-center gap-3 px-5 py-3.5 sm:flex-1">
              <Users className="size-4 shrink-0 text-[#dcae70]" />
              <div className="flex-1">
                <div className="text-[0.65rem] tracking-[0.18em] text-[#dcae70]/70 uppercase">
                  Guests
                </div>
                <div className="text-sm" aria-live="polite">
                  {guests} guest{guests > 1 ? "s" : ""}
                </div>
              </div>
              {/* stopPropagation so stepper clicks don't open the calendar */}
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label="Decrease guests"
                  disabled={guests <= MIN_GUESTS}
                  onClick={() => setGuests(guests - 1)}
                  className="flex size-7 items-center justify-center rounded-full border border-[rgba(198,148,86,0.45)] text-[#dcae70] transition-colors hover:bg-[rgba(198,148,86,0.15)] disabled:opacity-30"
                >
                  –
                </button>
                <span className="w-4 text-center text-sm tabular-nums">
                  {guests}
                </span>
                <button
                  type="button"
                  aria-label="Increase guests"
                  disabled={guests >= MAX_GUESTS}
                  onClick={() => setGuests(guests + 1)}
                  className="flex size-7 items-center justify-center rounded-full border border-[rgba(198,148,86,0.45)] text-[#dcae70] transition-colors hover:bg-[rgba(198,148,86,0.15)] disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </PopoverAnchor>

        <PopoverContent
          className="w-auto p-0"
          align="start"
          data-testid="booking-calendar"
        >
          <Calendar
            mode="range"
            defaultMonth={range?.from}
            selected={range}
            onSelect={handleSelect}
            numberOfMonths={2}
            disabled={{ before: new Date() }}
            autoFocus
          />
          <div className="flex items-center justify-between gap-2 border-t p-3">
            <span
              className="text-muted-foreground text-sm"
              data-testid="booking-nights"
            >
              {nightsLabel}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSelect(undefined)}
              >
                Clear
              </Button>
              <Button
                variant="action"
                size="sm"
                disabled={!range?.from || !range?.to}
                onClick={() => setOpen(false)}
                data-testid="booking-apply"
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
