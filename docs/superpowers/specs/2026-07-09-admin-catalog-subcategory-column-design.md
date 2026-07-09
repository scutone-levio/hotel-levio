# Admin Catalog — Subcategory Column in "Rooms in this category" Table

**Date:** 2026-07-09
**Status:** Approved

## Problem

The "Rooms in this category" table in `/admin/catalog` shows floor, room number, base price, blackouts, and actions. It does not show which subcategory each inventory unit belongs to, making it hard to tell at a glance whether a room is assigned to e.g. "City View" vs "Lower Level" without opening the manage dialog.

## Solution

Add a **Subcategory** column between Room # and Base price. Render the subcategory name as plain muted text; show `—` when the room has no subcategory assigned.

## Scope

Single file: `components/admin/catalog-manager.tsx`

No query changes required — `RoomForAdmin = RoomWithDetails` already includes `subcategory: true` via the shared Prisma include, so `room.subcategory?.name` is available on every row without any additional fetch.

## Column Specification

| Property | Value |
|---|---|
| Header label | `Subcategory` |
| Position | Between Room # and Base price |
| Cell content | `room.subcategory?.name` when present; `—` when `null` |
| Cell style | `text-sm text-muted-foreground` — matches Floor column convention |
| Empty-state `colSpan` | Updated from `5` → `6` |

## What Does Not Change

- Prisma query in `lib/queries.ts` — no change
- `RoomForAdmin` / `RoomWithDetails` types — no change
- `RoomManageDialog` — no change
- Any other admin page or component — no change

## Exact Diff (prose)

1. In the `<thead>` row, insert `<th className="px-3 py-2 font-medium">Subcategory</th>` after the Room # header and before the Base price header.
2. In each `<tr>` inside `<tbody>`, insert `<td className="px-3 py-2 text-sm text-muted-foreground">{room.subcategory?.name ?? "—"}</td>` in the same position.
3. On the empty-state `<td>`, change `colSpan={5}` to `colSpan={6}`.
