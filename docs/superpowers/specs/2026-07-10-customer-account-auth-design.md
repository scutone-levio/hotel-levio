# Customer Account, Auth & Reservations — Design Spec

**Date:** 2026-07-10  
**Status:** Approved  
**Branch context:** `main` (new feature)

## Problem

Guests can browse rooms and complete checkout without logging in. Checkout collects name, email, and phone inline and upserts a `User` by email at payment time. There is no customer-facing sign-up, profile management, or reservation history. Auth exists only for admins (`/login` → `/admin`) with mock credentials.

## Goal

Require a logged-in account before payment while keeping browse-and-date-selection open to everyone. Provide email/password plus Google and Facebook sign-in, a profile with full address, and a reservations area where customers view, cancel, change dates, and edit special requests on their own bookings.

## Non-goals (v1)

- Login required to browse rooms or pick dates on the home page / Book Now modal
- Linking or importing historical anonymous checkout bookings by email
- Guest-count changes on existing reservations
- Automated partial refunds when a date change lowers the price (hotel processes manually)
- Email verification flow
- Separate admin login route (admin continues using `/login`; customer uses `/account/login` or inline cart auth)

---

## Requirements summary

| Area | Decision |
|------|----------|
| Auth timing | Required at checkout/payment only |
| Providers | Email + password, Google, Facebook |
| Checkout UX | Inline auth on `/cart` (step before Stripe payment) |
| Profile | Name, read-only email, phone, full address, password change (credentials only) |
| Reservations | Upcoming + past lists; cancel, change dates (re-quote), edit special requests |
| Ownership | Only bookings where `booking.userId === session.user.id` |

---

## Architecture

Extend the existing NextAuth v5 (Auth.js) setup in `auth.ts`. Keep JWT sessions. Replace mock credentials with Prisma + bcrypt. Add Google and Facebook OAuth providers. Introduce a customer account route group under `/account/*` protected by middleware.

```text
Browse (public) → Cart → Inline auth → Stripe payment → Confirmation
                              ↓
                    /account (profile + reservations)
```

### Middleware

| Route pattern | Requirement |
|---------------|-------------|
| `/admin/*` | `role === ADMIN` (unchanged) |
| `/account/*` | Any authenticated user |
| `/cart`, `/reserve` | Public page; server actions enforce session at finalize |

Unauthenticated access to `/account/*` redirects to `/account/login?callbackUrl=…`.

### Header

- Logged out: **Sign in** → `/account/login`
- Logged in (CUSTOMER): **My account** menu → Profile, Reservations, Sign out
- ADMIN session: existing admin access unchanged; may also use account routes

---

## Authentication & registration

### Providers

1. **Credentials** — `prisma.user.findUnique({ where: { email } })` + `bcrypt.compare`
2. **Google** — Auth.js Google provider
3. **Facebook** — Auth.js Facebook provider

Env vars (Auth.js convention): `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_FACEBOOK_ID`, `AUTH_FACEBOOK_SECRET`.

### Email sign-up

Server action `registerCustomer`:

- Validate email (unique), password (min 8 characters), name (required)
- Hash password with bcrypt
- Create `User` with `role: CUSTOMER`
- Return `{ ok: true }` or `{ ok: false, error }`

No email verification in v1.

### Sign-in redirect rules

| Context | Redirect after success |
|---------|------------------------|
| Cart inline auth | `callbackUrl` (stay on `/cart`, advance to payment step) |
| `/account/login` | `/account` or `callbackUrl` |
| Admin credentials on `/login` | `/admin` (unchanged) |

### OAuth account creation

On first OAuth sign-in, create `User` if no row exists for that email (`role: CUSTOMER`, `password: null`). If a credentials account already exists for the email, link to that user (standard email match).

### Session payload

JWT + session carry: `id`, `email`, `name`, `role`. Replace hardcoded `demo-admin` / `demo-guest` IDs with real Prisma `user.id`.

### Shared UI components

- `AuthPanel` — tabs: Sign in | Create account | Google | Facebook buttons
- Reused on `/account/login`, `/account/register`, and inline on cart checkout

---

## Checkout flow changes

### Current

Cart → guest info form (name, email, phone) → Stripe → `finalizeCartBookings` upserts user by email.

### New

```text
Step 1: Review cart items
Step 2: Account (inline AuthPanel) — required before payment
Step 3: Stripe PaymentElement — enabled only when session exists
```

Single-room `/reserve` follows the same pattern: inline auth before payment.

### Server action changes

`finalizeCartBookings` and `finalizeBooking`:

- Call `auth()`; return `{ ok: false, error: "Sign in required" }` if no session
- Set `userId` from `session.user.id`
- Copy `name`, `email`, `phone` from `User` into denormalized booking guest fields
- Remove email-based `prisma.user.upsert` at checkout

`createCartPaymentIntent` may remain callable before auth (quote only); finalize remains gated.

### Profile pre-fill

When logged in, checkout skips manual guest-info fields. Name and phone come from the profile (user may update profile before paying).

---

## Account & profile

### Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/account/login` | `AccountLoginPage` | Customer sign-in |
| `/account/register` | `AccountRegisterPage` | Customer sign-up |
| `/account` | `AccountProfilePage` | View/edit profile |
| `/account/reservations` | `ReservationsListPage` | Upcoming + past tabs |
| `/account/reservations/[id]` | `ReservationDetailPage` | Detail + actions |

Layout: account shell with sidebar (Profile | Reservations), site header/footer.

### Profile fields

| Field | Editable | Storage |
|-------|----------|---------|
| Name | Yes | `User.name` |
| Email | No (display only) | `User.email` |
| Phone | Yes | `User.phone` |
| Address line 1 | Yes | `User.addressLine1` |
| Address line 2 | Yes | `User.addressLine2` |
| City | Yes | `User.city` |
| Province/state | Yes | `User.province` |
| Postal code | Yes | `User.postalCode` |
| Country | Yes | `User.country` (default `CA`) |
| Password | Yes (credentials only) | `User.password` (hashed) |

### Server actions (`app/account/actions.ts`)

- `updateProfile(input)` — Zod validation, update editable fields
- `changePassword({ currentPassword, newPassword })` — verify current, hash new; reject OAuth-only users

---

## Reservations management

### List (`/account/reservations`)

**Upcoming tab:** `status: CONFIRMED`, `checkOut >= today`, sorted `checkIn` asc.

**Past tab:** `status: CONFIRMED` with `checkOut < today`, plus `status: CANCELLED`, sorted `checkIn` desc.

Card: room name, date range, nights, total, status badge, link to detail.

### Detail (`/account/reservations/[id]`)

Read-only: room, dates, guests, total, special requests, booking ID, status.

**Actions (upcoming + CONFIRMED only):**

1. **Change dates** — date range picker → `resolveAndQuoteListing` re-quote
   - Price increase: create Stripe PaymentIntent for difference; persist only after payment succeeds
   - Price decrease: update booking `totalPrice` and dates; show message that refund will be processed by the hotel
   - Re-check availability server-side; reject overlaps/blackouts
2. **Edit special requests** — text field, immediate save
3. **Cancel** — confirmation dialog with policy text → `status: CANCELLED` (no automated refund in v1)

### Authorization

Every reservation query/mutation includes `where: { id, userId: session.user.id }`.

### Out of scope for reservation edits (v1)

- Guest count changes
- Room type / subcategory changes (cancel and rebook instead)

---

## Data model

### `User` additions

```prisma
phone        String?
addressLine1 String?
addressLine2 String?
city         String?
province     String?
postalCode   String?
country      String? @default("CA")
```

No new tables. `Booking` schema unchanged; `userId` FK remains the ownership link. Denormalized `guestName`, `guestEmail`, `guestPhone` on `Booking` stay as snapshots at booking time.

### Seed

Add demo customer `customer@hotel.test` with bcrypt password and 1–2 sample bookings for local dev. Admin seed unchanged.

---

## Error handling & security

- All account/reservation actions return `{ ok: true, … } | { ok: false, error: string }` (existing convention)
- Checkout finalize rejects missing session with user-facing message
- Password change requires current password verification
- OAuth secrets only in server env
- Date-change mutations re-run availability checks before write
- CSRF/session handled by NextAuth

---

## Testing

### Unit

- Booking list partition (upcoming vs past)
- Password validation rules
- Profile Zod schemas

### E2E (Playwright)

1. Register → add to cart → inline auth → pay → booking appears in `/account/reservations`
2. Cancel upcoming reservation
3. Update profile fields
4. Change reservation dates (mock Stripe for price increase path)

### Manual

- Google/Facebook OAuth redirect URLs in dev
- Admin login still works at `/login`
- Cart blocked at payment step when logged out

---

## File map (implementation reference)

| Area | Files |
|------|-------|
| Auth config | `auth.ts`, `types/next-auth.d.ts` |
| Middleware | `middleware.ts` |
| Account pages | `app/account/**` |
| Account actions | `app/account/actions.ts` |
| Auth UI | `components/auth-panel.tsx`, `components/account/**` |
| Checkout | `components/cart-checkout-form.tsx`, `components/reserve-form.tsx` |
| Header | `components/header.tsx` |
| Booking finalize | `app/actions.ts` |
| Schema | `prisma/schema.prisma`, migration |
| Seed | `prisma/seed.ts` |

---

## Open decisions (resolved)

| Question | Decision |
|----------|----------|
| When is auth required? | Checkout/payment only |
| OAuth providers? | Google + Facebook + email/password |
| Checkout auth UX? | Inline on cart |
| Reservation scope? | View, cancel, change dates, edit special requests |
| Anonymous booking history? | Not linked; only logged-in bookings shown |
| Profile fields? | Name, phone, full address, password change |
