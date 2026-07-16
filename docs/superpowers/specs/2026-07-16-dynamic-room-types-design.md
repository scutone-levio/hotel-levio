# Dynamic Room Types — Design Spec

**Date:** 2026-07-16  
**Status:** Approved

## Overview

Replace the hardcoded `RoomType` Prisma enum with database-driven `RoomTypeDefinition` records so admins can create, edit, deactivate, and archive room types without code changes. Extend inventory management with soft-delete for rooms, archival views for types/subcategories/rooms, and strict booking guards on destructive or reassignment actions.

## Goals

- Admin can add new room types that behave like Twin/Queen/King/Suite (catalog room, subcategories, inventory, pricing).
- Inventory rooms can be soft-deleted, reassigned to another type/subcategory, or restored from archive.
- Active bookings are protected: no soft-delete, type change, or subcategory change when PENDING/CONFIRMED bookings exist on a room.
- Flexible room numbering: no floor-plan slot restrictions for any type (new or legacy).

## Non-goals

- Auto-reassigning or cancelling bookings when inventory changes.
- Floor-plan slot suggestions or per-type floor constraints.
- Bulk import/export of room types.

---

## Data model

### New: `RoomTypeDefinition`

| Field | Type | Notes |
|-------|------|-------|
| `id` | cuid | Primary key |
| `slug` | String @unique | URL-safe identifier, e.g. `twin`, `accessible-king` |
| `name` | String | Display name, e.g. `Twin Room` |
| `description` | String | Catalog copy |
| `capacity` | Int | Max guests |
| `beds` | Int | Bed count for display |
| `basePrice` | Int | Catalog default nightly rate in **cents** |
| `sortOrder` | Int @default(0) | Tab/list ordering in admin and public UI |
| `isActive` | Boolean @default(true) | `false` = archived/deactivated type |
| `createdAt`, `updatedAt` | DateTime | |

Relations: one catalog `Room` (`isCatalog: true`), many inventory `Room`s, many `RoomSubcategory`s.

### `Room` changes

| Change | Details |
|--------|---------|
| Remove | `type RoomType` enum field |
| Add | `roomTypeId String` FK → `RoomTypeDefinition` |
| Add | `deletedAt DateTime?` | Soft delete; `null` = active |

Catalog room: exactly one per type (`isCatalog: true`), created automatically when a type is created.

### `RoomSubcategory` changes

| Change | Details |
|--------|---------|
| Remove | `roomType RoomType` enum field |
| Add | `roomTypeId String` FK → `RoomTypeDefinition` |
| Add | `isActive Boolean @default(true)` | `false` = archived subcategory |

Unique constraint: `@@unique([roomTypeId, name])`.

### `Booking` changes

| Change | Details |
|--------|---------|
| Add | `roomTypeId String?` FK → `RoomTypeDefinition` | Snapshot at booking creation for history when type is deactivated |

Existing `subcategoryId` continues to snapshot subcategory at booking time.

### Remove

- Prisma `enum RoomType` after migration and code refactor.
- `validateRoomAssignment()` and fixed `TYPE_TOTALS` from `lib/floor-plan.ts` (counts come from live inventory queries).
- Hardcoded `ROOM_TYPES` / `ROOM_TYPE_LABELS` constants as the source of truth (replace with DB queries + optional display helpers).

---

## Business rules

### Soft-delete inventory room

1. Set `Room.deletedAt = now()`.
2. **Block** if the room has any booking with status `PENDING` or `CONFIRMED` (past or future).
3. Exclude from availability, assignment, and public/admin active inventory lists.
4. **Restore:** clear `deletedAt` if room number and type/subcategory assignment do not conflict.

Soft-deleted rooms must never receive new bookings.

### Change room type or subcategory

**Block** if the room has any `PENDING` or `CONFIRMED` booking. Admin must wait for bookings to complete or cancel them first.

Applies to both `roomTypeId` and `subcategoryId` changes on inventory units.

### Deactivate room type (`isActive: false`)

1. Hide type from public site (browse, tabs, new bookings).
2. **Block** if any non-deleted inventory room of that type has a `PENDING` or `CONFIRMED` booking.
3. Keep type, catalog room, subcategories, and historical bookings visible in admin **archived** views.

### Archive subcategory (`isActive: false`)

1. Hide from public listings and new booking paths.
2. **Block** if any non-deleted room with that subcategory has a `PENDING` or `CONFIRMED` booking.
3. Visible in admin archived subcategories view; restorable when safe.

### Reduce inventory quantity (catalog manager)

When target quantity decreases, soft-delete removable units (no active bookings, not catalog), same as today’s surplus removal but soft delete instead of hard delete.

### New room type creation (admin)

Required fields: name, slug, description, capacity, beds, base price (entered as **dollars** in admin UI, stored as cents).

On create:

1. Insert `RoomTypeDefinition`.
2. Create catalog `Room` (`isCatalog: true`) with slug, amenities optional/empty, images manageable afterward.
3. Type appears in Room Types tabs and subcategory/inventory pickers.

---

## Admin UI

### Room Type management (`/admin/catalog`)

- **Create / edit** type form (fields above).
- **Deactivate** type (archive) with booking guard.
- Dynamic Room Types tabs loaded from active `RoomTypeDefinition` rows (replaces hardcoded Twin/Queen/King/Suite tabs).
- Quantity sync per type; slot hint shows live inventory count, not fixed floor-plan total.

### Inventory (`/admin/rooms`)

- Type and subcategory dropdowns loaded from DB (active types/subcategories only for assignment).
- **Soft delete** per room row.
- Subcategory assignment on inventory row (new).

### Archived views (new)

Admin toggle or tab **Active | Archived** for:

| Entity | Archived when |
|--------|---------------|
| Room types | `isActive: false` |
| Subcategories | `isActive: false` |
| Inventory rooms | `deletedAt` is set |

Archived lists are read-only by default; **Restore** actions clear archive flags when no conflicts (duplicate room number, etc.).

---

## Public and booking queries

All guest-facing and availability paths filter:

- `RoomTypeDefinition.isActive: true`
- `RoomSubcategory.isActive: true` (where subcategory applies)
- `Room.deletedAt: null`
- Inventory rooms: `isCatalog: false`

Room detail “X rooms in the hotel” uses live count of active, non-deleted inventory for that type.

On booking creation, set `Booking.roomTypeId` from the assigned room’s type at that moment.

---

## Migration strategy

1. Add `RoomTypeDefinition` and new FK/nullable columns; keep enum temporarily.
2. Seed four legacy types from current enum + `roomTypeMeta` seed data; backfill `roomTypeId` on `Room`, `RoomSubcategory`, and `Booking`.
3. Refactor application code to use FK-based queries.
4. Drop enum column and Prisma `RoomType` enum.
5. Update seed script to upsert `RoomTypeDefinition` instead of enum keys.

---

## Architecture / files (high level)

| Area | Change |
|------|--------|
| `prisma/schema.prisma` | New model, FK migration, soft-delete fields |
| `lib/rooms.ts` | Replace static arrays with query helpers |
| `lib/queries.ts` | Load types from DB; archived filters |
| `lib/inventory.ts` | Soft delete, remove floor validation, typeId-based |
| `lib/floor-plan.ts` | Remove or slim down type-specific validation |
| `app/admin/actions.ts` | CRUD for types, soft delete/restore, guards |
| `components/admin/catalog-manager.tsx` | Dynamic tabs, create type UI |
| `components/admin/inventory-manager.tsx` | Subcategory, soft delete, dynamic type list |
| `components/admin/subcategories-manager.tsx` | Dynamic types, archive |
| New admin components | Archived views, room type form/dialog |
| Public pages / `app/actions.ts` | Filter active/non-deleted entities |

---

## Error handling

Server actions return `{ ok: false, error: string }` with clear messages, e.g.:

- “Cannot delete room: 1 active booking exists.”
- “Cannot change room type: 1 active booking exists.”
- “Cannot deactivate room type: 2 inventory rooms have active bookings.”

Never throw from server actions.

---

## Testing

- [ ] Migration preserves four legacy types and all existing bookings/listings.
- [ ] Create new type → catalog + tab + subcategory + inventory workflow works.
- [ ] Soft-delete room without bookings; blocked with active booking.
- [ ] Type/subcategory change blocked with active booking; allowed when clear.
- [ ] Deactivate type hidden on site; visible in admin archived view.
- [ ] Archive subcategory; restore when safe.
- [ ] Soft-deleted room never appears in availability or checkout assignment.
- [ ] Admin archived views list inactive types, subcategories, and deleted rooms.
