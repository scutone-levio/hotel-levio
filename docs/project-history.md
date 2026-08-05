# Hôtel Levio — Project History

**Span:** Jul 8 – Jul 17, 2026
**24 PRs merged to `main` (#1–#24), 138 commits, 192 files touched, +18,398/-2,415 lines** — plus one feature in progress (see end of Jul 17).

## Wednesday, Jul 8 — Foundation

- Initial commit: Hotel Levio Demo AI Application — base Next.js 15 scaffold (App Router, Prisma/Postgres, Stripe, shadcn/ui, cart context).
- README, architecture/development guide, author info.
- **PR #1 – Add author** *(6 commits, small)*: README/author metadata. This bucket is larger than the 1-line change it sounds like because there's no earlier PR to attribute the repo's first 4 commits to — they were pushed straight to `main` before any PR workflow started, so they land in PR #1's range along with its own branch commit and merge commit. *(Per-PR commit counts throughout this document are computed as `git rev-list --count <previous PR merge>..<this PR merge>`, so they sum exactly to the 138-commit total above.)*
- **PR #2 – Room subcategories** *(2 commits · 10 files · +608/-21)*: added `RoomSubcategory` with parent-child relationships to `Room` — the foundational model every later listing/pricing/inventory feature builds on (e.g. Lower Level, City View).
- **PR #3 – Featured subcategory listings** *(14 commits · 25 files · +1,000/-235)*: subcategory-scoped featured listings and booking support; fixed availability filters to use listing keys (not bare room IDs); scoped subcategory lookups to the catalog room type; required subcategories when syncing new inventory units; fixed a featured-flag migration backfill that was targeting the wrong subcategory; kept seeded subcategory base prices in sync on re-seed; hardened admin pricing input validation; carousel accessibility fixes. Key files: `app/actions.ts`, `prisma/seed.ts`, `components/admin/subcategories-manager.tsx`, `lib/subcategories.ts` (new), `tests/featured.spec.ts` (new).

## Wednesday, Jul 9 — Listings, typography, brand chrome, pricing

- **PR #4 – Similar rooms recommendations** *(5 commits · 6 files · +234/-42)*: "similar rooms" now recommends from public subcategory listings instead of raw room types. Shipped with a design spec (`2026-07-09-similar-rooms-design.md`).
- **PR #5 – Typography refresh** *(8 commits · 34 files · +257/-128)*: updated font families for body/headings, bolder room-card titles, black-weight global headings, refreshed header/footer branding; Stylelint fix for a quoted Georgia serif stack.
- **PR #6 – Shared page headers & confirmation UI** *(6 commits · 13 files · +426/-259)*: introduced the shared `PageHeader` and confirmation components with brand colors (used by every page since); fixed the rooms browser's empty loading state; availability UX and date-gradient fixes.
- **PR #7 – Riviera Modernist heroes** *(3 commits · 3 files · +169/-24)*: new hero sections for About/Contact pages; fixed the contact-channel strip being cramped on mobile.
- **PR #8 – Lake View pricing** *(20 commits · 33 files · +2,352/-240, spans into Jul 10)*: moved listing pricing to be DB-backed (`fromPriceCents`), added a Lake View subcategory premium and admin tooling to bulk-increase Lake View prices by 25%; fell back to `basePrice` when `fromPriceCents` is zero; hardened booking flows (validation, payment checks, clearer quote errors); re-verified quoted cart units are still available at finalization (an early version of the TOCTOU-race hardening later generalized in PR #21/#22); added an index on `Booking.subcategoryId`. Largest early PR — shipped with both a plan (`plans/2026-07-10-lake-view-pricing.md`) and two design specs. Key files: `app/actions.ts` (+592/-…), `app/admin/actions.ts`, `lib/subcategory-pricing.ts` (new).

## Monday, Jul 13 — Customer accounts, hero UX, mobile

- **PR #9 – Customer account auth & checkout** *(6 commits · 55 files · +3,261/-479)* — the biggest single PR to date: account auth, reservations, checkout E2E coverage; security hardening from review; login `callbackUrl` now preserves the reservation destination; unique constraint added on `dateChangeStripePaymentId`. Key files: `app/account/actions.ts` (new, 392 lines), `components/account/reservation-detail.tsx` (new), `components/account/profile-form.tsx` (new), `components/auth-panel.tsx` (new), `auth.ts`, `tests/customer-checkout.spec.ts` (new). Shipped with a design spec (`2026-07-10-customer-account-auth-design.md`).
- **PR #10 – Hero search bar** *(4 commits · 11 files · +361/-182)*: replaced the hero date picker with a search bar + guest filtering; fixed guest prefill so it no longer overwrites user edits.
- **PR #11 – Mobile header** *(4 commits · 5 files · +224/-10)*: responsive mobile header with hamburger flyout.
- Admin table pagination + pointer cursors added site-wide (landed via PR #12 the next day).

## Tuesday, Jul 14 — Admin UX and code-quality hardening

- **PR #12 – Admin pagination & cursor** *(3 commits · 10 files · +137/-49)*: pagination now resets when filters/tabs change.
- **PR #13 – Profile dropdown** *(3 commits · 5 files · +378/-28)*: replaced flat account nav links with a profile-icon dropdown on desktop.
- **PR #14 – Booking CTA & nearby icons** *(2 commits · 3 files · +12/-5)*: aligned booking CTA and nearby-place icon styling with the site.
- **PR #15 – Carousel shadow & auth buttons** *(4 commits · 7 files · +127/-44)*: new `action` Button variant for light-surface CTAs, fixed the Apply button, carousel listing shadow, distinguished auth button variants.
- **PR #16 – ESLint/Sonar audit** *(6 commits · 25 files · +1,411/-600)*: added Sonar-style ESLint rules and fixed every reported violation; hardened date-change payments and inventory sync against partial failures. Key files: `app/account/actions.ts`, `components/room-image-carousel.tsx`, `lib/account-date-change.ts` (new), `components/cart-checkout-form.tsx`.
- Added Mermaid architecture/DB diagrams and `AGENTS.md` for AI-agent context.

## Wednesday, Jul 15 — Media, exports, mobile admin

- **PR #17 – Subcategory images** *(9 commits · 31 files · +2,014/-54)*: per-subcategory listing galleries with admin management + curated seed images; hardened uploads (image-host allowlist, transactional room-image adds); fixed `next/image` `remotePatterns` wildcard matching. Also added `docs/architecture.md`, `AGENTS.md`, and a Cursor skill for subcategory images. Key files: `components/admin/subcategory-manage-dialog.tsx` (new), `app/admin/actions.ts`, `lib/suite-subcategory-images.ts` (new).
- **PR #18 – CSV export** *(9 commits · 10 files · +1,301/-1)*: CSV serialization with formula-injection neutralization, admin + customer export routes/buttons, RFC 4180 bare-CR quoting fix, BOM/injection/status-validation hardening.
- **PR #19 – Admin reservations filter UI fix** *(3 commits · 2 files · +148/-90)*: fixed empty-filter state and filter-bar styling; accessible row-expand and filter buttons.
- **PR #20 – Admin mobile nav** *(3 commits · 7 files · +247/-27)*: admin mobile navigation, sign-out, and nav styling.

## Thursday, Jul 16 — Dynamic room types, pagination, account polish

- **PR #21 – Dynamic admin-managed room types** *(6 commits · 37 files · +2,808/-1,257)* — the largest PR by net change: replaced the hardcoded `RoomType` Prisma enum with DB-driven `RoomTypeDefinition` records (admin CRUD, archive/restore for types/subcategories/rooms). Hardened across several review passes: closed TOCTOU races between booking finalization and archive operations via row-level locking on `Room`/`RoomTypeDefinition`/`RoomSubcategory`, made inventory-quantity sync atomic, fixed catalog-room lookup and room-reassignment naming, and cleaned up a redundant duplicate filter condition. Key files: `app/admin/actions.ts`, `lib/inventory.ts`, `lib/room-archive.ts` (new), `lib/seed-types.ts` (new), `prisma/schema.prisma`, `components/admin/room-type-form-dialog.tsx` (new).
- **PR #22 – Reservations pagination** *(5 commits · 6 files · +457/-87)*: added 5/10/25/50 page-size pagination to admin and account reservations; hardened against stale fetches and out-of-range pages (request-generation guarding + page clamping so a delete or filter change can't leave the UI querying an invalid page); fixed account reservation pagination filters and error handling.
- **PR #23 – Account UI & brand gold polish** *(4 commits · 14 files · +158/-35)*: aligned the public brand gold to `#c69456`; fixed a WCAG contrast issue where the account sidebar's inactive nav links sat directly on the cream page background at a bare 4.51:1 ratio — moved to a navy tint (`text-[#0f2a3d]/70`, 7.61:1); scoped the admin theme's `beforeInteractive` init script correctly (kept in the admin layout rather than the root layout, since hoisting it site-wide would leak the admin theme onto public pages) and switched it to JSX children instead of `dangerouslySetInnerHTML`; explicit active-tab state on the reservations Save/Pay buttons for consistent `action` variant styling.

## Friday, Jul 17 — Admin UI polish, then Neo4j insights (in progress)

- **PR #24 – Admin UI polish** *(3 commits · 9 files · +47/-33)*: updated gold, navy CTAs, and cream-surface controls across the admin surface; room-manage-dialog's active tab styling switched from `bg-primary`/`text-primary-foreground` (which would've been unreadable, ~1.27:1, if paired with a navy background) to the `variant="blue"` token pairing (`bg-[#0f2a3d]`/`text-[#f3ecda]`, 12.56:1); scoped the admin-theme's forced-white `select-trigger`/outline-button backgrounds to light mode only (`.admin-theme:not(.dark)`) so they won't collide with dark-mode foreground colors if dark mode is ever wired up (it isn't currently — no `ThemeProvider` is mounted yet).
- **In progress, not yet merged** — `feature/admin-ui-polish` branch continued past PR #24 with a new **Neo4j-backed admin insights** feature *(6 commits · 16 files · +1,606/-3)*: graph client + sync script, `/app/admin/insights` page, nav wiring, and a Docker service for Neo4j; expanded to return full room relationships with complete amenity lists and render them as inline chips on the insights dashboard. Shipped with a plan and design spec (`2026-07-17-insights-relationship-samples-design.md`). Key files: `lib/graph-insights.ts` (new), `components/admin/insights-dashboard.tsx` (new), `app/admin/insights/page.tsx` (new).

---

## By the numbers

| | |
|---|---|
| Timespan | 10 days (Jul 8 – Jul 17, 2026) |
| Merged PRs | 24 (#1–#24) |
| Merged commits | 138 |
| Files touched (cumulative) | 192 |
| Net lines | +18,398 / -2,415 |
| Design specs written | 17 (`docs/superpowers/specs/`) |
| Automated test files | 15 (10 unit `*.test.ts`, 5 Playwright `*.spec.ts`) |
| In-progress (unmerged) work | Neo4j admin insights feature, 6 commits |

## Key files by feature area

| Area | Primary files |
|---|---|
| Booking/checkout server actions | `app/actions.ts`, `app/admin/actions.ts`, `app/account/actions.ts` |
| Subcategories & pricing | `lib/subcategories.ts`, `lib/subcategory-pricing.ts`, `components/admin/subcategories-manager.tsx` |
| Dynamic room types | `lib/inventory.ts`, `lib/room-archive.ts`, `lib/seed-types.ts`, `prisma/schema.prisma` |
| Customer account | `app/account/**`, `components/account/**`, `auth.ts` |
| Admin reservations/inventory tables | `components/admin/reservations-table.tsx`, `components/admin/inventory-manager.tsx`, `components/admin/room-manage-dialog.tsx` |
| CSV export | `lib/csv.ts`, `app/api/export/admin/bookings/route.ts` |
| Admin insights (in progress) | `lib/graph-insights.ts`, `components/admin/insights-dashboard.tsx` |

## Recurring threads across the project

- **Subcategories as the core organizing concept** (PR #2) — everything since (featured listings, similar-room recommendations, pricing, images, inventory sync) is scoped through `RoomSubcategory`, later joined by the dynamic `RoomTypeDefinition` model (PR #21).
- **Booking-race hardening** — re-verifying availability/price/active-state right before committing a booking shows up repeatedly and gets progressively more rigorous: PR #8 (re-check cart unit availability at finalization) → PR #21/#22 (row-level `FOR UPDATE` locking across `Room`/`RoomTypeDefinition`/`RoomSubcategory`, request-generation guarding on paginated fetches).
- **Admin pagination and list UX** — introduced in PR #12, extended with page-size options and stale-fetch/out-of-range hardening in PR #22, applied to reservations, catalog, and inventory tables.
- **Design specs first** — 17 specs across 10 days; most non-trivial features shipped with a spec doc before or alongside implementation (see `docs/superpowers/specs/`), e.g. featured listings, similar rooms, admin catalog subcategory column, Lake View pricing, customer account auth, dynamic room types, reservations pagination, account-page readability, and the in-progress insights feature.
- **Seed data kept in lockstep** — `prisma/seed.ts` is touched in nearly every structural PR (#2, #3, #8, #16, #17, #21) to keep demo data consistent with schema/pricing changes, rather than letting seed data drift.
- **Testing discipline** — unit tests (`lib/*.test.ts`) and Playwright specs (`tests/*.spec.ts`) land alongside the features they cover rather than after the fact: `tests/featured.spec.ts` with PR #3, `tests/customer-checkout.spec.ts` with PR #9, `lib/account-date-change.ts` tests with PR #16.
- **Brand/contrast polish** — a running theme in the most recent PRs (#23, #24): aligning gold/navy tokens site-wide and fixing WCAG contrast gaps as they're found (account sidebar nav, admin tab styling), plus defensive dark-mode CSS scoping ahead of an eventual theme toggle.
