"use client"

import * as React from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { getAccountBookings } from "@/app/account/actions"
import type { BookingListRow } from "@/lib/account-bookings"
import { formatPrice } from "@/lib/rooms"
import {
  AdminPagination,
  type AdminPageSize,
} from "@/components/admin/admin-pagination"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type TabKey = "upcoming" | "past"

type TabState = {
  page: number
  pageSize: AdminPageSize
}

type TabData = {
  bookings: BookingListRow[]
  total: number
}

function useTabPagination(initialPageSize: AdminPageSize = 10) {
  const [state, setState] = React.useState<TabState>({
    page: 1,
    pageSize: initialPageSize,
  })
  const [data, setData] = React.useState<TabData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [, startTransition] = React.useTransition()

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
  const currentPage = Math.min(Math.max(state.page, 1), totalPages)

  React.useEffect(() => {
    if (state.page !== currentPage) {
      setState((prev) => ({ ...prev, page: currentPage }))
    }
  }, [state.page, currentPage])

  function setPage(page: number) {
    setState((prev) => ({ ...prev, page }))
  }

  function handlePageSizeChange(size: AdminPageSize) {
    setState({ page: 1, pageSize: size })
  }

  return {
    state,
    data,
    loading,
    total,
    currentPage,
    setPage,
    handlePageSizeChange,
    setData,
    setLoading,
    startTransition,
  }
}

function ReservationsTabPanel({
  tab,
  active,
  tabState,
}: {
  tab: TabKey
  active: boolean
  tabState: ReturnType<typeof useTabPagination>
}) {
  const {
    state,
    data,
    loading,
    total,
    currentPage,
    setPage,
    handlePageSizeChange,
    setData,
    setLoading,
    startTransition,
  } = tabState

  const load = React.useCallback(() => {
    startTransition(async () => {
      setLoading(true)
      const result = await getAccountBookings({
        tab,
        page: state.page,
        pageSize: state.pageSize,
      })
      if (result.ok) {
        setData({ bookings: result.bookings, total: result.total })
      } else {
        toast.error(result.error)
      }
      setLoading(false)
    })
  }, [tab, state.page, state.pageSize, setData, setLoading, startTransition])

  React.useEffect(() => {
    if (!active) return
    load()
  }, [active, load])

  const bookings = data?.bookings ?? []
  const showInitialLoad = active && loading && !data

  let tabBody: React.ReactNode
  if (showInitialLoad) {
    tabBody = (
      <div className="flex justify-center py-12">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  } else if (bookings.length === 0) {
    tabBody = (
      <p className="text-muted-foreground text-sm">
        {tab === "upcoming"
          ? "No upcoming reservations."
          : "No past reservations."}
      </p>
    )
  } else {
    tabBody = (
      <div className="space-y-3">
        {bookings.map((b) => (
          <ReservationCard key={b.id} booking={b} />
        ))}
      </div>
    )
  }

  return (
    <TabsContent value={tab} className="mt-4 space-y-4">
      {tabBody}
      <AdminPagination
        page={currentPage}
        pageSize={state.pageSize}
        total={showInitialLoad ? 0 : total}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />
    </TabsContent>
  )
}

export function ReservationsList() {
  const [activeTab, setActiveTab] = React.useState<TabKey>("upcoming")
  const upcoming = useTabPagination()
  const past = useTabPagination()

  function tabCount(tab: TabKey) {
    const tabState = tab === "upcoming" ? upcoming : past
    if (tabState.loading && !tabState.data) return 0
    return tabState.total
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as TabKey)}
    >
      <TabsList>
        <TabsTrigger value="upcoming">Upcoming ({tabCount("upcoming")})</TabsTrigger>
        <TabsTrigger value="past">Past ({tabCount("past")})</TabsTrigger>
      </TabsList>

      <ReservationsTabPanel
        tab="upcoming"
        active={activeTab === "upcoming"}
        tabState={upcoming}
      />
      <ReservationsTabPanel
        tab="past"
        active={activeTab === "past"}
        tabState={past}
      />
    </Tabs>
  )
}

function ReservationCard({ booking }: { booking: BookingListRow }) {
  return (
    <Link
      href={`/account/reservations/${booking.id}`}
      className="hover:bg-muted/40 block rounded-xl border p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{booking.roomName}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {format(booking.checkIn, "MMM d, yyyy")} →{" "}
            {format(booking.checkOut, "MMM d, yyyy")}
          </p>
        </div>
        <div className="text-right">
          <Badge variant={booking.status === "CANCELLED" ? "outline" : "secondary"}>
            {booking.status}
          </Badge>
          <p className="mt-2 text-sm font-semibold">
            {formatPrice(booking.totalPrice, "CAD")}
          </p>
        </div>
      </div>
    </Link>
  )
}
