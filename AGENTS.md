# AGENTS.md — Hôtel Levio

Context for AI coding agents (Copilot, Cursor, etc.) working in this repository.

For extended product/design detail, see [CLAUDE.md](./CLAUDE.md).

## Project summary

Full-stack hotel booking app on **Next.js 15 App Router**. Guests browse rooms, pick dates, cart checkout, and pay via Stripe. Logged-in customers manage reservations under `/account`. Admins manage inventory, pricing, and bookings under `/admin`.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | NextAuth v5 (Auth.js) — Credentials + OAuth, JWT |
| Database | PostgreSQL + Prisma ORM |
| Payments | Stripe PaymentIntents |
| UI | shadcn/ui, Tailwind CSS v4, TanStack Query |
| Validation | Zod |
| Dates | date-fns |
| Unit tests | Node.js built-in test runner via `tsx --test` |
| E2E tests | Playwright |

## Repository layout

```
app/
  actions.ts              # Guest booking/cart server actions
  account/actions.ts      # Customer account server actions
  admin/actions.ts        # Admin server actions
  api/                    # Stripe webhook, UploadThing, NextAuth routes
  account/                # Customer dashboard (protected)
  admin/                  # Admin dashboard (protected)
  cart/, reserve/, rooms/ # Booking flows
components/               # Client components only (interactive UI)
lib/
  availability.ts         # Blackout + range availability
  pricing.ts              # quoteRange (per-night pricing)
  inventory.ts            # Room inventory allocation + sync
  account-date-change.ts  # Date-change quote/payment/persist helpers
  account-bookings.ts     # Reservation list partitioning
  account-schemas.ts      # Zod schemas for account forms
  cart.tsx                # CartContext (client, localStorage)
  queries.ts              # Shared Prisma query types
  rooms.ts                # formatPrice, fromPrice helpers
  stripe.ts               # Stripe server SDK singleton
  prisma.ts               # Extended Prisma client + transaction types
prisma/schema.prisma
scripts/                  # db-seed, db-reset, safety checks
tests/                    # Playwright e2e specs
```

## Architecture rules

### Server vs client

- **`app/**/page.tsx`** — server components. Fetch data here; do not add `"use client"` to pages.
- **`components/**`** — client components when they use hooks, browser APIs, or Stripe Elements.
- **`lib/**`** — shared logic. Keep server-only modules free of React hooks unless the file is explicitly client (e.g. `lib/cart.tsx`).

### Next.js 15 specifics

- `searchParams` and `params` in pages/layouts are **Promises** — always `await` them.
- Use `revalidatePath()` after server-action mutations that affect cached pages.

### Server actions

All server actions return discriminated unions — **never throw** to the client:

```ts
"use server"

export async function myAction(input: Input): Promise<
  { ok: true; data: T } | { ok: false; error: string }
> {
  try {
    // validate, mutate
    return { ok: true, data: result }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" }
  }
}
```

Put guest actions in `app/actions.ts`, account actions in `app/account/actions.ts`, admin actions in `app/admin/actions.ts`.

### Pricing and money

| Surface | Unit |
|---|---|
| Database, Stripe, server quotes | **Cents** (integers) |
| Guest-facing display | `formatPrice(cents, "CAD")` from `lib/rooms.ts` |
| **Admin UI inputs** | **Dollars** — convert with `/ 100` on load and `Math.round(dollars * 100)` on save |

- Client-side quotes are for display only. Re-quote server-side before creating PaymentIntents.
- Never pass dollar floats to Stripe or Prisma price fields.

### Dates and availability

- Normalize user input with `startOfDay(new Date(isoString))`.
- Blackouts: `isRangeAvailable(blackouts, checkIn, checkOut)` from `lib/availability.ts`.
- Booking overlap (half-open intervals): `checkIn < existingCheckOut && checkOut > existingCheckIn`.
- Only `PENDING` and `CONFIRMED` bookings block availability.

### Payments and date changes

Date-change logic lives in `lib/account-date-change.ts`:

- Recompute quotes inside the persist transaction against current room pricing.
- Validate submitted quote/payment against transaction-local state before update.
- Refund the PaymentIntent if persistence fails after a successful charge.
- Record `dateChangeStripePaymentId` on the booking; do not overwrite `stripeSessionId`.

### Inventory

- Catalog rooms (`isCatalog: true`) are templates; inventory units have `roomNumber`.
- `syncTypeQuantity` / `addInventoryUnits` must be atomic — use `prisma.$transaction` for multi-room creation.
- Fail fast when floor-plan slots are insufficient; never partially allocate.

### Database transactions

Use `prisma.$transaction` for multi-step writes that must succeed or fail together. Pass the transaction client (`tx`) to all reads/writes inside the callback. Type: `PrismaTransactionClient` from `lib/prisma.ts`.

### Email

Send via `sendMail()` from `lib/mailer.ts`. Build content with `lib/email-templates.ts`. Email failures must not block user responses — fire-and-forget with `.catch()`.

### Auth

- `/admin` — protected by `middleware.ts`; requires admin session.
- `/account` — customer dashboard; uses account auth helpers in `lib/account-auth.ts`.
- Admin notification email constant: `ADMIN_EMAIL = "sergio.cutone@levio.ca"`.

## UI conventions

### Buttons by surface

| Context | Variant |
|---|---|
| Sign-in / auth submit on light background | `variant="blue"` |
| Booking CTAs on light background (Book Now, Apply, checkout) | `variant="action"` |
| Header, footer, hero (dark navy chrome) | `variant="default"` or `variant="outline"` |

Existing uses of `BOOKING_ACTION_BUTTON_CLASS` from `lib/rooms.ts` are equivalent to `variant="action"` — leave them unless doing a deliberate style audit.

### Interactive cursors

Native `<a>` and enabled `<button>` get pointer cursor from `app/globals.css`. Custom clickable elements (e.g. `<div onClick>`) need explicit `cursor-pointer`.

## Coding standards for agents

1. **Minimal scope** — smallest correct diff; don't refactor unrelated code.
2. **Match existing patterns** — read surrounding files before adding abstractions.
3. **No over-engineering** — no premature helpers, wrappers, or error handling for impossible edges.
4. **Comments** — only for non-obvious business logic.
5. **Tests** — add unit tests in `lib/*.test.ts` for pure logic; don't add trivial tests. Run `npm run test:unit` when touching tested modules.
6. **Lint/format** — run `npm run lint` and `npm run typecheck` before claiming work is done.
7. **Don't commit** unless explicitly asked.

## ESLint

- Flat config in `eslint.config.mjs` with `eslint-plugin-sonarjs` (recommended rules).
- `sonarjs/no-hardcoded-passwords` is off in `**/*.test.ts`.
- `sonarjs/no-os-command-from-path` is off only for `scripts/db-seed.ts` and `scripts/db-reset.ts` (controlled PATH). Do not broaden this override for new scripts without documenting why.

## Verification commands

```bash
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run test:unit     # Node test runner (lib/*.test.ts)
npm run test:e2e      # Playwright (needs running app + DB)
npm run build         # Production build check
```

## Local development

```bash
cp .env.example .env
docker compose up -d          # Postgres, Mailpit, Adminer
npm install
npx prisma migrate dev
npm run db:seed
npm run dev                   # http://localhost:3000
```

- Mailpit UI: http://localhost:8025
- Adminer: http://localhost:8080

## Common pitfalls (do not)

- Add `"use client"` to page files.
- Throw from server actions instead of returning `{ ok: false, error }`.
- Trust client-side prices for Stripe charges.
- Import `lib/cart.tsx` in server components.
- Block booking responses on email delivery.
- Store admin dollar inputs as cents without `Math.round(dollars * 100)`.
- Use autocommit loops for multi-row inventory or booking writes that must be atomic.
- Treat `searchParams` / `params` as synchronous objects in Next.js 15.

## Key domain models (Prisma)

- **User** — `role: CUSTOMER | ADMIN`
- **Room** — catalog or inventory unit; `basePrice` in cents; `type: TWIN | QUEEN | KING | SUITE`
- **RoomPriceRule** — weekday price override (cents)
- **RoomBlackout** — unavailable date ranges
- **Booking** — denormalized guest fields; `status: PENDING | CONFIRMED | CANCELLED`; `dateChangeStripePaymentId` for date-change payments
