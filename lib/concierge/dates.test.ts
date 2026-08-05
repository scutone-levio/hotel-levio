import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseStayDates } from "./dates"

describe("parseStayDates", () => {
  it("rejects invalid dates", () => {
    const result = parseStayDates("not-a-date", "2026-08-02")
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /Invalid dates/)
  })

  it("rejects check-out on or before check-in", () => {
    const result = parseStayDates("2026-08-05", "2026-08-05")
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.error, /Check-out must be after check-in/)
    }
  })

  it("rejects past check-in", () => {
    const result = parseStayDates("2020-01-01", "2020-01-05")
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.error, /cannot be in the past/)
    }
  })

  it("accepts valid future dates", () => {
    const checkIn = new Date()
    checkIn.setDate(checkIn.getDate() + 7)
    const checkOut = new Date(checkIn)
    checkOut.setDate(checkOut.getDate() + 2)

    const result = parseStayDates(
      checkIn.toISOString(),
      checkOut.toISOString(),
    )
    assert.equal(result.ok, true)
  })
})

describe("checkRateLimit", () => {
  it("allows requests under the limit", async () => {
    const { checkRateLimit } = await import("./rate-limit")
    assert.equal(checkRateLimit("test-ip-a").ok, true)
    assert.equal(checkRateLimit("test-ip-a").ok, true)
  })
})
