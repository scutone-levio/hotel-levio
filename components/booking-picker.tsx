"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { addDays, differenceInCalendarDays, format } from "date-fns"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type BookingPickerProps = {
  className?: string
  initialRange?: DateRange
  /** Called whenever the selected range changes. */
  onRangeChange?: (range: DateRange | undefined) => void
}

export function BookingPicker({
  className,
  initialRange,
  onRangeChange,
}: BookingPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [range, setRange] = React.useState<DateRange | undefined>(initialRange)

  // Sync when the parent resolves a stored range after mount.
  React.useEffect(() => {
    if (initialRange !== undefined) setRange(initialRange)
  }, [initialRange])

  const nights =
    range?.from && range?.to
      ? differenceInCalendarDays(range.to, range.from)
      : 0

  function handleSelect(next: DateRange | undefined) {
    setRange(next)
    onRangeChange?.(next)
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="booking-date"
            data-testid="booking-date-trigger"
            variant="outline"
            className={cn(
              "w-full justify-start gap-2 text-left font-normal sm:w-[320px]",
              !range && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4" />
            {range?.from ? (
              range.to ? (
                <span>
                  {format(range.from, "LLL dd, y")} &ndash;{" "}
                  {format(range.to, "LLL dd, y")}
                </span>
              ) : (
                <span>{format(range.from, "LLL dd, y")}</span>
              )
            ) : (
              <span>Check-in &ndash; Check-out</span>
            )}
          </Button>
        </PopoverTrigger>
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
              {nights > 0
                ? `${nights} night${nights > 1 ? "s" : ""} selected`
                : "Select your dates"}
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

export { addDays }
