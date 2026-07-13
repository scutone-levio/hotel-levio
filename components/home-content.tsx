"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { MapPin } from "lucide-react"
import type { PublicRoomListing } from "@/lib/queries"
import {
  getAvailableRoomIds,
  getAvailabilityCountsByListing,
  type ListingAvailabilityInput,
} from "@/app/actions"
import type { AvailabilityCount } from "@/app/actions"
import { useDateRange } from "@/lib/date-range"
import { HeroSearchBar } from "@/components/hero-search-bar"
import { RoomsBrowser } from "@/components/rooms-browser"

export function HomeContent({ rooms }: { rooms: PublicRoomListing[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const { dateRange, isHydrated, guests } = useDateRange()

  const listingInputs = React.useMemo<ListingAvailabilityInput[]>(
    () =>
      rooms
        .filter((room) => room.subcategory?.id)
        .map((room) => ({
          roomId: room.id,
          type: room.type,
          subcategoryId: room.subcategory!.id,
        })),
    [rooms],
  )

  const [availableListingKeys, setAvailableListingKeys] = React.useState<
    Set<string> | null
  >(null)
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
      setAvailableListingKeys(null)
      setAvailabilityCounts(null)
      return
    }

    startTransition(async () => {
      const checkIn = dateRange.from!.toISOString()
      const checkOut = dateRange.to!.toISOString()
      const [ids, counts] = await Promise.all([
        getAvailableRoomIds(checkIn, checkOut, listingInputs),
        getAvailabilityCountsByListing(checkIn, checkOut, listingInputs),
      ])
      setAvailableListingKeys(new Set(ids))
      setAvailabilityCounts(counts)
    })
  }, [dateRange, isHydrated, listingInputs])

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-linear-to-b from-[#081a27] via-[#0f2a3d] to-[#3f6f83] px-6 py-24 text-center sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[30%] left-1/2 h-[60rem] w-[60rem] -translate-x-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(220,174,112,0.14) 0%, transparent 60%)",
          }}
        />

        <div className="relative mx-auto max-w-2xl">
          <span className="inline-flex items-center gap-3 text-[0.72rem] tracking-[0.24em] text-[#dcae70] uppercase">
            <span className="h-px w-9 bg-[#dcae70]/70" />
            <span>Rated 4.9 · 2,300+ Guests</span>
            <span className="h-px w-9 bg-[#dcae70]/70" />
          </span>

          <h1 className="mx-auto mt-6 max-w-2xl text-4xl leading-[1.1] font-medium text-balance text-[#f8f3e6] sm:text-6xl">
            Your lakeside escape starts at{" "}
            <em className="text-[#dcae70] not-italic">Hôtel Levio</em>
          </h1>

          <p className="mx-auto mt-5 max-w-md text-[1.05rem] leading-relaxed text-[#f8f3e6]/70 text-pretty">
            Ocean-view suites, a rooftop pool, and effortless booking. Pick
            your dates and reserve your stay in seconds.
          </p>

          <div className="mt-8 flex flex-col items-center gap-6">
            <HeroSearchBar />
            <p className="flex items-center gap-1.5 text-sm tracking-wide text-[#f8f3e6]/60 uppercase">
              <MapPin className="size-3.5 text-[#dcae70]" /> 1 Harbour Road,
              Levio
            </p>
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section
        id="rooms"
        className="pt-30 pb-24"
        style={{
          backgroundColor:
            "color-mix(in srgb, rgb(243, 236, 218) 30%, white)",
        }}
      >
        <div className="mx-auto max-w-6xl px-6">
          <RoomsBrowser
            rooms={rooms}
            availableIds={availableListingKeys}
            availabilityCounts={availabilityCounts}
            isCheckingAvailability={isPending}
            minGuests={guests}
          />
        </div>
      </section>
    </>
  )
}
