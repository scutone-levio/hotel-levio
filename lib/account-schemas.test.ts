import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { profileSchema, registerSchema } from "./account-schemas"

describe("registerSchema", () => {
  it("accepts valid registration input", () => {
    const result = registerSchema.safeParse({
      name: "Demo Customer",
      email: "customer@hotel.test",
      password: "password123",
    })
    assert.equal(result.success, true)
  })

  it("rejects missing name", () => {
    const result = registerSchema.safeParse({
      name: "",
      email: "customer@hotel.test",
      password: "password123",
    })
    assert.equal(result.success, false)
  })

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      name: "Demo Customer",
      email: "not-an-email",
      password: "password123",
    })
    assert.equal(result.success, false)
  })

  it("rejects short passwords", () => {
    const result = registerSchema.safeParse({
      name: "Demo Customer",
      email: "customer@hotel.test",
      password: "short",
    })
    assert.equal(result.success, false)
  })
})

describe("profileSchema", () => {
  it("accepts name with optional address fields", () => {
    const result = profileSchema.safeParse({
      name: "Demo Customer",
      phone: "+1 (514) 555-0199",
      addressLine1: "100 Rue de la Commune",
      city: "Montréal",
      province: "QC",
      postalCode: "H2Y 0B7",
      country: "CA",
    })
    assert.equal(result.success, true)
  })

  it("accepts empty optional fields", () => {
    const result = profileSchema.safeParse({
      name: "Demo Customer",
      phone: "",
      addressLine1: "",
    })
    assert.equal(result.success, true)
  })

  it("rejects missing name", () => {
    const result = profileSchema.safeParse({
      name: "   ",
    })
    assert.equal(result.success, false)
  })
})
