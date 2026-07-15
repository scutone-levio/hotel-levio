import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildDateChangeBookingUpdateData,
  computeDateChangeQuote,
  validateDateChangeFinalization,
  validateDateChangePaymentIntentUsage,
} from "./account-date-change"

describe("account action helpers", () => {
  it("rejects reused payment intents", () => {
    const result = validateDateChangePaymentIntentUsage({ id: "booking-1" })
    assert.deepEqual(result, {
      ok: false,
      error: "Payment intent already used for a booking",
    })
  })

  it("allows unused payment intents", () => {
    const result = validateDateChangePaymentIntentUsage(null)
    assert.deepEqual(result, { ok: true })
  })

  it("records the date-change payment intent id without touching stripeSessionId", () => {
    const data = buildDateChangeBookingUpdateData(
      { stripeSessionId: "original_session" },
      "new_intent",
      new Date("2026-08-01"),
      new Date("2026-08-05"),
      25000,
    )

    assert.equal(data.dateChangeStripePaymentId, "new_intent")
    assert.equal(data.totalPrice, 25000)
    assert.ok(!("stripeSessionId" in data), "stripeSessionId must not be overwritten")
  })

  it("sets dateChangeStripePaymentId to null when no payment intent is provided", () => {
    const data = buildDateChangeBookingUpdateData(
      { stripeSessionId: "original_session" },
      undefined,
      new Date("2026-08-01"),
      new Date("2026-08-05"),
      25000,
    )

    assert.equal(data.dateChangeStripePaymentId, null)
    assert.ok(!("stripeSessionId" in data), "stripeSessionId must not be overwritten")
  })

  it("accepts finalization when quote and payment match booking total", () => {
    const result = validateDateChangeFinalization({
      booking: { totalPrice: 20000, dateChangeStripePaymentId: null },
      submittedQuoteTotal: 25000,
      submittedPriceDiff: 5000,
      quoteTotal: 25000,
      priceDiff: 5000,
      stripePaymentIntentId: "pi_123",
    })
    assert.deepEqual(result, { ok: true })
  })

  it("rejects stale quotes when booking total changed", () => {
    const result = validateDateChangeFinalization({
      booking: { totalPrice: 22000, dateChangeStripePaymentId: null },
      submittedQuoteTotal: 25000,
      submittedPriceDiff: 5000,
      quoteTotal: 25000,
      priceDiff: 3000,
      stripePaymentIntentId: "pi_123",
    })
    assert.deepEqual(result, {
      ok: false,
      error: "Quote no longer matches this reservation",
    })
  })

  it("rejects stale quotes when room pricing changed", () => {
    const result = validateDateChangeFinalization({
      booking: { totalPrice: 20000, dateChangeStripePaymentId: null },
      submittedQuoteTotal: 25000,
      submittedPriceDiff: 5000,
      quoteTotal: 26000,
      priceDiff: 6000,
      stripePaymentIntentId: "pi_123",
    })
    assert.deepEqual(result, {
      ok: false,
      error: "Quote no longer matches this reservation",
    })
  })

  it("requires payment when the price increases", () => {
    const result = validateDateChangeFinalization({
      booking: { totalPrice: 20000, dateChangeStripePaymentId: null },
      submittedQuoteTotal: 25000,
      submittedPriceDiff: 5000,
      quoteTotal: 25000,
      priceDiff: 5000,
    })
    assert.deepEqual(result, {
      ok: false,
      error: "Payment is required for this date change",
    })
  })

  it("rejects payment intents already linked to the booking", () => {
    const result = validateDateChangeFinalization({
      booking: { totalPrice: 20000, dateChangeStripePaymentId: "pi_123" },
      submittedQuoteTotal: 25000,
      submittedPriceDiff: 5000,
      quoteTotal: 25000,
      priceDiff: 5000,
      stripePaymentIntentId: "pi_123",
    })
    assert.deepEqual(result, {
      ok: false,
      error: "Payment intent already used for a booking",
    })
  })

  it("computes quote totals from room pricing", () => {
    const room = {
      basePrice: 10000,
      priceRules: [] as Array<{ dayOfWeek: number; price: number }>,
    }
    const checkIn = new Date("2026-08-01")
    const checkOut = new Date("2026-08-03")

    const result = computeDateChangeQuote(room, 15000, checkIn, checkOut)

    assert.equal(result.quoteTotal, 20000)
    assert.equal(result.priceDiff, 5000)
  })
})
