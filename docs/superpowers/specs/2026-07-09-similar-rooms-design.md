# Similar Rooms ("Other Rooms You Might Like") — Design Spec

**Date:** 2026-07-09  
**Status:** Approved  
**Branch context:** `feature/featured-subcategory-listings` (subcategory-scoped public listings)

## Problem

The "Other Rooms You Might Like" section on individual room detail pages (`/rooms/[slug]`) shows stale, pre-subcategory data:

1. **Wrong presentation (A):** Cards use generic catalog names (e.g. "Queen Room") instead of subcategory listings (e.g. "Queen Room - Lake View"). Prices, featured badges, and detail links omit subcategory context.
2. **Wrong candidates (B):** Recommendations pull from `getCatalogRooms()` (four catalog rows), including room types/subcategories that are not public on the homepage. The homepage uses `getPublicRoomListings()`, which only includes subcategories with at least one inventory unit.

Additionally, similarity exclusion uses `room.id` only. All subcategories of a type share one catalog `id`, so viewing one Queen subcategory incorrectly excludes every Queen listing from recommendations.

## Goals

- Recommendations use the **same public listing pool** as the homepage.
- Cards match homepage listing shape: formatted name, subcategory price, featured badge, `?subcategory=` links.
- Viewing a subcategory listing excludes **only that listing**; other subcategories of the same type remain eligible.
- Rank all public listings by existing similarity signals (type, amenities, capacity/beds, price proximity).

## Non-Goals

- Date-range availability filtering in the similar-rooms section (homepage-only concern for now).
- Refactoring `BookRoomDialog` / cart quote logic.
- Caching or deduplicating `getPublicRoomListings()` across page sections.

## Recommended Approach

**Reuse `getPublicRoomListings()` inside `getSimilarRooms`** (minimal diff, single source of truth).

Alternatives considered:

| Approach | Verdict |
|---|---|
| New `getSimilarPublicListings()` wrapper | Acceptable but adds indirection without benefit |
| Inline assembly in `page.tsx` | Rejected — duplicates listing logic |

## Architecture

### Data flow

```
RoomPage
  └─ getCatalogRoomBySlug(slug, subcategoryId) → current listing
  └─ getSimilarRooms(current, 3)
       └─ getPublicRoomListings()           → all inventory-backed listings
       └─ filter out current listing        → isSamePublicListing()
       └─ pickSimilarRooms(current, pool)   → top 3 by score
  └─ RoomCard × N                           → existing card UI
```

### Listing identity & exclusion

```ts
function isSamePublicListing(
  current: RoomWithDetails,
  candidate: PublicRoomListing,
): boolean {
  if (current.id !== candidate.id) return false
  if (current.subcategory?.id && candidate.subcategory.id) {
    return current.subcategory.id === candidate.subcategory.id
  }
  return false
}
```

| Current page context | Exclusion behavior |
|---|---|
| Subcategory URL (`?subcategory=…`) | Exclude exact `roomId + subcategoryId` match only |
| Bare catalog URL (no subcategory param) | Exclude nothing — no public listing equals the bare catalog row |

### Similarity scoring (`pickSimilarRooms`)

Keep existing signals; make pricing subcategory-aware:

- **Type match:** +100 (unchanged)
- **Shared amenities:** +8 per amenity (unchanged)
- **Capacity / beds match:** +15 / +10 (unchanged)
- **Price proximity:** use `getRoomPrice(room)` instead of `room.basePrice`

Move listing exclusion **out of** `pickSimilarRooms` (caller filters first) so same-type subcategories are not dropped by shared catalog `id`.

### Return types

- `getSimilarRooms` returns `PublicRoomListing[]` (was `RoomWithDetails[]`).
- `RoomCard` already accepts `RoomWithDetails` with optional `subcategory` and `featured`; no card changes required.

## File Changes

| File | Change |
|---|---|
| `lib/queries.ts` | `getSimilarRooms` uses `getPublicRoomListings()`, adds `isSamePublicListing`, returns `PublicRoomListing[]` |
| `lib/rooms.ts` | `pickSimilarRooms` uses `getRoomPrice()` for price scoring; remove `room.id !== current.id` filter (caller handles exclusion) |
| `app/rooms/[slug]/page.tsx` | React `key` on similar cards: `listingAvailabilityKey(id, subcategoryId)` |

No schema, migration, or admin changes.

## Edge Cases

| Scenario | Behavior |
|---|---|
| Fewer than 3 listings after exclusion | Show available count; hide section when 0 |
| Only one public listing total | Section hidden |
| Invalid `subcategory` query param | Page falls back to bare catalog (existing); recommendations include all public listings for that type |
| Subcategory with zero inventory | Never in candidate pool (`getPublicRoomListings` filter) |
| Admin price/featured change | Reflected on next page load (same as homepage) |

## Testing

### Playwright (`tests/similar-rooms.spec.ts`)

1. Navigate to a subcategory-scoped detail page from the homepage (e.g. a featured Lake View listing).
2. Assert "Other Rooms You Might Like" section exists.
3. Assert card titles contain subcategory suffix (name includes `" - "`).
4. Assert the current listing's title does not appear in the section.
5. Assert at least one card link href includes `?subcategory=`.

### Optional unit test

Mock `PublicRoomListing` objects for `pickSimilarRooms`:

- Same-type subcategories are not excluded when only one matches current subcategory id.
- Subcategory `basePrice` affects ranking vs catalog `basePrice`.

## Validation

- `npm run typecheck`
- `npx playwright test tests/similar-rooms.spec.ts`

## Success Criteria

- Similar-room cards visually and structurally match homepage listing cards.
- No catalog-only or zero-inventory subcategories appear in recommendations.
- Viewing "Queen - Lake View" can recommend "Queen - City View" and cross-type listings.
- Current listing never appears in its own recommendations section.
