import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  applyPricePremium,
  weekendPriceForBase,
  subcategoryPriceForType,
  LAKE_VIEW_NAME,
  LOWER_LEVEL_NAME,
  CITY_VIEW_NAME,
} from "./subcategories"

describe("applyPricePremium", () => {
  it("rounds up to whole dollar for Lake View catalog bases", () => {
    assert.equal(applyPricePremium(12900, 1.25), 16200)
    assert.equal(applyPricePremium(18900, 1.25), 23700)
    assert.equal(applyPricePremium(22900, 1.25), 28700)
    assert.equal(applyPricePremium(39900, 1.25), 49900)
  })

  it("keeps exact whole-dollar results unchanged", () => {
    assert.equal(applyPricePremium(20000, 1.25), 25000)
  })
})

describe("weekendPriceForBase", () => {
  it("applies 25% premium rounded up", () => {
    assert.equal(weekendPriceForBase(23700), 29700)
  })
})

describe("subcategoryPriceForType", () => {
  it("charges premium for Lake View only", () => {
    assert.equal(subcategoryPriceForType(18900, LAKE_VIEW_NAME), 23700)
    assert.equal(subcategoryPriceForType(18900, CITY_VIEW_NAME), 18900)
    assert.equal(subcategoryPriceForType(12900, LOWER_LEVEL_NAME), 11900)
  })
})
