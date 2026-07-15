# Subcategory Images — Design Spec

**Date:** 2026-07-15  
**Status:** Approved  
**Branch context:** `main` (new feature)

## Problem

Public listings such as "Twin Room · City View" and "Twin Room · Lake View" are built from one catalog room per `RoomType` plus a `RoomSubcategory` overlay for name and pricing. Images come from the shared catalog room's `RoomImage` rows, so every subcategory under a type shows identical photos even when views differ materially (City View vs Lake View).

Admins can upload images per room in the catalog/inventory manage dialog, but there is no way to attach a distinct gallery to a subcategory.

## Goal

Allow admins to upload and manage images per **Room Type → Subcategory** (e.g. Twin · City View vs Twin · Lake View). Use subcategory images on all guest-facing surfaces. When a subcategory has no images yet, fall back to the catalog room's existing gallery.

## Non-goals (v1)

- Per-inventory-unit listing images (room numbers keep using catalog/subcategory galleries for marketing)
- Drag-and-drop image reordering (append by `sortOrder` like room images today)
- Auto-copying catalog images into every subcategory on migration
- Replacing or removing catalog-level image management (it becomes the fallback/default)
- Changing seed-time hardcoded `catalogImagesByType` beyond existing behavior
- New UploadThing endpoint (reuse `roomImage` constraints)

---

## Requirements summary

| Area | Decision |
|------|----------|
| Guest scope | Listing cards, room detail, book dialog, booking sidebar, cart/checkout previews, reserve page |
| Admin UX | **Manage** button per subcategory row in Subcategories manager (same pattern as Room Types) |
| Fallback | Subcategory gallery empty → catalog room `RoomImage` gallery |
| Storage | New `SubcategoryImage` model (mirror `RoomImage` shape) |
| Limit | Max 5 images per subcategory |
| Upload | UploadThing `roomImage` endpoint; delete file on remove (best-effort) |

---

## Architecture

### Data model

Add `SubcategoryImage` linked to `RoomSubcategory`:

```prisma
model SubcategoryImage {
  id            String          @id @default(cuid())
  subcategory   RoomSubcategory @relation(fields: [subcategoryId], references: [id], onDelete: Cascade)
  subcategoryId String
  url           String
  key           String?         // UploadThing file key
  sortOrder     Int             @default(0)
  createdAt     DateTime        @default(now())

  @@index([subcategoryId])
}
```

Add `images SubcategoryImage[]` to `RoomSubcategory`.

No seed migration of images into subcategories. Empty subcategories continue showing catalog photos until admin uploads.

### Image resolution

Single helper used by all guest surfaces:

```ts
resolveListingImages(
  catalogImages: Array<{ url: string; sortOrder: number; ... }>,
  subcategoryImages?: Array<{ url: string; sortOrder: number; ... }> | null,
): typeof catalogImages
```

- If `subcategoryImages?.length > 0` → return subcategory images (ordered by `sortOrder`)
- Else → return `catalogImages`

Place in `lib/rooms.ts` or a focused `lib/listing-images.ts` if preferred during implementation.

### Query changes

Extend subcategory fetches used for public listings and admin subcategories manager:

```ts
subcategory: {
  include: {
    images: { orderBy: { sortOrder: "asc" } },
  },
}
```

`RoomWithDetails` listings already include catalog `images` and `subcategory`; after the include change, `room.subcategory.images` is available without extra round-trips.

---

## Admin UI

### Subcategories manager (`components/admin/subcategories-manager.tsx`)

- Add a **Manage** button per subcategory row, matching `RoomManageDialog` trigger styling (`Settings2` icon + "Manage").
- Opens new `SubcategoryManageDialog` (images-only for v1).

### Subcategory manage dialog

New client component (e.g. `components/admin/subcategory-manage-dialog.tsx`):

- Dialog title: `{roomTypeLabel} · {subcategory.name} — Images`
- Reuse the images panel UX from `room-manage-dialog.tsx`:
  - 3-column thumbnail grid
  - Delete on hover
  - UploadThing `UploadDropzone` with `endpoint="roomImage"`
  - 5-image cap with hint text
- On upload complete → `addSubcategoryImage(subcategoryId, url, key)`
- On delete → `deleteSubcategoryImage(imageId)`

### Catalog admin (unchanged behavior, clarified copy)

Catalog **Room Types → Manage → Images** remains the default gallery. Optional helper text in catalog images panel: *"Used when a subcategory has no images of its own."*

Inventory room manage dialog: unchanged (`readOnly` images message for inventory units).

---

## Server actions

Add to `app/admin/actions.ts`:

| Action | Behavior |
|--------|----------|
| `addSubcategoryImage(subcategoryId, url, key?)` | Count existing images; reject if ≥ 5; create with `sortOrder = count` |
| `deleteSubcategoryImage(imageId)` | Delete row; best-effort UploadThing delete via `key` |

Follow existing `{ ok: true } \| { ok: false; error }` pattern and admin auth guard used by other admin mutations.

---

## Guest surfaces

All use `resolveListingImages(room.images, room.subcategory?.images)` (or pre-resolved array passed to components).

| File | Change |
|------|--------|
| `components/room-card-gallery.tsx` | Carousel images from resolver |
| `app/rooms/[slug]/page.tsx` | Gallery on detail page |
| `components/book-room-dialog.tsx` | `imageUrl` at add-to-cart |
| `components/room-booking-sidebar.tsx` | `imageUrl` at add-to-cart |
| `components/cart-checkout-form.tsx` | Display uses stored `imageUrl` (set upstream) |
| `app/reserve/page.tsx` | `imageUrl` for single-room checkout summary |

Cart schema (`lib/cart.tsx`) unchanged — `imageUrl` is captured at add-to-cart time from resolved first image.

---

## Error handling

- Upload over limit → `{ ok: false, error: "Maximum of 5 images per subcategory" }` (or match room wording)
- UploadThing / network errors → toast on client; server action returns `{ ok: false, error }`
- Missing subcategory on admin delete → standard not-found error from Prisma catch

---

## Testing

| Test | Scope |
|------|-------|
| Unit | `resolveListingImages` — subcategory images win; empty subcategory falls back; null subcategory falls back |
| Manual / optional e2e | Admin uploads City View image → browse listing shows new photo; Lake View unchanged |

---

## Files touched (expected)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `SubcategoryImage` model |
| `prisma/migrations/...` | Generated migration |
| `lib/rooms.ts` or `lib/listing-images.ts` | `resolveListingImages` |
| `lib/queries.ts` | Include subcategory images |
| `app/admin/actions.ts` | Add/delete subcategory image actions |
| `components/admin/subcategory-manage-dialog.tsx` | New |
| `components/admin/subcategories-manager.tsx` | Manage button + dialog |
| `components/room-card-gallery.tsx` | Resolver |
| `app/rooms/[slug]/page.tsx` | Resolver |
| `components/book-room-dialog.tsx` | Resolver for `imageUrl` |
| `components/room-booking-sidebar.tsx` | Resolver for `imageUrl` |
| `app/reserve/page.tsx` | Resolver for `imageUrl` |
| `lib/listing-images.test.ts` or `lib/rooms.test.ts` | Unit tests |

---

## Approaches considered

| Approach | Verdict |
|----------|---------|
| **A. `SubcategoryImage` model + resolver** | **Chosen** — clear ownership, minimal guest churn |
| B. Duplicate catalog rooms per subcategory | Rejected — breaks one-catalog-per-type architecture |
| C. JSON array on `RoomSubcategory` | Rejected — inconsistent with `RoomImage`/UploadThing patterns |

---

## Approval

Design reviewed and approved in brainstorming session (2026-07-15).
