import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { validatePassword } from "./password"

describe("validatePassword", () => {
  it("accepts passwords with at least 8 characters", () => {
    assert.equal(validatePassword("password123"), null)
    assert.equal(validatePassword("12345678"), null)
  })

  it("rejects passwords shorter than 8 characters", () => {
    assert.equal(
      validatePassword("short"),
      "Password must be at least 8 characters",
    )
    assert.equal(validatePassword(""), "Password must be at least 8 characters")
  })
})
