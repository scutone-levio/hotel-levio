# Hôtel Levio — Reservation App

A modern full-stack hotel booking application built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS v4**, and **shadcn/ui**. Users browse rooms, pick dates, add items to a cart, and pay via Stripe. Admins manage rooms and reservations through a protected dashboard.

## Features

- 🏨 **Public homepage** with room browser, date-range picker, and room cards with availability
- 🛒 **Shopping cart system** with localStorage persistence and two-step checkout
- 💳 **Stripe integration** for secure payments with PaymentIntents
- 🛠️ **Admin dashboard** (`/admin`) with room management, pricing rules, reservations, and amenities
- 🔐 **NextAuth (Auth.js v5)** with credentials-based auth and JWT
- 📧 **Email notifications** (Mailpit in dev, nodemailer integration)
- 📁 **File uploads** via UploadThing for room images
- 🗄️ **Prisma ORM** with PostgreSQL (User, Room, Booking, RoomPriceRule, RoomBlackout models)
- 🎨 **Modern UI** with shadcn/ui, Tailwind CSS v4, and responsive design
- 🐳 **Docker support** with multi-stage builds and docker-compose stack
- 🎭 **Playwright** end-to-end tests

## Requirements

> **Node.js 20+ is required** (Node 26 recommended — see `.nvmrc`). The modern
> tooling (shadcn CLI, Playwright) does not run on Node 18.x.

```bash
nvm use   # picks up .nvmrc (Node 26)
```

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    then fill in NEXTAUTH_SECRET (openssl rand -base64 32), Stripe & UploadThing keys

# 3. Start Postgres (via Docker) and apply the schema
docker compose up -d db
npm run db:migrate        # creates the tables from prisma/schema.prisma

# 4. Run the dev server
npm run dev               # http://localhost:3000
```

### Demo login

The Credentials provider ships with demo accounts. Use any non-empty password:

| Email                          | Role     |
| ------------------------------ | -------- |
| `sergio.cutone@levio.ca`       | ADMIN    |
| Any other email                | CUSTOMER |

## Scripts

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `npm run dev`         | Start the Next.js dev server         |
| `npm run build`       | Production build (standalone output) |
| `npm run start`       | Run the production server            |
| `npm run typecheck`   | `tsc --noEmit`                       |
| `npm run lint`        | ESLint                               |
| `npm run db:generate` | Generate the Prisma client           |
| `npm run db:migrate`  | Create/apply a dev migration         |
| `npm run db:deploy`   | Apply migrations (production/CI)     |
| `npm run db:studio`   | Open Prisma Studio                   |
| `npx playwright test` | Run the end-to-end tests             |

## Docker & Local Services

```bash
# Build and run the full stack (Postgres + web + Mailpit)
docker compose up --build

# Apply migrations against the containerised DB (exposed on localhost:5432):
npm run db:deploy
```

### Access Points

- **App:** http://localhost:3000
- **Mailpit (email UI):** http://localhost:8025
- **Adminer (DB UI):** http://localhost:8080
- **Database:** localhost:5432

The `web` service reaches Postgres over the compose network via the **`db:5432`** host.

## Project Structure

```
app/
  page.tsx                      # Public homepage (rooms browser)
  rooms/[slug]/page.tsx         # Single room detail page
  reserve/page.tsx              # Single-room Stripe checkout
  cart/page.tsx                 # Multi-room cart & checkout
  cart/confirmation/page.tsx    # Booking confirmation
  reservation/[bookingId]/page.tsx  # View/manage reservation
  admin/page.tsx                # Admin dashboard (protected)
  admin/rooms/page.tsx          # Room management
  admin/catalog/page.tsx        # Pricing rules & amenities
  admin/calendar/page.tsx       # Blackout dates
  actions.ts                    # Guest-facing server actions
  admin/actions.ts              # Admin server actions
components/
  book-room-dialog.tsx          # Date picker + add-to-cart
  booking-picker.tsx            # Standalone date range picker
  cart-checkout-form.tsx        # Checkout form (client)
  home-content.tsx              # Room browser with filters
  reserve-form.tsx              # Single-room Stripe form
  admin/                        # Admin-only components
    reservations-table.tsx      # Paginated reservations
    rooms-manager.tsx           # Room CRUD interface
lib/
  cart.tsx                      # CartContext + hooks (localStorage)
  availability.ts               # Blackout date logic
  pricing.ts                    # Per-night pricing calculations
  queries.ts                    # Shared Prisma query types
  stripe.ts                     # Stripe SDK singleton
  mailer.ts                     # Email sender (nodemailer)
  email-templates.ts            # HTML email builders
prisma/
  schema.prisma                 # User, Room, Booking, RoomPriceRule, RoomBlackout models
  migrations/                   # Database migrations
  seed.ts                       # Seed demo data
tests/
  booking-flow.spec.ts          # Playwright e2e tests
Dockerfile  docker-compose.yml  .env.example
```

## Architecture & Key Concepts

### Server vs. Client Components

- **Server components** — Pages, layouts, header/footer. These fetch data and never use `"use client"`.
- **Client components** — All interactivity (hooks, state, events) lives in `components/`. Never add client components directly in `app/`.

### Pricing System

**All prices are stored in cents as integers.** This avoids floating-point precision issues.

- `Room.basePrice` — cents per night
- `RoomPriceRule.price` — per-`dayOfWeek` override (0=Sunday) in cents
- `quoteRange()` in `lib/pricing.ts` — calculates total for display (client-side only)
- **Authoritative pricing happens server-side** in `createCartPaymentIntent` before any Stripe charge

Example: $150/night = `15000` cents

### Cart System

- Stored in **localStorage** under key `hotellevio_cart`
- Managed by `CartContext` in `lib/cart.tsx` — provides `useCart` hook
- Client-side quotes are for display only; server re-quotes before payment
- No SSR hydration issues due to `useEffect`-based initialization

### Availability & Blackouts

- Rooms have `RoomBlackout` date ranges (e.g., closed for maintenance)
- `isRangeAvailable()` checks if a date range can be booked
- Overlap detection: `checkIn < existingCheckOut && checkOut > existingCheckIn` (half-open intervals)

### Server Actions

All mutations (bookings, admin updates) use server actions in `app/actions.ts` and `app/admin/actions.ts`:

```ts
"use server"
export async function myAction(input: Input): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    // validate, query, mutate
    return { ok: true, data: result }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" }
  }
}
```

Always return discriminated unions — **never throw** from server actions.

## Database Schema

### Models

| Model | Purpose |
|-------|---------|
| **User** | `email`, `password` (hashed), `role` (CUSTOMER \| ADMIN) |
| **Room** | Hotel room with `basePrice` (cents), `capacity`, `type` (TWIN, QUEEN, KING, SUITE) |
| **RoomAmenity** | Features like WiFi, TV, minibar (linked to rooms) |
| **RoomPriceRule** | Per-`dayOfWeek` price override (0=Sun) in cents |
| **RoomBlackout** | Date ranges when room is unavailable |
| **Booking** | Guest reservation: `checkIn`/`checkOut`, `status` (PENDING, CONFIRMED, CANCELLED) |
| **UploadedFile** | Images uploaded via UploadThing |

### Key Queries

```ts
// Check if room is available
const conflict = await prisma.booking.findFirst({
  where: {
    roomId,
    status: { in: ["PENDING", "CONFIRMED"] },
    checkIn: { lt: checkOut },
    checkOut: { gt: checkIn },
  },
})

// Multi-booking transaction (cart checkout)
await prisma.$transaction(async (tx) => {
  // create multiple bookings atomically
})
```

## Stripe Integration

- **PaymentIntents API** for full payment control
- `stripe.ts` — Server-side Stripe SDK singleton
- Webhook at `/api/stripe/webhook` validates events
- Before charging, server-side pricing is re-quoted to prevent tampering
- Always pass amounts in cents to Stripe

## Admin & Authentication

- `/admin` routes protected by `middleware.ts`
- Admin credentials: `sergio.cutone@levio.ca` (password any non-empty string)
- NextAuth v5 (Auth.js) with Credentials provider + JWT
- Sessions expire after 30 days

## Email System

- **Development:** Mailpit (Docker service, http://localhost:8025)
- **Production:** nodemailer with SMTP settings from env
- Email templates in `lib/email-templates.ts` (branded HTML)
- Mailer via `sendMail()` in `lib/mailer.ts`
- **Email failures never break the user-facing response** — always wrapped in `.catch()`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | JWT signing key (`openssl rand -base64 32`) |
| `STRIPE_SECRET_KEY` | Stripe server API key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe public key (safe for browser) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing key from Stripe dashboard |
| `UPLOADTHING_TOKEN` | UploadThing API token for file uploads |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` | Email server config |

See `.env.example` for all variables and defaults.

## Testing

```bash
# Run Playwright e2e tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test
npx playwright test booking-flow.spec.ts
```

Tests cover the full booking flow: browse rooms → pick dates → add to cart → checkout → confirm.

## Best Practices

- ✅ **Prices always in cents** — avoid float precision issues
- ✅ **Server-side re-quoting** — never trust client price calculations
- ✅ **Fire-and-forget emails** — don't block responses on email sends
- ✅ **Discriminated union returns** — no thrown exceptions from server actions
- ✅ **Dates with `startOfDay()`** — normalize user-supplied ISO strings
- ✅ **Cart in localStorage** — persists across sessions
- ✅ **Admin protected by middleware** — not just UI guards
