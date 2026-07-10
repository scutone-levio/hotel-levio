# Lake View +25% Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Lake View +25% pricing premium (subcategories, inventory rooms, Fri/Sat rules) with an admin bulk action and permanent seed defaults.

**Architecture:** Shared pricing helpers live in `lib/subcategories.ts`. `subcategoryPriceForType()` encodes the permanent Lake View rule for seeds. `bumpLakeViewSubcategoryPrices()` runs a single Prisma transaction updating subcategory rows, then syncs inventory `Room.basePrice` and recalculates Fri/Sat `RoomPriceRule` prices from the new subcategory base. Admin UI in `SubcategoriesManager` triggers the action with a confirmation preview.

**Tech Stack:** Next.js 15 App Router, Prisma, PostgreSQL, date-fns (existing), admin server actions in `app/admin/actions.ts`, shadcn/ui dialog/button patterns.

## Global Constraints

- All prices stored in **cents** (integers); admin UI displays **dollars** via `parseDollarsToCents` / `formatPrice` / `centsToDollarsString`.
- Lake View subcategory name constant: `LAKE_VIEW_NAME = "Lake View"` from `lib/subcategories.ts`.
- Multipliers: `LAKE_VIEW_PRICE_MULTIPLIER = 1.25`, `WEEKEND_PRICE_MULTIPLIER = 1.25`.
- Rounding: `Math.ceil((cents * multiplier) / 100) * 100` (round up to whole dollar).
- Bulk subcategory bump: **+25% on current DB price** (not reset to catalog).
- Inventory `Room.basePrice`: **sync to new subcategory base** after bump.
- Fri/Sat rules (dayOfWeek 5 and 6): **`weekendPriceForBase(newSubcategoryBase)`**.
- Other weekday rules: **unchanged**.
- Existing bookings: **unchanged**.
- Server actions return `{ ok: true } | { ok: false; error: string }` — extend only for this action with a typed success payload.

---

## File map

| File | Responsibility |
|---|---|
| `lib/subcategories.ts` | Pricing helpers + permanent Lake View default in `subcategoryPriceForType` |
| `lib/subcategories.pricing.test.ts` | Unit tests for helpers (Node test runner via tsx) |
| `app/admin/actions.ts` | `bumpLakeViewSubcategoryPrices()` transaction |
| `components/admin/subcategories-manager.tsx` | Button, confirm dialog, preview, call action |
| `package.json` | Add `"test:unit"` script (optional but recommended) |

---

### Task 1: Pricing helpers + seed default

**Files:**
- Modify: `lib/subcategories.ts`
- Create: `lib/subcategories.pricing.test.ts`
- Modify: `package.json` (add `test:unit` script)

**Interfaces:**
- Produces:
  - `LAKE_VIEW_PRICE_MULTIPLIER: 1.25`
  - `WEEKEND_PRICE_MULTIPLIER: 1.25`
  - `applyPricePremium(cents: number, multiplier: number): number`
  - `weekendPriceForBase(baseCents: number): number`
  - Updated `subcategoryPriceForType(type, name)` — Lake View branch uses `applyPricePremium(CATALOG_BASE_PRICES[type], LAKE_VIEW_PRICE_MULTIPLIER)`

- [ ] **Step 1: Write the failing test**

Create `lib/subcategories.pricing.test.ts`:

```ts
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
    assert.equal(subcategoryPriceForType("QUEEN", LAKE_VIEW_NAME), 23700)
    assert.equal(subcategoryPriceForType("QUEEN", CITY_VIEW_NAME), 18900)
    assert.equal(subcategoryPriceForType("TWIN", LOWER_LEVEL_NAME), 11900)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`

Add to `package.json` scripts first if missing:

```json
"test:unit": "tsx --test lib/subcategories.pricing.test.ts"
```

Expected: FAIL — `applyPricePremium` / `weekendPriceForBase` not exported or wrong values.

- [ ] **Step 3: Implement helpers in `lib/subcategories.ts`**

Add after `CATALOG_BASE_PRICES`:

```ts
export const LAKE_VIEW_PRICE_MULTIPLIER = 1.25
export const WEEKEND_PRICE_MULTIPLIER = 1.25

/** Apply a multiplier and round up to the next whole dollar (cents). */
export function applyPricePremium(cents: number, multiplier: number): number {
  return Math.ceil((cents * multiplier) / 100) * 100
}

/** Fri/Sat override price derived from a subcategory base. */
export function weekendPriceForBase(baseCents: number): number {
  return applyPricePremium(baseCents, WEEKEND_PRICE_MULTIPLIER)
}
```

Update `subcategoryPriceForType`:

```ts
export function subcategoryPriceForType(
  type: RoomType,
  name: string,
): number {
  if (name === LOWER_LEVEL_NAME) return LOWER_LEVEL_PRICE
  if (name === LAKE_VIEW_NAME) {
    return applyPricePremium(
      CATALOG_BASE_PRICES[type],
      LAKE_VIEW_PRICE_MULTIPLIER,
    )
  }
  return CATALOG_BASE_PRICES[type]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit`  
Expected: PASS (all tests)

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/subcategories.ts lib/subcategories.pricing.test.ts package.json
git commit -m "Add Lake View pricing helpers and seed default premium."
```

---

### Task 2: Admin bulk action

**Files:**
- Modify: `app/admin/actions.ts`

**Interfaces:**
- Consumes: `LAKE_VIEW_NAME`, `LAKE_VIEW_PRICE_MULTIPLIER`, `applyPricePremium`, `weekendPriceForBase` from `@/lib/subcategories`
- Produces:

```ts
export type BumpLakeViewPricesResult =
  | {
      ok: true
      updated: Array<{
        roomType: RoomType
        subcategoryId: string
        oldPrice: number
        newPrice: number
        roomsUpdated: number
      }>
    }
  | { ok: false; error: string }

export async function bumpLakeViewSubcategoryPrices(): Promise<BumpLakeViewPricesResult>
```

- [ ] **Step 1: Add imports and result type**

At top of `app/admin/actions.ts`, add:

```ts
import {
  LAKE_VIEW_NAME,
  LAKE_VIEW_PRICE_MULTIPLIER,
  applyPricePremium,
  weekendPriceForBase,
} from "@/lib/subcategories"
```

Add `BumpLakeViewPricesResult` type export near `ActionResult`.

- [ ] **Step 2: Implement `bumpLakeViewSubcategoryPrices`**

Place after `updateRoomSubcategory` (pricing section):

```ts
const WEEKEND_DAYS = [5, 6] as const

export async function bumpLakeViewSubcategoryPrices(): Promise<BumpLakeViewPricesResult> {
  try {
    const subcategories = await prisma.roomSubcategory.findMany({
      where: { name: LAKE_VIEW_NAME },
    })

    if (subcategories.length === 0) {
      return { ok: false, error: "No Lake View subcategories found" }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const priceBySubcategoryId = new Map<string, number>()
      const summary: BumpLakeViewPricesResult extends { ok: true }
        ? BumpLakeViewPricesResult["updated"]
        : never = []

      for (const sub of subcategories) {
        const newPrice = applyPricePremium(
          sub.basePrice,
          LAKE_VIEW_PRICE_MULTIPLIER,
        )
        await tx.roomSubcategory.update({
          where: { id: sub.id },
          data: { basePrice: newPrice },
        })
        priceBySubcategoryId.set(sub.id, newPrice)
        summary.push({
          roomType: sub.roomType,
          subcategoryId: sub.id,
          oldPrice: sub.basePrice,
          newPrice,
          roomsUpdated: 0,
        })
      }

      const lakeViewRooms = await tx.room.findMany({
        where: {
          isCatalog: false,
          subcategory: { name: LAKE_VIEW_NAME },
        },
        include: { priceRules: true, subcategory: true },
      })

      for (const room of lakeViewRooms) {
        const subcategoryId = room.subcategoryId
        if (!subcategoryId) continue

        const newSubBase = priceBySubcategoryId.get(subcategoryId)
        if (newSubBase == null) continue

        await tx.room.update({
          where: { id: room.id },
          data: { basePrice: newSubBase },
        })

        const weekendPrice = weekendPriceForBase(newSubBase)

        for (const dayOfWeek of WEEKEND_DAYS) {
          const existing = room.priceRules.find((r) => r.dayOfWeek === dayOfWeek)
          if (existing) {
            await tx.roomPriceRule.update({
              where: { id: existing.id },
              data: { price: weekendPrice },
            })
          } else {
            await tx.roomPriceRule.create({
              data: { roomId: room.id, dayOfWeek, price: weekendPrice },
            })
          }
        }

        const entry = summary.find((s) => s.subcategoryId === subcategoryId)
        if (entry) entry.roomsUpdated += 1
      }

      return summary
    })

    revalidate()
    return { ok: true, updated }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update Lake View prices",
    }
  }
}
```

Note: This action intentionally **does not** use the generic `run()` helper because it returns a typed payload instead of bare `{ ok: true }`.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 4: Manual smoke test (dev DB)**

Run dev server, call action from a temporary script or wire UI in Task 3 first, then verify in Adminer:
- `RoomSubcategory` Lake View rows have new `basePrice`
- Inventory rooms with Lake View subcategory have matching `basePrice`
- Fri/Sat rules match `weekendPriceForBase(newSubBase)`

- [ ] **Step 5: Commit**

```bash
git add app/admin/actions.ts
git commit -m "Add admin bulk action to bump Lake View subcategory and room pricing."
```

---

### Task 3: Admin UI — button + confirmation dialog

**Files:**
- Modify: `components/admin/subcategories-manager.tsx`

**Interfaces:**
- Consumes: `bumpLakeViewSubcategoryPrices`, `BumpLakeViewPricesResult` from `@/app/admin/actions`
- Consumes: `LAKE_VIEW_NAME`, `applyPricePremium`, `LAKE_VIEW_PRICE_MULTIPLIER`, `weekendPriceForBase` from `@/lib/subcategories` (for client-side preview before submit)
- Consumes: `formatPrice`, `centsToDollarsString`, `ROOM_TYPE_LABELS`

- [ ] **Step 1: Add preview helper inside component file**

```ts
function lakeViewPreviewRows(
  subcategories: RoomSubcategoryWithCount[],
) {
  return subcategories
    .filter((s) => s.name === LAKE_VIEW_NAME)
    .sort((a, b) => ROOM_TYPES.indexOf(a.roomType) - ROOM_TYPES.indexOf(b.roomType))
    .map((sub) => {
      const newBase = applyPricePremium(sub.basePrice, LAKE_VIEW_PRICE_MULTIPLIER)
      return {
        sub,
        newBase,
        newWeekend: weekendPriceForBase(newBase),
      }
    })
}
```

Import `LAKE_VIEW_NAME`, `applyPricePremium`, `LAKE_VIEW_PRICE_MULTIPLIER`, `weekendPriceForBase`, and `Dialog` components if not already imported.

- [ ] **Step 2: Add state + handler**

```ts
const [bumpOpen, setBumpOpen] = React.useState(false)
const [bumpPending, startBumpTransition] = React.useTransition()

const lakeViewSubs = React.useMemo(
  () => subcategories.filter((s) => s.name === LAKE_VIEW_NAME),
  [subcategories],
)
const bumpPreview = React.useMemo(
  () => lakeViewPreviewRows(subcategories),
  [subcategories],
)

function handleBumpLakeView() {
  startBumpTransition(async () => {
    const result = await bumpLakeViewSubcategoryPrices()
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setSubcategories((prev) =>
      prev.map((s) => {
        const hit = result.updated.find((u) => u.subcategoryId === s.id)
        return hit ? { ...s, basePrice: hit.newPrice } : s
      }),
    )
    setBumpOpen(false)
    toast.success(
      `Lake View prices updated (${result.updated.reduce((n, u) => n + u.roomsUpdated, 0)} rooms synced)`,
    )
  })
}
```

- [ ] **Step 3: Add button + dialog JSX**

In the panel header (near room type selector or above the table), when `lakeViewSubs.length > 0`:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => setBumpOpen(true)}
  data-testid="bump-lake-view-prices"
>
  Increase Lake View prices by 25%
</Button>

<Dialog open={bumpOpen} onOpenChange={setBumpOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Increase Lake View prices by 25%?</DialogTitle>
      <DialogDescription>
        Updates all Lake View subcategory base prices, syncs inventory room
        base prices, and recalculates Friday/Saturday rules from the new
        base. Rounds up to the next whole dollar. Existing bookings are not
        affected. Running this again will apply another 25% increase.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-2 text-sm">
      {bumpPreview.map(({ sub, newBase, newWeekend }) => (
        <div key={sub.id} className="flex justify-between gap-4 border-b py-2">
          <span>{ROOM_TYPE_LABELS[sub.roomType]}</span>
          <span className="text-muted-foreground text-right">
            {formatPrice(sub.basePrice, "CAD")} → {formatPrice(newBase, "CAD")}
            <br />
            Fri/Sat: {formatPrice(newWeekend, "CAD")}
            <br />
            {sub._count.rooms} room{sub._count.rooms === 1 ? "" : "s"}
          </span>
        </div>
      ))}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setBumpOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleBumpLakeView} disabled={bumpPending}>
        {bumpPending ? "Updating…" : "Confirm increase"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Import `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle` from `@/components/ui/dialog` and `bumpLakeViewSubcategoryPrices` from `@/app/admin/actions`.

- [ ] **Step 4: Run typecheck + lint**

Run: `npm run typecheck`  
Run: `npm run lint -- --quiet components/admin/subcategories-manager.tsx app/admin/actions.ts`  
Expected: PASS (no new errors)

- [ ] **Step 5: Manual verification**

1. Open `/admin/catalog` → Subcategories
2. Click **Increase Lake View prices by 25%**
3. Confirm preview matches spec table (Queen $189 → $237, Fri/Sat $297)
4. Confirm → toast success
5. Refresh homepage; Lake View listing cards show new from-price
6. Open a Lake View inventory row in catalog manager; base price matches subcategory

- [ ] **Step 6: Commit**

```bash
git add components/admin/subcategories-manager.tsx
git commit -m "Add admin UI to bulk-increase Lake View prices by 25%."
```

---

## Plan self-review (spec coverage)

| Spec requirement | Task |
|---|---|
| `applyPricePremium` helper | Task 1 |
| `weekendPriceForBase` helper | Task 1 |
| Permanent Lake View seed default | Task 1 (`subcategoryPriceForType`) |
| Bulk subcategory +25% on current | Task 2 |
| Sync inventory `Room.basePrice` | Task 2 |
| Recalculate Fri/Sat from new base | Task 2 |
| Create missing Fri/Sat rules | Task 2 |
| Admin button + confirm dialog | Task 3 |
| Unit tests for helpers | Task 1 |
| Existing bookings unchanged | No code (by design) |

No placeholders remain. Types consistent across tasks.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-10-lake-view-pricing.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
