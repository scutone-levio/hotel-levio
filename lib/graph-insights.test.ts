import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { normalizeAmenityNames } from "./graph-insights"

describe("normalizeAmenityNames", () => {
  it("returns empty array for null/undefined", () => {
    assert.deepEqual(normalizeAmenityNames(null), [])
    assert.deepEqual(normalizeAmenityNames(undefined), [])
  })

  it("returns empty array for empty input", () => {
    assert.deepEqual(normalizeAmenityNames([]), [])
  })

  it("filters null entries from Neo4j collect results", () => {
    assert.deepEqual(
      normalizeAmenityNames(["Mini-fridge", null, "Smart TV"]),
      ["Mini-fridge", "Smart TV"],
    )
  })

  it("sorts alphabetically", () => {
    assert.deepEqual(
      normalizeAmenityNames(["Zebra", "Alpha", "Beta"]),
      ["Alpha", "Beta", "Zebra"],
    )
  })

  it("deduplicates names", () => {
    assert.deepEqual(
      normalizeAmenityNames(["Alpha", "Alpha", "Beta"]),
      ["Alpha", "Beta"],
    )
  })
})
