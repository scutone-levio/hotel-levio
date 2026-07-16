# Dynamic Room Types — Design Spec

**Date:** 2026-07-16  
**Status:** Approved

## Overview

Replace the hardcoded `RoomType` Prisma enum with database-driven `RoomTypeDefinition` records so admins can create, edit, and archive room types without code changes. Extend inventory management with **archived rooms** (not hard-deleted), archival views for types/subcategories/rooms, and strict booking guards on destructive or reassignment actions.

## Goals

- Admin can add new room types that behave like Twin/Queen/King/Suite (catalog room, subcategories, inventory, pricing).
- Inventory rooms can be **archived**, reassigned to another type/subcategory, or **restored** from the archived list.
- Active bookings are protected: no archive, type change, or subcategory change when PENDING/CONFIRMED bookings exist on a room.
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
| `isActive` | Boolean @default(true) | `false` = archived room type |
| `createdAt`, `updatedAt` | DateTime | |

Relations: one catalog `Room` (`isCatalog: true`), many inventory `Room`s, many `RoomSubcategory`s.

### `Room` changes

| Change | Details |
|--------|---------|
| Remove | `type RoomType` enum field |
| Add | `roomTypeId String` FK → `RoomTypeDefinition` |
| Add | `archivedAt DateTime?` — archive timestamp; `null` = active room |

Catalog room: exactly one per type (`isCatalog: true`), created automatically when a type is created. Catalog rooms are never archived.

### `RoomSubcategory` changes

| Change | Details |
|--------|---------|
| Remove | `roomType RoomType` enum field |
| Add | `roomTypeId String` FK → `RoomTypeDefinition` |
| Add | `isActive Boolean @default(true)` — `false` = archived subcategory |

Unique constraint: `@@unique([roomTypeId, name])`.

### `Booking` changes

| Change | Details |
|--------|---------|
| Add | `roomTypeId String?` FK → `RoomTypeDefinition` — snapshot at booking creation for history when type is archived |

Existing `subcategoryId` continues to snapshot subcategory at booking time.

### Remove

- Prisma `enum RoomType` after migration and code refactor.
- `validateRoomAssignment()` and fixed `TYPE_TOTALS` from `lib/floor-plan.ts` (counts come from live inventory queries).
- Hardcoded `ROOM_TYPES` / `ROOM_TYPE_LABELS` constants as the source of truth (replace with DB queries + optional display helpers).

---

## Business rules

### Archive inventory room

1. Set `Room.archivedAt = now()`.
2. **Block** if the room has any booking with status `PENDING` or `CONFIRMED` (past or future).
3. Exclude from availability, assignment, and public/admin **active** inventory lists.
4. **Restore:** clear `archivedAt` if room number and type/subcategory assignment do not conflict.

Archived rooms must never receive new bookings.

### Change room type or subcategory

**Block** if the room has any `PENDING` or `CONFIRMED` booking. Admin must wait for bookings to complete or cancel them first.

Applies to both `roomTypeId` and `subcategoryId` changes on inventory units.

### Archive room type (`isActive: false`)

1. Hide type from public site (browse, tabs, new bookings).
2. **Block** if any non-archived inventory room of that type has a `PENDING` or `CONFIRMED` booking.
3. Keep type, catalog room, subcategories, and historical bookings visible in admin **Archived** views.

### Archive subcategory (`isActive: false`)

1. Hide from public listings and new booking paths.
2. **Block** if any non-archived room with that subcategory has a `PENDING` or `CONFIRMED` booking.
3. Visible in admin **Archived subcategories** view; restorable when safe.

### Reduce inventory quantity (catalog manager)

When target quantity decreases, **archive** removable units (no active bookings, not catalog), same as today’s surplus removal but archive instead of hard delete.

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
- **Archive** type with booking guard.
- Dynamic Room Types tabs loaded from active `RoomTypeDefinition` rows (replaces hardcoded Twin/Queen/King/Suite tabs).
- Quantity sync per type; slot hint shows live inventory count, not fixed floor-plan total.

### Inventory (`/admin/rooms`)

- Type and subcategory dropdowns loaded from DB (active types/subcategories only for assignment).
- **Archive** action per room row.
- Subcategory assignment on inventory row (new).

### Active | Archived views

Admin toggle or tab **Active | Archived** for:

| Entity | Archived when |
|--------|---------------|
| Room types | `isActive: false` |
| Subcategories | `isActive: false` |
| Inventory rooms | `archivedAt` is set |

**Archived rooms** (and types/subcategories) appear in read-only archived lists by default. **Restore** actions clear archive flags when no conflicts (duplicate room number, etc.).

---

## Public and booking queries

All guest-facing and availability paths filter:

- `RoomTypeDefinition.isActive: true`
- `RoomSubcategory.isActive: true` (where subcategory applies)
- `Room.archivedAt: null`
- Inventory rooms: `isCatalog: false`

Room detail “X rooms in the hotel” uses live count of active, non-archived inventory for that type.

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
| `prisma/schema.prisma` | New model, FK migration, `archivedAt` field |
| `lib/rooms.ts` | Replace static arrays with query helpers |
| `lib/queries.ts` | Load types from DB; active/archived filters |
| `lib/inventory.ts` | Archive/restore rooms, remove floor validation, typeId-based |
| `lib/floor-plan.ts` | Remove or slim down type-specific validation |
| `app/admin/actions.ts` | CRUD for types, archive/restore, guards |
| `components/admin/catalog-manager.tsx` | Dynamic tabs, create type UI |
| `components/admin/inventory-manager.tsx` | Subcategory, archive, dynamic type list |
| `components/admin/subcategories-manager.tsx` | Dynamic types, archive |
| New admin components | Active/Archived views, room type form/dialog |
| Public pages / `app/actions.ts` | Filter active/non-archived entities |

---

## Error handling

Server actions return `{ ok: false, error: string }` with clear messages, e.g.:

- “Cannot archive room: 1 active booking exists.”
- “Cannot change room type: 1 active booking exists.”
- “Cannot archive room type: 2 inventory rooms have active bookings.”

Never throw from server actions.

---

## Testing

- [ ] Migration preserves four legacy types and all existing bookings/listings.
- [ ] Create new type → catalog + tab + subcategory + inventory workflow works.
- [ ] Archive room without bookings; blocked with active booking.
- [ ] Type/subcategory change blocked with active booking; allowed when clear.
- [ ] Archive room type hidden on site; visible in admin Archived view.
- [ ] Archive subcategory; restore when safe.
- [ ] Archived room never appears in availability or checkout assignment.
- [ ] Admin Archived views list archived room types, subcategories, and archived rooms.
