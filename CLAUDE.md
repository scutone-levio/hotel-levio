# Hôtel Levio — Claude Design Guide

## Project Overview

Full-stack hotel booking application built with Next.js 15 App Router. Users browse rooms, pick dates, add items to a cart, and pay via Stripe. Admins manage rooms and reservations through a protected dashboard.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | NextAuth v5 (Auth.js) — Credentials provider, JWT |
| Database | PostgreSQL via Prisma ORM |
| Payments | Stripe (PaymentIntents, `@stripe/react-stripe-js`) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Email (dev) | Mailpit via Docker; nodemailer |
| File uploads | UploadThing |
| State | React Context (cart), TanStack Query (server data) |
| Date logic | date-fns |
| Validation | Zod |
| Testing | Playwright |

## Architecture

### Server vs. Client components

- **Server components** — pages that fetch data, layout shells, the `Header` and `Footer`. Never add `"use client"` unless interactivity is required.
- **Client components** — anything using hooks, `useState`, `useEffect`, browser APIs (`localStorage`, `sessionStorage`), or Stripe Elements. Always placed in `components/`, never directly in `app/`.

### File layout

```
app/
  actions.ts           # Server actions (single file for guest-facing actions)
  admin/actions.ts     # Server actions for admin mutations
  admin/page.tsx       # Admin dashboard (protected by middleware)
  cart/
    page.tsx           # Cart checkout shell (server)
    confirmation/page.tsx
  reservation/[bookingId]/page.tsx
  reserve/page.tsx
  rooms/[slug]/page.tsx
components/
  admin/
    reservations-table.tsx   # Paginated admin reservations (client)
    rooms-manager.tsx        # Room CRUD (client)
  book-room-dialog.tsx       # Date picker + add-to-cart dialog
  booking-picker.tsx         # Standalone date range picker
  cart-checkout-form.tsx     # Two-step cart checkout (client)
  cart-icon.tsx              # Header cart badge (client)
  home-content.tsx           # Room browser with date persistence
  reserve-form.tsx           # Single-room Stripe checkout (client)
lib/
  availability.ts     # Blackout date helpers + `isRangeAvailable`
  cart.tsx            # CartContext + CartProvider + useCart (localStorage-backed)
  email-templates.ts  # Branded HTML email builders
  mailer.ts           # nodemailer sendMail wrapper
  pricing.ts          # quoteRange — per-night pricing with weekday overrides
  queries.ts          # Shared Prisma query types (RoomWithDetails, etc.)
  rooms.ts            # fromPrice, formatPrice helpers
  stripe.ts           # Stripe server SDK singleton
prisma/
  schema.prisma
```

## Key Conventions

### Prices are always in cents (integers)

`basePrice`, `totalPrice`, `RoomPriceRule.price` — all stored and computed as cents. Use `formatPrice(cents, "CAD")` from `lib/rooms.ts` for display. Never pass floats to Stripe.

### Authoritative pricing happens server-side

Client-side `quoteRange` is for display only. Before any payment, `createCartPaymentIntent` (or the single-room path in `app/reserve/page.tsx`) re-quotes prices server-side and creates the PaymentIntent with the verified amount.

### Server actions pattern

```ts
// app/actions.ts
"use server"
export async function myAction(input: MyInput): Promise<{ ok: true; ... } | { ok: false; error: string }> {
  try {
    // validate, query, mutate
    return { ok: true, ... }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" }
  }
}
```

Always return `{ ok: true/false }` discriminated unions — never throw from server actions.

### Date handling

- All dates from the DB are JavaScript `Date` objects.
- Always use `startOfDay(new Date(isoString))` when converting user-supplied ISO strings server-side.
- Availability checks: `isRangeAvailable(room.blackouts, checkIn, checkOut)` from `lib/availability.ts`.
- Overlap check: `checkIn < existingCheckOut && checkOut > existingCheckIn` (half-open intervals).

### Cart (localStorage)

`lib/cart.tsx` provides `CartProvider` and `useCart`. Items are persisted to `localStorage` under key `hotellevio_cart`. Hydration happens in a `useEffect` to avoid SSR mismatch. `CartProvider` is mounted in `components/providers.tsx`.

### Email

Send with `sendMail({ to, subject, html, text? })` from `lib/mailer.ts`. Build subjects/bodies with helpers in `lib/email-templates.ts`. Email failures must never break the user-facing response — wrap in `.catch()` or a try/catch that logs but does not rethrow.

### Admin auth

`/admin` is protected by `middleware.ts` which checks the NextAuth session. Admin credentials are set via the seeder script. `ADMIN_EMAIL` constant used in server actions is `"sergio.cutone@levio.ca"`.

## Database

### Models

- **User** — `role: CUSTOMER | ADMIN`, optional `password` (hashed)
- **Room** — `basePrice` (cents), `capacity`, `type: TWIN | QUEEN | KING | SUITE`
- **RoomPriceRule** — per-`dayOfWeek` (0=Sun) price override in cents
- **RoomBlackout** — date ranges where the room cannot be booked
- **Booking** — links User + Room; stores `guestName/Email/Phone/specialRequests` directly (denormalized for edit/delete history); `status: PENDING | CONFIRMED | CANCELLED`

### Common queries

```ts
// Availability check
prisma.booking.findFirst({
  where: {
    roomId,
    status: { in: ["PENDING", "CONFIRMED"] },
    checkIn: { lt: checkOut },
    checkOut: { gt: checkIn },
  },
})

// Multi-booking transaction
prisma.$transaction(async (tx) => { ... })
```

## Running Locally

```bash
# 1. Copy and fill env vars
cp .env.example .env

# 2. Start Postgres + Mailpit
docker compose up -d

# 3. Install deps + migrate + seed
npm install
npx prisma migrate dev
npx tsx scripts/seed.ts   # or your seed script

# 4. Start dev server
npm run dev
```

- App: http://localhost:3000
- Mailpit (email UI): http://localhost:8025
- Adminer (DB UI): http://localhost:8080

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | NextAuth JWT signing key |
| `STRIPE_SECRET_KEY` | Stripe server SDK |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client SDK |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook validation |
| `UPLOADTHING_TOKEN` | UploadThing file uploads |
| `SMTP_HOST` / `SMTP_PORT` | SMTP server (Mailpit in dev) |
| `SMTP_FROM` | From address for emails |

## What NOT to do

- Do not use `"use client"` on page files — keep pages as server components.
- Do not throw from server actions — return `{ ok: false, error }` instead.
- Do not mutate prices on the client — re-quote server-side before charging.
- Do not block the booking response on email sends — fire-and-forget with `.catch()`.
- Do not import `lib/cart.tsx` in server components — it is client-only.
- Do not add `searchParams` as a synchronous prop in Next.js 15 — it is a `Promise<{...}>` and must be awaited.
