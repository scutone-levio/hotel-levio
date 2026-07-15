import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  listingCoverImageUrl,
  resolveListingImages,
  resolveListingImagesForRoom,
} from "./listing-images"

const catalog = [
  { id: "c1", url: "https://example.com/catalog.jpg", sortOrder: 0 },
]
const subcategory = [
  { id: "s1", url: "https://example.com/lake.jpg", sortOrder: 0 },
]

describe("resolveListingImages", () => {
  it("uses subcategory images when present", () => {
    assert.deepEqual(resolveListingImages(catalog, subcategory), subcategory)
  })

  it("falls back to catalog when subcategory gallery is empty", () => {
    assert.deepEqual(resolveListingImages(catalog, []), catalog)
  })

  it("falls back to catalog when subcategory is null", () => {
    assert.deepEqual(resolveListingImages(catalog, null), catalog)
  })
})

describe("listingCoverImageUrl", () => {
  it("returns subcategory cover when available", () => {
    assert.equal(
      listingCoverImageUrl(catalog, subcategory),
      "https://example.com/lake.jpg",
    )
  })

  it("returns catalog cover when subcategory gallery is empty", () => {
    assert.equal(
      listingCoverImageUrl(catalog, []),
      "https://example.com/catalog.jpg",
    )
  })
})

describe("resolveListingImagesForRoom", () => {
  it("resolves from room and subcategory", () => {
    assert.deepEqual(
      resolveListingImagesForRoom({
        images: catalog,
        subcategory: { images: subcategory },
      }),
      subcategory,
    )
  })
})
