import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildDateChangeBookingUpdateData,
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
})
