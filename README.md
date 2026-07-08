# Azure Bay Hotel — Reservation App

A modern full-stack hotel reservation application built with **Next.js 15 (App
Router)**, **TypeScript**, **Tailwind CSS v4**, and **shadcn/ui**.

## Features

- 🏝️ **Public homepage** with a hero section, a date-range **BookingPicker**
  (shadcn `Calendar` + `Popover`), and room cards.
- 🛠️ **Admin dashboard** (`/admin`) with a sortable rooms table powered by
  **TanStack Table** + shadcn `Table`, stat cards, and tabs.
- 🗄️ **Prisma** schema with `User`, `Room`, and `Booking` models (PostgreSQL).
- 🔐 **NextAuth (Auth.js v5)** with a demo Credentials provider.
- 💳 **Stripe** + **UploadThing** integrations wired up (mock/free friendly).
- 🐳 **Docker**: multi-stage `Dockerfile` (standalone output) +
  `docker-compose.yml` (Postgres 16 + web).
- 🎭 **Playwright** end-to-end tests (`tests/booking-flow.spec.ts`).

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

The Credentials provider ships with two mock accounts (any non-empty password):

| Email              | Role     |
| ------------------ | -------- |
| `admin@hotel.test` | ADMIN    |
| `guest@hotel.test` | CUSTOMER |

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

## Docker

```bash
# Build and run the full stack (Postgres + web)
docker compose up --build

# Apply migrations against the containerised DB (exposed on localhost:5432):
npm run db:deploy
```

The `web` service reaches Postgres over the compose network via the **`@db:5432`**
host. See `.env.example` for all variables.

## Project structure

```
app/
  page.tsx                 # Public homepage (hero + picker + rooms)
  admin/page.tsx           # Admin dashboard
  api/auth/[...nextauth]/  # NextAuth route handler
  api/uploadthing/         # UploadThing file router + route handler
components/
  booking-picker.tsx       # Date-range picker (Calendar + Popover)
  room-card.tsx            # Room card with Book Now
  admin/rooms-table.tsx    # TanStack + shadcn table
  ui/                      # shadcn/ui components
lib/
  prisma.ts  stripe.ts  uploadthing.ts  rooms.ts  utils.ts
auth.ts                    # NextAuth (Auth.js v5) config
prisma/schema.prisma       # User / Room / Booking models
tests/booking-flow.spec.ts # Playwright e2e test
Dockerfile  docker-compose.yml  .env.example
```
