# Account reservations page UI polish

**Date:** 2026-07-16  
**Status:** Implemented

## Problem

The account dashboard sidebar, reservations tabs, and booking cards use default muted/grey styling that doesn't match the hotel's navy/gold brand used elsewhere (admin nav, catalog tabs, room cards).

## Solution

Targeted class updates in `account-shell.tsx` and `reservations-list.tsx`.

### Sidebar (`AccountShell`)

| State | Background | Text |
|-------|------------|------|
| Default | transparent | muted |
| Hover (inactive) | `#0f2a3d` | white |
| Active | `#c69456` | `#0f2a3d`, medium weight |

Applies to Profile and Reservations links on all account dashboard routes.

### Tabs (`ReservationsList`)

- `TabsList`: white background with border (`bg-white border`)
- Active `TabsTrigger`: navy `#0f2a3d` background, white text

### Reservation cards

- White background, border retained
- Listing shadow from `room-card.tsx` with subtle hover lift

### Main content panel (`AccountShell`)

The right column wraps page content in a white card (`bg-white`, border, `rounded-2xl`, listing shadow, `p-6 lg:p-8`) so headers, forms, and lists read clearly against the cream page background. Sidebar nav remains on the cream background.

## Out of scope

- Login/register pages
- Profile form field styling, pagination bar, export button styling
