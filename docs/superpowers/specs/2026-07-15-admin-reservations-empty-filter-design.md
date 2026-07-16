# Admin reservations — preserve filters on empty results

**Date:** 2026-07-15  
**Status:** Approved

## Problem

On `/admin`, clicking **Pending** or **Cancelled** (or any filter with zero matches) causes `ReservationsTable` to early-return with only “No reservations found.” The search bar, status pills, Export button, and table shell unmount because they are rendered after the empty guard.

## Solution

Always render admin table chrome when `!roomId`. Show empty and loading states **inside** the table area instead of replacing the whole component.

## Behavior

| State | Search + filters | Export | Table body |
|-------|------------------|--------|------------|
| First load | Visible | Disabled | In-table spinner |
| Refetch (filter/page) | Visible | Disabled while loading | Prior rows or spinner |
| Has results | Visible | Enabled | Data rows |
| No results | Visible | **Disabled** | “No reservations found.” |

Export is disabled when `loading`, `isExporting`, or `total === 0`.

## Implementation

Single-file change: `components/admin/reservations-table.tsx`

1. Remove early returns that omit the filter bar.
2. Always render toolbar + table frame when `!roomId`.
3. Render empty/loading in `<tbody>` (colSpan row).
4. Disable Export when there is nothing to export.

## Out of scope

- Stat-card click-to-filter
- API changes to `getBookings`
