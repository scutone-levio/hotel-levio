# Approach A — DB-Backed Pricing Refactor — Design Spec

**Date:** 2026-07-10  
**Status:** Approved  
**Branch context:** `feature/lake-view-pricing`

## Problem

Public listings merge a **catalog** `Room` (marketing + stale price rules) with a **subcategory** (correct base price). The app compensates with computed helpers (`getEffectivePriceRules`, `fromPrice`, `listingQuoteContext`), causing frontend/admin mismatches (e.g. Queen Lake View $236 vs $237) and checkout quotes that may not match inventory DB rows.

Inventory units already have correct per-room, per-weekday pricing in the database, but guest-facing code often reads catalog rules instead.

## Goal

Evolve the schema in place: store listing display prices on subcategories, quote checkout from **assigned inventory units** only, assign rooms by **lowest available room number**, and remove read-time pricing manipulation. Catalog rows remain marketing-only (`isCatalog: true`).

## Non-goals (Approach A)

- Splitting catalog vs inventory into separate tables (Approach B)
- Subcategory-level `RoomPriceRule` templates (Approach C)
- Tax calculation (future; only `formatPrice` on stored cents today)
- Price ranges (`toPriceCents`) on listing cards

---

## Schema changes

### `RoomSubcategory`

| Column            | Type      | Default                 | Purpose                                                                                               |
| ----------------- | --------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `fromPriceCents`  | `Int`     | required after backfill | Lowest nightly rate across all inventory rooms in this subcategory (card “from $237”)                 |
| `hasWeekendRates` | `Boolean` | `false`                 | `true` when any inventory room has a rule price above its weekday base (shows “from” prefix on cards) |

Keep existing `basePrice` as admin default / subcategory table display; listing cards use `fromPriceCents`.

### `Booking`

| Column          | Type                             | Purpose                                                           |
| --------------- | -------------------------------- | ----------------------------------------------------------------- |
| `subcategoryId` | `String?` FK → `RoomSubcategory` | What the guest selected (e.g. Queen → Lake View); set at checkout |

---

## Pricing source of truth

| Context                   | Reads from                                         | Must NOT read                                |
| ------------------------- | -------------------------------------------------- | -------------------------------------------- |
| Homepage / browse cards   | `subcategory.fromPriceCents`                       | Catalog `priceRules`, computed `fromPrice()` |
| Sort by price             | `subcategory.fromPriceCents`                       | Client-side min of base + rules              |
| Checkout / payment intent | Assigned inventory unit `basePrice` + `priceRules` | Catalog row pricing                          |
| Admin inventory table     | That room’s `basePrice` + rules                    | Subcategory base as runtime override         |

### Remove from guest-facing code

- `getEffectivePriceRules()`
- `listingQuoteContext()`
- Computed `fromPrice()` (min over base + rules)

### Keep

- `formatPrice(cents)` — display only
- `quoteRange(base, rules, from, to)` — selects stored rule per night; no multipliers at read time
- `getRoomPrice()` — may remain for admin/similar-rooms until migrated; not used for public listing cards

### Catalog rows

Images, description, amenities, nearby places only. Public site **ignores** catalog `basePrice` and `priceRules`. Admin catalog view may still display them for reference.

---

## Maintaining `fromPriceCents` and `hasWeekendRates`

Recomputed **at write time** on the server, never in client components.

```ts
// For each inventory room in subcategory:
//   nightlyRates = [room.basePrice, ...room.priceRules.map(r => r.price)]
// fromPriceCents = min(all nightlyRates across all rooms)
// hasWeekendRates = any(room.basePrice < some rule.price for any room)
```

### Triggers (call `recomputeSubcategoryPricing(subcategoryId)`)

- Admin edits inventory room base or weekday rules
- Admin edits subcategory base price (if inventory bases synced)
- Lake View bulk bump (`bumpLakeViewSubcategoryPrices`)
- Inventory create / delete / subcategory reassignment
- Seed script (after subcategories + inventory exist)
- One-time backfill script

### New module

`lib/subcategory-pricing.ts` (or extend `lib/inventory.ts`):

- `recomputeSubcategoryPricing(subcategoryId: string): Promise<void>`
- `recomputeAllSubcategoryPricing(): Promise<void>` — for migration script

---

## Quote flow and room assignment

### Incremental assignment (lowest room number first)

When a guest books a catalog listing with a subcategory:

```text
getAvailableUnits(type, checkIn, checkOut, subcategoryId)
  — filter: isCatalog=false, matching subcategory, not booked, no blackout
  — orderBy: roomNumber ASC
assignAvailableUnit → available[0]
```

Example: rooms 207, 209, 305 in Queen Lake View. If 207 is booked for the dates, assign **209** (lowest available `roomNumber` in that subcategory pool).

“Incremental” means **lowest available room number**, not necessarily consecutive integers (floor plan gaps are OK).

### Checkout pipeline

```text
Guest selects listing + dates
  → assignAvailableUnit / resolveBookingRoom (catalog path)
  → quoteRange(unit.basePrice, unit.priceRules, checkIn, checkOut)
  → Stripe PaymentIntent = sum of quoted totals
  → Booking { roomId: unit.id, subcategoryId, totalPrice }
```

All paths must use this assignment + quote logic:

- `finalizeBooking`
- `createBooking` (demo)
- `createCartPaymentIntent`
- `finalizeCartBookings`

No alternate unit-picking logic elsewhere.

### Client preview

Add server action `quoteListing(input: { roomId, subcategoryId, checkIn, checkOut, guests })`:

1. Validates dates and subcategory
2. Runs same `assignAvailableUnit` + `quoteRange` as checkout
3. Returns `{ ok, total, nights, roomNumber? }` or `{ ok: false, error }`

Book dialog and room detail sidebar call this action for date-range previews instead of client-side `listingQuoteContext`.

### Tests

- Unit test: rooms 102/103/104 in one subcategory, 102 booked → assigns 103
- Unit test: recompute sets `fromPriceCents` correctly for Lake View Queen (23700)
- Integration: quoteListing total matches finalizeCartBookings for same inputs

---

## Public listings query

`getPublicRoomListings()` changes:

- Include `fromPriceCents`, `hasWeekendRates` on each subcategory
- Stop relying on catalog `priceRules` for display
- Optional: attach **cheapest unit’s** `basePrice` + `priceRules` for detail-page weekday table (all values from DB, loaded server-side)

`PublicRoomListing` type: subcategory includes `fromPriceCents`, `hasWeekendRates`.

---

## UI changes

| Component                     | Before                                    | After                                          |
| ----------------------------- | ----------------------------------------- | ---------------------------------------------- |
| `room-card.tsx`               | `formatPrice(fromPrice(room))`            | `formatPrice(room.subcategory.fromPriceCents)` |
| `room-card.tsx` “from” prefix | `room.priceRules.length > 0`              | `room.subcategory.hasWeekendRates`             |
| `rooms-browser.tsx` sort      | `fromPrice(a) - fromPrice(b)`             | `fromPriceCents` on subcategory                |
| `book-room-dialog.tsx`        | client `quoteRange(listingQuoteContext…)` | `quoteListing` server action                   |
| `room-booking-sidebar.tsx`    | same                                      | `quoteListing` server action                   |

---

## Data repair (one-time migration)

Run after schema migration:

1. **Sync base prices:** Update 7 inventory rooms where `Room.basePrice ≠ RoomSubcategory.basePrice` (Twin Lower Level at 12900 vs subcategory 11900) — set room base to match subcategory or run targeted sync per admin intent (default: match subcategory `basePrice`).

2. **Recompute** `fromPriceCents` + `hasWeekendRates` for all subcategories with inventory.

3. **Delete orphan subcategories** (zero inventory units):

   - `KING` / Lower Level
   - `SUITE` / Lower Level

   Hard delete rows; no soft-hide.

Script: `scripts/recompute-subcategory-prices.ts` (also callable from seed).

---

## Admin changes

- After any mutation that affects room or subcategory pricing, call `recomputeSubcategoryPricing`
- `bumpLakeViewSubcategoryPrices`: after transaction, recompute affected Lake View subcategories
- Subcategories manager: optionally display read-only `fromPriceCents` column (nice-to-have, not blocking)

---

## File map

| File                                                                                                | Change                                               |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `prisma/schema.prisma`                                                                              | Add columns + migration                              |
| `lib/subcategory-pricing.ts`                                                                        | Recompute helpers                                    |
| `lib/inventory.ts`                                                                                  | Document assignment order; ensure all callers use it |
| `lib/queries.ts`                                                                                    | Listings include stored pricing fields               |
| `lib/rooms.ts`                                                                                      | Remove computed listing pricing helpers              |
| `app/actions.ts`                                                                                    | Quotes from assigned unit; add `quoteListing`        |
| `app/admin/actions.ts`                                                                              | Recompute hooks after price edits                    |
| `components/room-card.tsx`, `rooms-browser.tsx`, `book-room-dialog.tsx`, `room-booking-sidebar.tsx` | DB-backed display + server quotes                    |
| `prisma/seed.ts`                                                                                    | Recompute after seed                                 |
| `scripts/recompute-subcategory-prices.ts`                                                           | Backfill + orphan delete                             |
| `lib/subcategory-pricing.test.ts`                                                                   | Recompute + assignment tests                         |

Remove or replace `lib/rooms.pricing.test.ts` tests for deleted helpers.

---

## Success criteria

- Queen Lake View card shows **$237** (from `fromPriceCents`), matching admin
- Fri/Sat checkout uses inventory unit rules (**$297** for bumped Lake View Queen), not catalog rules
- No `weekendPriceForBase` / `getEffectivePriceRules` in guest-facing read paths
- Booking assigns lowest available room number within subcategory
- `Booking.subcategoryId` populated on new bookings
- Orphan subcategories removed from DB

---

## Rollout

1. Prisma migrate
2. Backfill script (sync, recompute, delete orphans)
3. Code changes (queries → actions → UI)
4. Remove dead helpers + update tests
5. Manual smoke: homepage, room detail, cart checkout, admin inventory edit → card price updates
