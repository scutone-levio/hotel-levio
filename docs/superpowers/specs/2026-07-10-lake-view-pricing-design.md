# Lake View +25% Subcategory Pricing — Design Spec

**Date:** 2026-07-10  
**Status:** Approved (rev 2 — includes inventory rooms + weekend rules)  
**Branch context:** `main`

## Problem

Lake View subcategories currently use the same base prices as catalog/City View rates. The business wants Lake View listings priced **25% higher**, with:

1. A **one-time admin bulk action** that updates Lake View pricing across subcategories, inventory rooms, and weekend rules.
2. A **permanent default** so seeds and re-seeds set Lake View subcategory base to catalog × 1.25 (rounded up to the next whole dollar).

Guest-facing quotes use `getRoomPrice()` (subcategory base) plus per-room `RoomPriceRule` overrides for specific nights — both must stay coherent after the bump.

## Decisions (from brainstorming)

| Topic                      | Decision                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Subcategory scope          | All `RoomSubcategory` rows where `name === "Lake View"` (four room types)                               |
| Subcategory bulk           | **+25% on current DB price**, round up to whole dollar                                                  |
| Inventory `Room.basePrice` | **Sync to new subcategory base** for each Lake View room (same cents as its subcategory row after bump) |
| Weekday rules              | **Recalculate Fri/Sat from new subcategory base** → `applyPricePremium(newBase, 1.25)`                  |
| Other weekday rules        | Unchanged (only days 5 and 6 are reset)                                                                 |
| Permanent seed rule        | **Catalog base × 1.25** via `subcategoryPriceForType()`                                                 |
| Rounding                   | **Round up** to next whole dollar after each multiplier                                                 |
| Out of scope               | Existing bookings, catalog room rows, non–Lake View subcategories                                       |

## Pricing rules

### Shared helpers (`lib/subcategories.ts`)

```ts
export const LAKE_VIEW_PRICE_MULTIPLIER = 1.25
export const WEEKEND_PRICE_MULTIPLIER = 1.25

/** Apply a multiplier and round up to the next whole dollar (cents). */
export function applyPricePremium(cents: number, multiplier: number): number {
  return Math.ceil((cents * multiplier) / 100) * 100
}

/** Fri/Sat override price derived from a (post-bump) subcategory base. */
export function weekendPriceForBase(baseCents: number): number {
  return applyPricePremium(baseCents, WEEKEND_PRICE_MULTIPLIER)
}
```

### Subcategory examples (bulk starting from catalog-aligned seed)

| Type  | Current | After +25% (rounded up) | Fri/Sat rule (from new base) |
| ----- | ------- | ----------------------- | ---------------------------- |
| Twin  | $129    | $162                    | $203                         |
| Queen | $189    | $237                    | $297                         |
| King  | $229    | $287                    | $359                         |
| Suite | $399    | $499                    | $624                         |

### Permanent seed default (`subcategoryPriceForType`)

```ts
if (name === LOWER_LEVEL_NAME) return LOWER_LEVEL_PRICE
if (name === LAKE_VIEW_NAME) {
  return applyPricePremium(
    CATALOG_BASE_PRICES[type],
    LAKE_VIEW_PRICE_MULTIPLIER,
  )
}
return CATALOG_BASE_PRICES[type] // City View and others
```

`prisma/seed.ts` continues to upsert subcategory `basePrice` from `subcategoryPriceForType()`. Seed does **not** auto-resync inventory room bases or rules (bulk action handles live data).

## Architecture

### Bulk action transaction (`bumpLakeViewSubcategoryPrices`)

Single `prisma.$transaction`:

```text
1. Load all RoomSubcategory where name = LAKE_VIEW_NAME
   → abort if empty

2. For each subcategory row:
     newSubBase = applyPricePremium(row.basePrice, LAKE_VIEW_PRICE_MULTIPLIER)
     UPDATE RoomSubcategory SET basePrice = newSubBase
     Record map: subcategoryId → newSubBase

3. Load all inventory Room where subcategory.name = LAKE_VIEW_NAME
   (include priceRules)

4. For each room:
     newSubBase = map[room.subcategoryId]
     UPDATE Room SET basePrice = newSubBase

     For each RoomPriceRule where dayOfWeek IN (5, 6):
       UPDATE price = weekendPriceForBase(newSubBase)

     If room has no Fri/Sat rules, optionally CREATE them
     (match inventory.ts default for new units) — see edge cases
```

### Data flow

```text
SubcategoriesManager
  └─ Confirm dialog (preview subcategory + room counts per type)
  └─ bumpLakeViewSubcategoryPrices()
       └─ transaction (subcategories → rooms → Fri/Sat rules)
       └─ revalidatePath("/admin/catalog", "/")

Quotes (unchanged code path)
  └─ quoteRange(getRoomPrice(room), room.priceRules, ...)
       └─ base = new subcategory base
       └─ Fri/Sat nights = weekendPriceForBase(new subcategory base)
```

### Admin UI (`SubcategoriesManager`)

- Button: **“Increase Lake View prices by 25%”**
- Confirmation dialog shows per room type:
  - Subcategory: old → new base
  - Count of inventory rooms that will be updated
  - Example Fri/Sat rate after recalculation
- Warn: action is repeatable (+25% stacks); existing bookings unchanged
- On success: toast with summary; refresh subcategory list from response

## File changes

| File                                         | Change                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `lib/subcategories.ts`                       | Multipliers, `applyPricePremium`, `weekendPriceForBase`, update `subcategoryPriceForType` |
| `app/admin/actions.ts`                       | `bumpLakeViewSubcategoryPrices()` with full transaction                                   |
| `components/admin/subcategories-manager.tsx` | Button + confirm dialog + preview                                                         |

Optional follow-up (not required for initial implementation):

| File                    | Change                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `lib/inventory.ts`      | New units: set `basePrice` from subcategory base, Fri/Sat from `weekendPriceForBase` |
| Unit tests              | `applyPricePremium`, `weekendPriceForBase`                                           |
| Playwright / seed tests | Update hardcoded Lake View prices if asserted                                        |

## Edge cases

| Scenario                                      | Behavior                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Lake View room has no Fri/Sat rules           | Create Fri/Sat rules at `weekendPriceForBase(newSubBase)` (consistent with `inventory.ts` defaults) |
| Lake View room has custom rules on other days | Leave unchanged                                                                                     |
| Admin runs bulk action twice                  | Subcategory, room base, and Fri/Sat rules all increase again                                        |
| Re-seed after bulk                            | Subcategory rows reset to catalog × 1.25; inventory rooms/rules **not** reset by seed               |
| No Lake View subcategories                    | `{ ok: false, error: "..." }`                                                                       |
| Existing bookings                             | `Booking.totalPrice` unchanged                                                                      |

## Testing

### Unit tests

- `applyPricePremium`: 12900 → 16200, 18900 → 23700
- `weekendPriceForBase(23700)` → 29700 (237 × 1.25 = 296.25 → $297)

### Manual

1. Note Lake View subcategory prices and a sample inventory row + Fri/Sat rules in admin
2. Run bulk action; verify subcategory, room base, and weekend rules align per table above
3. Quote a Fri–Sun stay on a Lake View listing; confirm total uses new base + new weekend rule
4. Re-seed; confirm subcategory defaults only

## Success criteria

- All four Lake View subcategory rows bumped (+25%, round up)
- All Lake View inventory rooms show matching `basePrice` in admin catalog table
- Fri/Sat rules on Lake View rooms recalculated from new subcategory base
- Homepage and checkout quotes reflect updated pricing
- Seed sets Lake View subcategory defaults to catalog × 1.25 on fresh/re-seed
