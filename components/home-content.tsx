"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { MapPin, Star } from "lucide-react"
import type { DateRange } from "react-day-picker"

import type { RoomWithDetails } from "@/lib/queries"
import { getAvailableRoomIds, getAvailabilityCountsByType } from "@/app/actions"
import type { AvailabilityCount } from "@/app/actions"
import { useDateRange } from "@/lib/date-range"
import { Badge } from "@/components/ui/badge"
import { BookingPicker } from "@/components/booking-picker"
import { RoomsBrowser } from "@/components/rooms-browser"

export function HomeContent({ rooms }: { rooms: RoomWithDetails[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const { dateRange, setDateRange, isHydrated } = useDateRange()

  const [availableIds, setAvailableIds] = React.useState<Set<string> | null>(null)
  const [availabilityCounts, setAvailabilityCounts] = React.useState<
    Record<string, AvailabilityCount> | null
  >(null)
  const [isPending, startTransition] = React.useTransition()

  // Strip legacy date query params from old URLs (storage is the source of truth).
  React.useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has("checkIn") && !url.searchParams.has("checkOut")) {
      return
    }
    url.searchParams.delete("checkIn")
    url.searchParams.delete("checkOut")
    const next = `${url.pathname}${url.search}${url.hash}`
    router.replace(next, { scroll: false })
  }, [router, pathname])

  React.useEffect(() => {
    if (!isHydrated) return

    if (!dateRange?.from || !dateRange?.to) {
      setAvailableIds(null)
      setAvailabilityCounts(null)
      return
    }

    startTransition(async () => {
      const checkIn = dateRange.from!.toISOString()
      const checkOut = dateRange.to!.toISOString()
      const [ids, counts] = await Promise.all([
        getAvailableRoomIds(checkIn, checkOut),
        getAvailabilityCountsByType(checkIn, checkOut),
      ])
      setAvailableIds(new Set(ids))
      setAvailabilityCounts(counts)
    })
  }, [dateRange, isHydrated])

  function handleRangeChange(range: DateRange | undefined) {
    setDateRange(range)
  }

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="via-background dark:via-background absolute inset-0 -z-10 bg-gradient-to-br from-sky-100 to-emerald-50 dark:from-sky-950/40 dark:to-emerald-950/30" />
        <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-28">
          <Badge variant="secondary" className="mb-5 gap-1">
            <Star className="size-3.5 fill-current" /> Rated 4.9 by 2,300+
            guests
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Your seaside escape starts at Hôtel Levio
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-lg text-pretty">
            Ocean-view suites, a rooftop pool, and effortless booking. Pick
            your dates and reserve your stay in seconds.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <BookingPicker
              initialRange={dateRange}
              onRangeChange={handleRangeChange}
            />
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <MapPin className="size-4" /> 1 Harbour Road, Levio
            </p>
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section id="rooms" className="mx-auto max-w-6xl px-6 pb-24">
        <RoomsBrowser
          rooms={rooms}
          availableIds={availableIds}
          availabilityCounts={availabilityCounts}
          isCheckingAvailability={isPending}
        />
      </section>
    </>
  )
}
