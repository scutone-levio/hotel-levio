# Reservations pagination (admin + account)

**Date:** 2026-07-16  
**Status:** Approved

## Problem

Admin reservations (`/admin` and the room manage dialog embed) use fixed page sizes (10 and 5 respectively) with a minimal Previous/Next footer that only appears when there is more than one page. There is no page-size selector, unlike other admin lists (catalog, inventory, amenities) that use `AdminPagination` with **5 / 10 / 25 / 50**.

Customer account reservations (`/account/reservations`) load all bookings in one query with no pagination at all.

## Goals

- Add **5 / 10 / 25 / 50** page-size options to all reservation list surfaces.
- Pagination bar **always visible** (including zero results and single-page lists), matching other admin tables.
- **Same UX** on admin main view, admin room dialog embed, and customer account reservations.
- Account **Upcoming** and **Past** tabs each maintain **independent** page and page-size state.

## Non-goals

- URL search params for page/tab/size.
- Renaming `AdminPagination` to a neutral shared component name (acceptable follow-up).
- Changing public `rooms-browser` pagination (already 5/10/25/50).
- Paginating CSV export (export remains all matching rows).

---

## Shared pagination UI

**Component:** Reuse `AdminPagination` and `ADMIN_PAGE_SIZE_OPTIONS` from `components/admin/admin-pagination.tsx`.

**Always visible:** Render below each list even when `total === 0` or only one page:

- “Showing X–Y of Z” (0–0 of 0 when empty)
- Page-size selector enabled
- Previous / Next disabled at boundaries

**Default page size:** **10** on all surfaces (admin main, room dialog embed, both account tabs).

**On page-size change:** Reset to **page 1** for that list (or tab).

**Allowed sizes:** Server clamps `pageSize` to `[5, 10, 25, 50]`; invalid values fall back to 10.

---

## Admin reservations

**Files:** `components/admin/reservations-table.tsx` (primary), `app/admin/actions.ts` (`getBookings` — no query changes).

**Changes:**

1. Replace fixed `const pageSize = roomId ? 5 : 10` with `useState<AdminPageSize>(10)`.
2. Replace custom Previous/Next footer with `AdminPagination`.
3. Remove `totalPages > 1` guard — always render pagination.
4. Reset to page 1 when **status filter**, **debounced search**, or **page size** changes.

**Unchanged:**

- Filter bar, table shell, and export behavior on empty/loading states (per empty-filter spec).
- CSV export still fetches all matching bookings (no pagination).
- Server action `getBookings` signature and query logic.

---

## Customer account reservations

**New server action:** `getAccountBookings` in `app/account/actions.ts`:

```ts
getAccountBookings({
  tab: "upcoming" | "past",
  page?: number,
  pageSize?: number,
}): Promise<
  | { ok: true; bookings: BookingListRow[]; total: number }
  | { ok: false; error: string }
>
```

**Query rules:**

- Authenticated user only (`userId` from session).
- **Upcoming:** `checkOut >= startOfDay(today)`, `orderBy: { checkIn: "asc" }`.
- **Past:** `checkOut < startOfDay(today)`, `orderBy: { checkIn: "desc" }`.
- Pagination: `skip: (page - 1) * pageSize`, `take: pageSize`, plus `count` for total.
- Map rows with existing `getDisplayRoomName`.

**UI:** Refactor `components/account/reservations-list.tsx` to a client component:

- Separate `{ page, pageSize }` state for **upcoming** and **past** tabs.
- Fetch on mount and when tab/page/pageSize changes.
- Switching tabs preserves each tab’s page and size (no reset on tab change).
- `AdminPagination` below each tab’s card list, always visible.
- Loading spinner/skeleton in tab content; pagination shows total 0 during first load.

**Page shell:** `app/account/(dashboard)/reservations/page.tsx` — auth check only; remove bulk `findMany`. Client list loads paginated data via server action.

**Export CSV:** Unchanged — still exports all user bookings.

---

## Edge cases

| Case | Behavior |
|------|----------|
| Page out of range after filter shrink | Clamp to last valid page (same as `AdminPagination` / `usePaginatedList`) |
| Admin edit/delete | Existing `load()` refetch; page may shift — acceptable |
| Unauthenticated account fetch | Action returns `{ ok: false }`; client handles (redirect/toast) |
| Invalid pageSize on server | Clamp to allowed set; default 10 |

---

## Test plan

**Admin `/admin`**

- [ ] Page-size selector shows 5, 10, 25, 50; default 10
- [ ] Pagination visible with 0 results, 1 page, and many pages
- [ ] Changing page size resets to page 1
- [ ] Status filter and search reset to page 1
- [ ] Export still downloads all filtered rows

**Admin room dialog embed**

- [ ] Same page-size selector and always-visible pagination
- [ ] Defaults to 10 (not fixed 5)

**Account `/account/reservations`**

- [ ] Upcoming and Past tabs paginate independently
- [ ] Switching tabs preserves each tab’s page and page size
- [ ] Pagination always visible on both tabs
- [ ] Export CSV unchanged

---

## Implementation touchpoints

| File | Change |
|------|--------|
| `components/admin/reservations-table.tsx` | Wire `AdminPagination`, pageSize state |
| `app/account/actions.ts` | Add `getAccountBookings` |
| `components/account/reservations-list.tsx` | Client fetch + per-tab pagination |
| `app/account/(dashboard)/reservations/page.tsx` | Remove bulk query; auth shell only |
