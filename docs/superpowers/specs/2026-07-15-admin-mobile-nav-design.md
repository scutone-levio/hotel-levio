# Admin Mobile Nav & Sign Out — Design Spec

**Date:** 2026-07-15  
**Status:** Approved

## Overview

On viewports below `md` (768px), the admin sidebar is hidden and there is no navigation or sign-out path. Add a mobile header flyout mirroring the customer `MobileNav` interaction pattern, plus a desktop avatar dropdown for sign out.

## Breakpoints

| Viewport | Navigation | Sign out |
|----------|------------|----------|
| `< md` | Header flyout (hamburger) | Inside flyout |
| `≥ md` | Left sidebar | Avatar dropdown |

## Mobile flyout

Same interaction model as `components/mobile-nav.tsx`:

- Hamburger / close toggle with `aria-expanded`, `aria-controls`, `aria-label`
- Slide-down panel from header (`absolute top-full`, translate transition)
- Panel stays mounted; closed state uses `inert` + `pointer-events-none`
- Closes on toggle or link click

**Light admin styling:** `bg-background`, standard borders and text, `hover:bg-muted` on links.

**Content:** admin nav links → divider → View site → Sign out.

## Desktop dropdown

Replace static avatar with `DropdownMenu` trigger (same gold initials badge). Items: name/email label, Sign out. Hidden on `< md`.

## Components

| File | Change |
|------|--------|
| `components/admin/admin-nav-items.ts` | Export shared `ADMIN_NAV_ITEMS` and link helpers |
| `components/admin/admin-mobile-nav.tsx` | New — mobile flyout |
| `components/admin/admin-profile-dropdown.tsx` | New — desktop avatar menu |
| `app/admin/layout.tsx` | `relative` header; wire mobile nav + dropdown |

## Out of scope

- Customer-site admin link changes
- Sheet/drawer nav pattern
- Shared primitive extracting customer + admin flyouts
