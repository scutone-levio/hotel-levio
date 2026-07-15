# CSV Export — Design Spec

**Date:** 2026-07-15
**Feature:** Export reservations to CSV for admin (filtered) and customers (all their bookings)

---

## Overview

Two independent CSV export endpoints: one for admins that respects the active filter state in the reservations table, and one for authenticated customers that exports all their bookings. Both are plain GET API routes that return a file download response — the client triggers them with `window.location.href`.

---

## API Routes

### `GET /api/export/admin/bookings`

- **Auth:** Session required; `user.role` must be `"ADMIN"` — returns `401` if unauthenticated, `403` if wrong role
- **Query params:** `status` (ALL | PENDING | CONFIRMED | CANCELLED), `search` (string), `roomId` (string) — same filter shape as `getBookings()` in `app/admin/actions.ts`
- **Query:** Fetches all matching bookings (no pagination) ordered by `createdAt` desc, including `room` and `user`
- **Response:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="reservations-YYYY-MM-DD.csv"`
- **Empty result:** Returns a valid CSV with only the header row

### `GET /api/export/customer/bookings`

- **Auth:** Session required; `user.role` must be `"CUSTOMER"` — returns `401`/`403` otherwise
- **Query params:** None — scoped to `userId` from session
- **Query:** All bookings for the authenticated user ordered by `checkIn` desc, including `room`
- **Response:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="my-reservations-YYYY-MM-DD.csv"`
- **Empty result:** Returns a valid CSV with only the header row

---

## CSV Columns

### Admin export

| Column | Source |
|---|---|
| Booking ID | `id` (full UUID) |
| Guest Name | `guestName ?? user.name` |
| Guest Email | `guestEmail ?? user.email` |
| Guest Phone | `guestPhone` |
| Room | `room.name` |
| Room Number | `room.roomNumber` |
| Room Type | `room.type` |
| Check-in | `checkIn` formatted as `YYYY-MM-DD` |
| Check-out | `checkOut` formatted as `YYYY-MM-DD` |
| Nights | `differenceInCalendarDays(checkOut, checkIn)` |
| Guests | `guests` |
| Total (CAD) | `totalPrice / 100` formatted as `0.00` |
| Status | `status` |
| Special Requests | `specialRequests` |
| Stripe Session ID | `stripeSessionId` |
| Created | `createdAt` formatted as `YYYY-MM-DD` |

### Customer export

| Column | Source |
|---|---|
| Booking ID | last 8 chars of `id` uppercased (matches UI display) |
| Room | display name — first segment before ` · ` in `room.name` |
| Check-in | `YYYY-MM-DD` |
| Check-out | `YYYY-MM-DD` |
| Nights | computed |
| Guests | `guests` |
| Total (CAD) | formatted as `0.00` |
| Status | `status` |
| Special Requests | `specialRequests` |

### CSV serialization

Built with a plain string builder — no external library. Fields containing commas, double-quotes, or newlines are wrapped in double-quotes; internal double-quotes are escaped as `""`.

---

## UI

### Admin — `ReservationsTable`

An "Export CSV" button (with a `Download` lucide icon, `variant="outline"`, `size="sm"`) is added to the right end of the existing filter bar:

```
[ 🔍 Search… ] [ All ] [ Pending ] [ Confirmed ] [ Cancelled ]   [ ↓ Export CSV ]
```

On click, the component constructs the URL from its current `statusFilter`, `debouncedSearch`, and `roomId` state, then sets `window.location.href` to trigger the browser download. The button is disabled for 1 second after click (visual feedback, prevents double-clicks).

The button is not rendered when `roomId` is set (the per-room mini-table inside a room detail view doesn't need an export).

### Customer — Reservations page

A single "Export CSV" button (`variant="outline"`, `Download` icon) is rendered below the `PageHeader` subtitle on `/account/reservations`. It links to `/api/export/customer/bookings` via `window.location.href`. Only rendered when the customer has at least one booking.

Because the reservations page is a server component, the export button is extracted into a small `"use client"` component (`ExportCsvButton`) that handles the `onClick`.

---

## Auth & Error Handling

- Both routes call `auth()` inline — no middleware changes needed
- `401` if no session, `403` if wrong role
- DB errors are caught and return `500` with a plain-text body
- The existing `middleware.ts` already guards `/admin/*`; these routes do their own inline checks consistent with the webhook route pattern

---

## Files Changed

| File | Change |
|---|---|
| `app/api/export/admin/bookings/route.ts` | New — admin CSV route |
| `app/api/export/customer/bookings/route.ts` | New — customer CSV route |
| `lib/csv.ts` | New — shared CSV serialization helper |
| `components/admin/reservations-table.tsx` | Add Export CSV button to filter bar |
| `app/account/(dashboard)/reservations/page.tsx` | Add Export CSV button below PageHeader |
| `components/account/export-csv-button.tsx` | New — thin client component for the download trigger |

---

## Out of Scope

- Date range filtering (not requested)
- Excel/XLSX format
- Email delivery of the export
- Scheduled / automated exports
