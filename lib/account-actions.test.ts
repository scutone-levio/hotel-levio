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

  it("prefers the provided Stripe intent when updating booking data", () => {
    const data = buildDateChangeBookingUpdateData(
      { stripeSessionId: "old_intent" },
      "new_intent",
      new Date("2026-08-01"),
      new Date("2026-08-05"),
      25000,
    )

    assert.equal(data.stripeSessionId, "new_intent")
    assert.equal(data.totalPrice, 25000)
  })

  it("keeps the existing Stripe intent when no new intent is provided", () => {
    const data = buildDateChangeBookingUpdateData(
      { stripeSessionId: "existing_intent" },
      undefined,
      new Date("2026-08-01"),
      new Date("2026-08-05"),
      25000,
    )

    assert.equal(data.stripeSessionId, "existing_intent")
  })
})
