# Profile Dropdown — Desktop Header

**Date:** 2026-07-14
**Branch:** feature/customer-account-auth

## Problem

The desktop header currently exposes "My Account", "Reservations", and "Sign Out" as flat nav links, crowding the top bar. The goal is to collapse them behind a profile icon that reveals a dropdown on click, keeping the header clean while preserving full account navigation.

## Design

### Desktop nav order (right side)

| Auth state | Layout |
|---|---|
| Logged out | About Us · Contact Us · **Sign in** · **👤** · 🛒 · Book a Room |
| Logged in (customer) | About Us · Contact Us · **👤 ▾** · 🛒 · Book a Room |
| Logged in (admin) | About Us · Contact Us · **👤 ▾** · 🛒 · Book a Room |

### Auth-state behaviour

**Logged out**
- "Sign in" renders as a `SiteNavLink` to `/account/login`
- The `UserCircle` icon renders as a `<Link>` to `/account/login`
- Both are direct links — no dropdown
- Both sit as separate children of the nav's `flex gap-6`, so spacing is consistent with all other nav items

**Logged in — customer**
- Only the `UserCircle` icon is shown (no text beside it)
- Icon is a `DropdownMenuTrigger` button; click opens the dropdown
- Dropdown content (`align="end"`):
  - My account → `/account`
  - Reservations → `/account/reservations`
  - `DropdownMenuSeparator`
  - Sign out (calls `signOut({ callbackUrl: "/" })`)

**Logged in — admin**
- Same `UserCircle` icon trigger
- Dropdown content:
  - Sign out only

### Cursor & interaction

The global `a, button:not(:disabled) { cursor-pointer }` rule in `globals.css` covers all three interactive elements (Sign in link, icon link, dropdown trigger button). No extra cursor classes required on individual elements.

### Dropdown styling

`DropdownMenuContent` uses the default shadcn white-background style. This is intentional — the white panel contrasts against the dark navy header, making items legible without a custom dark theme.

`DropdownMenuItem asChild` + `<Link>` for navigation items so they behave as real anchors (right-click → open in new tab, keyboard Enter navigation).

### Icon styling

`UserCircle` from lucide-react, `size-5`, styled `text-[#f3ecda]/80 hover:text-[#f3ecda] transition-colors` to match the muted-to-full ivory treatment of `siteNavLinkClassName`.

## Files

### New
- `components/profile-dropdown.tsx` — `"use client"`, ~60 lines; receives `user: Session["user"] | null`

### Modified
- `components/header.tsx` — replace `<AccountNav>` with `<ProfileDropdown>`; `ProfileDropdown` placed between Contact Us and the Cart `<span>`

### Deleted
- `components/account-nav.tsx` — fully superseded by `ProfileDropdown`

### Unchanged
- `components/mobile-nav.tsx` — already handles all auth states in the flyout
- `components/sign-out-button.tsx` — still used by `MobileNav`
- `lib/site-chrome.ts` — no new tokens needed

## Prerequisites

Run `npx shadcn@latest add dropdown-menu` before implementation to install `components/ui/dropdown-menu.tsx`.
