import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { startOfDay } from "date-fns"

import {
  isPastBooking,
  isUpcomingBooking,
  partitionBookings,
} from "./account-bookings"

describe("account booking partitions", () => {
  const today = startOfDay(new Date(2026, 6, 10))

  it("marks confirmed future stays as upcoming", () => {
    assert.equal(
      isUpcomingBooking(
        { checkOut: new Date("2026-07-15"), status: "CONFIRMED" },
        today,
      ),
      true,
    )
  })

  it("marks confirmed past stays as past", () => {
    assert.equal(
      isPastBooking(
        { checkOut: new Date("2026-07-01"), status: "CONFIRMED" },
        today,
      ),
      true,
    )
  })

  it("includes cancelled bookings in past", () => {
    assert.equal(
      isPastBooking(
        { checkOut: new Date("2026-08-01"), status: "CANCELLED" },
        today,
      ),
      true,
    )
  })

  it("partitions and sorts bookings", () => {
    const rows = [
      {
        id: "1",
        checkIn: new Date("2026-08-01"),
        checkOut: new Date("2026-08-03"),
        status: "CONFIRMED" as const,
        totalPrice: 10000,
        roomName: "Queen",
      },
      {
        id: "2",
        checkIn: new Date("2026-07-20"),
        checkOut: new Date("2026-07-22"),
        status: "CONFIRMED" as const,
        totalPrice: 9000,
        roomName: "Twin",
      },
      {
        id: "3",
        checkIn: new Date("2026-06-01"),
        checkOut: new Date("2026-06-03"),
        status: "CONFIRMED" as const,
        totalPrice: 8000,
        roomName: "King",
      },
    ]

    const { upcoming, past } = partitionBookings(rows, today)
    assert.equal(upcoming.length, 2)
    assert.equal(upcoming[0]?.id, "2")
    assert.equal(past.length, 1)
    assert.equal(past[0]?.id, "3")
  })
})
