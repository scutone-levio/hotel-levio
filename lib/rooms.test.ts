import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { getRoomPrice, listingFromPriceCents } from "./rooms"

describe("listingFromPriceCents", () => {
  it("returns basePrice when fromPriceCents is 0", () => {
    assert.equal(
      listingFromPriceCents({ basePrice: 23700, fromPriceCents: 0 }),
      23700,
    )
  })

  it("returns fromPriceCents when positive", () => {
    assert.equal(
      listingFromPriceCents({ basePrice: 18900, fromPriceCents: 23700 }),
      23700,
    )
  })
})

describe("getRoomPrice", () => {
  it("delegates to listingFromPriceCents when subcategory is present", () => {
    assert.equal(
      getRoomPrice({
        basePrice: 18900,
        subcategory: { basePrice: 23700, fromPriceCents: 0 },
      }),
      23700,
    )
  })

  it("uses catalog basePrice when subcategory is absent", () => {
    assert.equal(getRoomPrice({ basePrice: 18900 }), 18900)
  })
})
