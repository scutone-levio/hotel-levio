# Hero Search Bar — Design Spec

**Date:** 2026-07-13
**Status:** Approved

## Problem

The hero date input is a single combined "Check-in – Check-out" button. There is no guest count input on the home page, so users must set guest count per-room inside the booking dialog. Rooms that can't accommodate the party size stay visible until the user opens each one.

## Goal

Split the hero date trigger into separate Check In / Check Out fields, add a Guests counter, and filter the room listing to hide rooms whose capacity is below the selected guest count.

## Design

### State — `lib/date-range.tsx`

Extend `DateRangeContext` with `guests: number` (default 1, min 1, max 4) and `setGuests(n: number)`. Persist guests alongside `checkIn`/`checkOut` in sessionStorage key `hotellevio_date_range`. The context is mounted at the root (`Providers`) so state survives soft navigation; sessionStorage survives hard refresh within the same tab.

`MIN_GUESTS = 1`, `MAX_GUESTS = 4` exported as constants.

### Component — `components/hero-search-bar.tsx` (new)

Replaces `BookingPicker` in the hero. Three-segment pill container styled for the hero's navy/gold theme (absorbs the `bookingPickerTheme` object from `home-content.tsx`).

```text
┌──────────────────┬──────────────────┬──────────────────┐
│  📅 Check in     │  📅 Check out    │  👤 – 2 guests + │
│  Aug 18, 2026    │  Aug 21, 2026    │                   │
└──────────────────┴──────────────────┴──────────────────┘
```

Mobile: vertical stack with horizontal dividers.

Calendar: shared dual-month range picker anchored to the pill container via `PopoverAnchor`. Clicking either date segment opens it. Calendar content (nights count, Clear, Apply) is identical to the current `BookingPicker` popover. Guests `–`/`+` buttons stop click propagation to avoid triggering the calendar.

`BookingPicker` (`components/booking-picker.tsx`) becomes unused and is deleted.

### Filtering — `components/rooms-browser.tsx`

New prop `minGuests?: number`. The existing `filtered` memo adds: exclude rooms where `room.capacity < minGuests`. Subtitle updated to include guest count when `minGuests > 1` and dates are set.

### Pre-fill — `components/book-room-dialog.tsx`

Destructures `guests: heroGuests` from `useDateRange()`. On dialog open, syncs local `guests` state to `Math.min(heroGuests, room.capacity)`. Existing per-room capacity validation (`max={room.capacity}`) is unchanged.

### `components/home-content.tsx`

- Removes `BookingPicker` import and `bookingPickerTheme` object.
- Renders `<HeroSearchBar />` in place of the old picker wrapper.
- Reads `guests` from `useDateRange()` and passes `minGuests={guests}` to `RoomsBrowser`.
