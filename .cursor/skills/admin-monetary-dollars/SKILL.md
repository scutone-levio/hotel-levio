---
name: admin-monetary-dollars
description: >-
  Enforces that all monetary values in the admin UI are entered, displayed, and
  validated as dollars (not cents). Use when building or editing admin pages,
  forms, tables, server actions, or labels under app/admin/ or components/admin/,
  or when the user mentions admin pricing, base price, or monetary input.
---

# Admin monetary values — dollars, not cents

All monetary values in admin should be treated as dollars not cents.

## Storage vs admin UI

| Layer | Unit | Notes |
|-------|------|-------|
| Database (`basePrice`, `totalPrice`, `RoomPriceRule.price`, subcategory `basePrice`) | **Cents** (integers) | Unchanged — authoritative storage |
| Stripe / payment intents | **Cents** | Never pass dollar floats |
| **Admin UI** (forms, inputs, labels, helper text) | **Dollars** | Human-facing only |

Admin is a dollars surface; persistence stays in cents.

## Conversion rules

**Loading state from DB → admin input**

```ts
(room.basePrice / 100).toString()
```

**Saving admin input → server action / DB**

```ts
const dollars = Number(inputValue)
if (!Number.isFinite(dollars) || dollars < 0) { /* validate */ }
const cents = Math.round(dollars * 100)
```

- Use `Math.round(dollars * 100)` — never store floats as cents.
- Validate dollars before converting; server actions may still validate cents.

**Display-only (read from DB, no edit)**

```ts
import { formatPrice } from "@/lib/rooms"
formatPrice(room.basePrice, "CAD") // argument is always cents
```

## UI copy

- Labels: `Base price / night ($)`, `Price ($)`, etc.
- **Never** label admin fields as "cents" or ask admins to type cent amounts.
- Preview text under inputs may use `formatPrice(cents, "CAD")` after conversion.

## Reference implementation

Follow `components/admin/room-manage-dialog.tsx` (`PricingPanel`):

- State holds dollar strings
- `updateBasePrice(roomId, Math.round(dollars * 100))`
- Weekday overrides: dollars in UI, cents to `setPriceRule`

## Checklist for admin money changes

- [ ] Input labels and placeholders use dollars
- [ ] Form state initialized with `/ 100` from DB values
- [ ] Submit handlers multiply by `100` before calling server actions
- [ ] Server actions still accept/store **cents** (no schema change required)
- [ ] Tables and read-only views use `formatPrice(cents)` — not raw cent integers
- [ ] No `parseInt(price)` sent directly to DB without `* 100` when the UI collected dollars

## Common mistakes

```ts
// Wrong — treats DB cents as dollars in an input
setEditPrice(String(sub.basePrice))
await updateRoomSubcategory(id, name, parseInt(editPrice))

// Right
setEditPrice(String(sub.basePrice / 100))
await updateRoomSubcategory(id, name, Math.round(Number(editPrice) * 100))
```

```tsx
// Wrong
<Label>Base Price (cents)</Label>

// Right
<Label>Base price / night ($)</Label>
```

## Scope

Applies to:

- `app/admin/**`
- `components/admin/**`
- Admin-related server actions in `app/admin/actions.ts`

Does **not** change guest-facing cart/checkout display logic — only admin authoring conventions.
