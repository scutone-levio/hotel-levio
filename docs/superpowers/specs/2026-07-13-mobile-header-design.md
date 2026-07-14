# Mobile Header — Design Spec

**Date:** 2026-07-13
**Status:** Approved

## Overview

Add a responsive mobile header to Hôtel Levio. Below the `lg` breakpoint (1024 px) the full desktop nav collapses into a hamburger button that opens a full-width slide-down flyout. The logo and "Book A Room" button remain visible in the header bar at all screen sizes.

## Header bar layout

### Desktop (≥ 1024 px) — unchanged

```text
[HÔTEL LEVIO logo]    ABOUT US  CONTACT US  SIGN IN / MY ACCOUNT  SIGN OUT  🛒  [BOOK A ROOM]
```

### Mobile (< 1024 px)

```text
[HÔTEL LEVIO logo]                              🛒₃  [BOOK A ROOM]  [☰ / ✕]
```

- **Cart icon** — same `CartIcon` component and `cartIconTheme` styles; badge visible at all times.
- **Book A Room** — same gold-border button (`border border-[#c69456]`, gold text, hover fill) with the same padding as desktop (`px-5 py-2.5`); on very small screens (< 375 px) label may truncate naturally.
- **Hamburger / close** — Lucide `Menu` icon (closed) / `X` icon (open), both in `#f3ecda`. Visually icon-only, but exposes an accessible name via `aria-label` that changes with state ("Open menu" / "Close menu"), plus `aria-expanded` reflecting whether the flyout is open and `aria-controls` referencing the flyout panel's `id`.

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
- Admin: Sign Out (Admin link lives in the footer, not the header)

### Animation

- Enter: `translateY(-100%)` → `translateY(0)`, 200 ms ease-out CSS transition
- Exit: `translateY(0)` → `translateY(-100%)`, 150 ms ease-in
- Implemented via Tailwind `transition-transform` with state-dependent duration/easing classes: `translate-y-0 duration-200 ease-out` when open, `-translate-y-full duration-150 ease-in` when closed
- The flyout panel stays mounted at all times — closing only toggles classes (transform, `pointer-events-none`, `inert`), it is never conditionally unmounted — so the exit transition can play in full before the panel becomes non-interactive
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
| `components/account-nav.tsx` | Remove Admin link from header for signed-in admins (footer link only); admin branch now renders Sign Out only |
| `components/sign-out-button.tsx` | Accept optional `className` prop so the mobile flyout can apply block layout styles |

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

`AccountNav` is updated alongside the mobile work: the admin branch no longer renders an Admin header link (footer only), and `SignOutButton` accepts an optional `className` so `MobileNav` can reuse it inside the flyout with block padding. `MobileNav` mirrors the same three-branch account logic inline.

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
