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
