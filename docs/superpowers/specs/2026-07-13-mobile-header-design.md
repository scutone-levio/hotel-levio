# Mobile Header — Design Spec

**Date:** 2026-07-13
**Status:** Approved

## Overview

Add a responsive mobile header to Hôtel Levio. Below the `lg` breakpoint (1024 px) the full desktop nav collapses into a hamburger button that opens a full-width slide-down flyout. The logo and "Book A Room" button remain visible in the header bar at all screen sizes.

## Header bar layout

### Desktop (≥ 1024 px) — unchanged

```
[HÔTEL LEVIO logo]    ABOUT US  CONTACT US  ADMIN  SIGN OUT  🛒  [BOOK A ROOM]
```

### Mobile (< 1024 px)

```
[HÔTEL LEVIO logo]                              🛒₃  [BOOK A ROOM]  [☰ / ✕]
```

- **Cart icon** — same `CartIcon` component and `cartIconTheme` styles; badge visible at all times.
- **Book A Room** — same gold-border button (`border border-[#c69456]`, gold text, hover fill). Padding unchanged; on very small screens (< 375 px) label may truncate naturally.
- **Hamburger / close** — Lucide `Menu` icon (closed) / `X` icon (open), both in `#f3ecda`. No label.

## Flyout panel

The panel is positioned `absolute; top: 100%; left: 0; right: 0` inside a `position: relative` `<header>` element, so it drops directly below the bar.

### Appearance

| Property | Value |
|---|---|
| Background | `#081a27` (matches header) |
| Bottom border | `border-b border-[#c69456]/20` |
| Link style | `siteNavLinkClassName` from `lib/site-chrome.ts` |
| Link padding | `px-6 py-4` per item |
| Divider | `border-t border-[#c69456]/20 my-2` between nav and account links |

### Content (in order)

**Nav links**
- About Us → `/about`
- Contact Us → `/contact`

**Divider**

**Account links** (conditional, same logic as `AccountNav`):
- Not signed in: Sign In → `/account/login`
- Customer: My Account → `/account`, Reservations → `/account/reservations`, Sign Out
- Admin: Admin → `/admin`, Sign Out

### Animation

- Enter: `translateY(-100%)` → `translateY(0)`, 200 ms ease-out CSS transition
- Exit: `translateY(0)` → `translateY(-100%)`, 150 ms ease-in
- Implemented via Tailwind `transition-transform duration-200 ease-out` + toggled `-translate-y-full` class
- The `<header>` element gets a `relative` class so the flyout can be absolutely positioned within it; the flyout is `z-40` to sit above page content

### Close triggers

- Click `✕` / hamburger toggle
- Click any link inside the flyout

## Component architecture

### Files changed

| File | Change |
|---|---|
| `components/header.tsx` | Add `relative` to `<header>`; render `<MobileNav>` alongside existing `<nav>`; hide desktop nav at `< lg` |
| `components/mobile-nav.tsx` | **New** — client component (see below) |

### `components/header.tsx` (server component — no change to `async` / `await auth()`)

```tsx
// Desktop nav gets:  className="hidden lg:flex items-center gap-6"
// New alongside it:
<MobileNav user={session?.user ?? null} />
```

### `components/mobile-nav.tsx` (new `"use client"`)

```tsx
"use client"
// Props: user: Session["user"] | null
// State: open: boolean
// Renders:
//   1. The mobile-only bar items (Cart + Book A Room + toggle)
//      — wrapped in  className="flex lg:hidden items-center gap-3"
//   2. The flyout panel  (absolute, translated, transitioning)
//      — reuses SiteNavLink, SignOutButton
//      — account links derived from user prop (same 3-branch logic as AccountNav)
//      — each link onClick closes the menu
```

`AccountNav` is **not changed** — its logic is small enough to inline in `MobileNav` directly.

## Reused components / styles

- `CartIcon` + `cartIconTheme` — unchanged
- `SiteNavLink` — used inside flyout
- `SignOutButton` — used inside flyout
- `siteNavLinkClassName`, `siteHeaderClassName` — unchanged
- `siteNavActionClassName` — used for Sign Out button in flyout

## What is NOT in scope

- Animations beyond the single slide-down (no staggered link entrance)
- Search or date-picker in the mobile menu
- Sticky / scroll-hide behaviour changes
- Any admin-dashboard header
