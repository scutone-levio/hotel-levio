# Work Summary — Jul 13–17, 2026

16 PRs merged to `main` (#9–#24, 74 commits).

## Monday, Jul 13

- **PR #9 – Customer account auth & checkout**: account auth, reservations, checkout E2E coverage; security hardening from review; login `callbackUrl` now preserves the reservation destination; unique constraint added on `dateChangeStripePaymentId`.
- **PR #10 – Hero search bar**: replaced the hero date picker with a search bar + guest filtering; fixed guest prefill so it no longer overwrites user edits.
- **PR #11 – Mobile header**: responsive mobile header with hamburger flyout.
- Admin table pagination + pointer cursors added site-wide (landed via PR #12 the next day).

## Tuesday, Jul 14

- **PR #12 – Admin pagination & cursor**: pagination now resets when filters/tabs change.
- **PR #13 – Profile dropdown**: replaced flat account nav links with a profile-icon dropdown on desktop.
- **PR #14 – Booking CTA & nearby icons**: aligned booking CTA and nearby-place icon styling with the site.
- **PR #15 – Carousel shadow & auth buttons**: new `action` Button variant for light-surface CTAs, fixed the Apply button, carousel listing shadow, distinguished auth button variants.
- **PR #16 – ESLint/Sonar audit**: added Sonar-style ESLint rules and fixed every reported violation; hardened date-change payments and inventory sync against partial failures.
- Added Mermaid architecture/DB diagrams and `AGENTS.md` for AI-agent context.

## Wednesday, Jul 15

- **PR #17 – Subcategory images**: per-subcategory listing galleries with admin management + curated seed images; hardened uploads (image-host allowlist, transactional room-image adds); fixed `next/image` `remotePatterns` wildcard matching.
- **PR #18 – CSV export**: CSV serialization with formula-injection neutralization, admin + customer export routes/buttons, RFC 4180 bare-CR quoting fix, BOM/injection/status-validation hardening.
- **PR #19 – Admin reservations filter UI fix**: fixed empty-filter state and filter-bar styling; accessible row-expand and filter buttons.
- **PR #20 – Admin mobile nav**: admin mobile navigation, sign-out, and nav styling.

## Thursday, Jul 16

- **PR #21 – Dynamic admin-managed room types**: replaced the hardcoded `RoomType` Prisma enum with DB-driven `RoomTypeDefinition` records (admin CRUD, archive/restore for types/subcategories/rooms). Hardened across several review passes: closed TOCTOU races between booking finalization and archive operations via row-level locking on `Room`/`RoomTypeDefinition`/`RoomSubcategory`, made inventory-quantity sync atomic, fixed catalog-room lookup and room-reassignment naming, and cleaned up a redundant duplicate filter condition.
- **PR #22 – Reservations pagination**: added 5/10/25/50 page-size pagination to admin and account reservations; hardened against stale fetches and out-of-range pages (request-generation guarding + page clamping so a delete or filter change can't leave the UI querying an invalid page); fixed account reservation pagination filters and error handling.
- **PR #23 – Account UI & brand gold polish**: aligned the public brand gold to `#c69456`; fixed a WCAG contrast issue where the account sidebar's inactive nav links sat directly on the cream page background at a bare 4.51:1 ratio — moved to a navy tint (`text-[#0f2a3d]/70`, 7.61:1); scoped the admin theme's `beforeInteractive` init script correctly (kept in the admin layout rather than the root layout, since hoisting it site-wide would leak the admin theme onto public pages) and switched it to JSX children instead of `dangerouslySetInnerHTML`; explicit active-tab state on the reservations Save/Pay buttons for consistent `action` variant styling.

## Friday, Jul 17

- **PR #24 – Admin UI polish**: updated gold, navy CTAs, and cream-surface controls across the admin surface; room-manage-dialog's active tab styling switched from `bg-primary`/`text-primary-foreground` (which would've been unreadable, ~1.27:1, if paired with a navy background) to the `variant="blue"` token pairing (`bg-[#0f2a3d]`/`text-[#f3ecda]`, 12.56:1); scoped the admin-theme's forced-white `select-trigger`/outline-button backgrounds to light mode only (`.admin-theme:not(.dark)`) so they won't collide with dark-mode foreground colors if dark mode is ever wired up (it isn't currently — no `ThemeProvider` is mounted yet).
