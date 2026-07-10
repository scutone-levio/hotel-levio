import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  computeSubcategoryPricingFromRooms,
  pickLowestAvailableRoomNumber,
} from "./subcategory-pricing"

describe("computeSubcategoryPricingFromRooms", () => {
  it("sets fromPriceCents to minimum nightly rate across rooms", () => {
    const result = computeSubcategoryPricingFromRooms([
      { basePrice: 23700, priceRules: [{ price: 29700 }, { price: 29700 }] },
      { basePrice: 23700, priceRules: [{ price: 29700 }] },
    ])

    assert.equal(result.fromPriceCents, 23700)
    assert.equal(result.hasWeekendRates, true)
  })

  it("returns zeros when no inventory rooms exist", () => {
    assert.deepEqual(computeSubcategoryPricingFromRooms([]), {
      fromPriceCents: 0,
      hasWeekendRates: false,
    })
  })

  it("detects weekend rates only when a rule exceeds base", () => {
    const weekdayOnly = computeSubcategoryPricingFromRooms([
      { basePrice: 18900, priceRules: [] },
    ])
    assert.equal(weekdayOnly.hasWeekendRates, false)
    assert.equal(weekdayOnly.fromPriceCents, 18900)
  })
})

describe("pickLowestAvailableRoomNumber", () => {
  it("assigns the lowest room number when the first is booked", () => {
    const units = [
      { id: "a", roomNumber: "102" },
      { id: "b", roomNumber: "103" },
      { id: "c", roomNumber: "104" },
    ]
    const picked = pickLowestAvailableRoomNumber(units, new Set(["a"]))
    assert.equal(picked?.roomNumber, "103")
  })

  it("returns null when every unit is booked", () => {
    const units = [{ id: "a", roomNumber: "102" }]
    const picked = pickLowestAvailableRoomNumber(units, new Set(["a"]))
    assert.equal(picked, null)
  })
})
