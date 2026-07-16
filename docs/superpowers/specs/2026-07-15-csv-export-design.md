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
- **Query params:** `status` (ALL | PENDING | CONFIRMED | CANCELLED), `search` (string), `roomId` (string) — same filter shape as `getBookings()` in `app/admin/actions.ts`, reusing its exact filter-building logic (not reimplemented) so the two never drift:
  - `status` omitted or `"ALL"` → no status filter (every status included). Any other value must be one of `PENDING`/`CONFIRMED`/`CANCELLED`; the route validates this itself (unlike `getBookings()`, which trusts its caller) since it's a directly-reachable HTTP boundary parsing raw query params — an unrecognized value returns `400` rather than reaching Prisma as an invalid enum filter.
  - `search` omitted or empty → no search filter. Otherwise, trimmed and matched case-insensitively (`contains`) against `guestName`, `guestEmail`, and `room.name` only — **not** `guestPhone` or `room.roomNumber` — identical to `getBookings()`.
  - `roomId` omitted → no room filter. A `roomId` that matches no booking yields an empty CSV (header row only), not an error — it is not validated as an existing room id.
  - The client (`ReservationsTable`) builds the query string with `URLSearchParams`, and any direct API caller must do the same (standard encoding of `status`/`search`/`roomId`) so both produce identical result sets for the same filter values.
- **Query:** Fetches all matching bookings (no pagination) ordered by `createdAt` desc, including `room` and `user`
- **Export size:** The full CSV is built in memory as a single string (see CSV serialization below), not streamed — `NextResponse` returns the complete body in one response. The query uses `take: 20_001` — one row beyond the 20,000-row export limit — so the overflow condition is detectable: `take: 20_000` alone would always return at most 20,000 rows and could never distinguish "exactly the limit" from "more than the limit." If the result has 20,001 rows, the route returns `413` with a plain-text error asking the admin to narrow the filters, rather than silently truncating the downloaded file; otherwise all returned rows (up to 20,000) are exported.
- **Response:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="reservations-YYYY-MM-DD.csv"`, `Cache-Control: private, no-store`
- **Empty result:** Returns a valid CSV with only the header row; still sent with `Cache-Control: private, no-store`

### `GET /api/export/customer/bookings`

- **Auth:** Session required; `user.role` must be `"CUSTOMER"` — returns `401`/`403` otherwise
- **Query params:** None — scoped to `userId` from session
- **Query:** All bookings for the authenticated user ordered by `checkIn` desc, including `room`
- **Export size:** Built in memory as a single string, same as the admin route — not streamed. No explicit row cap: results are inherently bounded to one customer's own bookings, which is orders of magnitude smaller than the admin export's full-table scope.
- **Response:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="my-reservations-YYYY-MM-DD.csv"`, `Cache-Control: private, no-store`
- **Empty result:** Returns a valid CSV with only the header row; still sent with `Cache-Control: private, no-store`

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
| Booking ID | last 8 chars of `id` uppercased — same suffix the UI shows, without the UI's leading `#` |
| Room | display name — first segment before ` · ` in `room.name` |
| Check-in | `YYYY-MM-DD` |
| Check-out | `YYYY-MM-DD` |
| Nights | computed |
| Guests | `guests` |
| Total (CAD) | formatted as `0.00` |
| Status | `status` |
| Special Requests | `specialRequests` |

### CSV serialization

Built with a plain string builder — no external library. Fields containing commas, double-quotes, or newlines are wrapped in double-quotes; internal double-quotes are escaped as `""`. Nullable fields (`specialRequests`, `stripeSessionId`) are serialized as an empty string, not the literal text `null` or `undefined`. Output is UTF-8 encoded and rows are joined with `\r\n` per RFC 4180, with no trailing blank line after the last row.

**Formula-injection neutralization:** User-controlled fields (Guest Name, Special Requests — and, for the admin export, values sourced from `guestName`/`guestEmail`/`guestPhone`/`room.name`) are checked after quoting logic but before the field is written: if the raw value starts with `=`, `+`, `-`, or `@`, it is prefixed with a leading single-quote (`'`) to neutralize spreadsheet formula execution when the file is opened in Excel/Sheets/LibreOffice (e.g. `=CMD()` becomes `'=CMD()`). This runs before the comma/quote/newline wrapping so a neutralized value that also needs quoting is still quoted correctly. `lib/csv.ts` exports this as `sanitizeCsvField`, applied to every field, not just the ones listed above, so future columns are protected by default.

Unit tests for `lib/csv.ts` cover: each trigger character (`=`, `+`, `-`, `@`) at the start of a value, the same characters appearing mid-value (must NOT be neutralized), and neutralization combined with values that also require comma/quote/newline quoting — applied to Guest Name and Special Requests in both exports.

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
- Admin route only: `400` with a plain-text body for an unrecognized `status` value; `413` with a plain-text body if the filtered result exceeds the 20,000-row export cap
- The existing `middleware.ts` already guards `/admin/*`; these routes do their own inline checks consistent with the webhook route pattern
- Every response — success, empty-result CSV, and `400`/`401`/`403`/`413`/`500` errors — is sent with `Cache-Control: private, no-store`, since these exports carry guest PII (names, emails, phone numbers) behind an authenticated GET and must never be stored by a shared CDN, corporate proxy, or browser cache

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
