# CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV export to the admin reservations table (respects active filters) and to the customer reservations page (all their bookings).

**Architecture:** Two new Next.js API GET routes return `Content-Disposition: attachment` CSV responses; a shared `lib/csv.ts` helper handles serialization and formula-injection neutralization; thin UI additions wire `window.location.href` to each route.

**Tech Stack:** Next.js 15 App Router, NextAuth v5, Prisma, date-fns, Node.js built-in test runner (`tsx --test`), lucide-react

## Global Constraints

- No external CSV library — plain string builder only
- CSV rows joined with `\r\n` per RFC 4180, no trailing blank line
- Every HTTP response (success, empty, error) includes `Cache-Control: private, no-store`
- `export const dynamic = "force-dynamic"` on both API routes
- Formula-injection: prefix field value with `'` if it starts with `=`, `+`, `-`, or `@`
- Nullable fields serialize as empty string, not `"null"` or `"undefined"`
- Export button uses `variant="outline"`, `size="sm"`, `Download` lucide icon
- Unit tests use `import assert from "node:assert/strict"` and `import { describe, it } from "node:test"`
- After every task: run `npm run lint` and fix any errors before committing

---

### Task 1: CSV serialization helper + unit tests

**Files:**
- Create: `lib/csv.ts`
- Create: `lib/csv.test.ts`
- Modify: `package.json` (add `lib/csv.test.ts` to `test:unit` script)

**Interfaces:**
- Produces:
  - `sanitizeCsvField(value: string | null | undefined): string` — neutralizes formula injection, wraps fields needing quoting, returns empty string for null/undefined
  - `buildCsvRow(fields: (string | null | undefined)[]): string` — joins sanitized fields with commas, returns one CSV row (no line ending)
  - `buildCsv(headers: string[], rows: (string | null | undefined)[][]): string` — returns complete CSV string with `\r\n` between rows, no trailing newline

- [ ] **Step 1: Write the failing tests**

Create `lib/csv.test.ts`:

```ts
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { sanitizeCsvField, buildCsvRow, buildCsv } from "./csv"

describe("sanitizeCsvField", () => {
  it("returns empty string for null", () => {
    assert.equal(sanitizeCsvField(null), "")
  })

  it("returns empty string for undefined", () => {
    assert.equal(sanitizeCsvField(undefined), "")
  })

  it("returns plain value unchanged", () => {
    assert.equal(sanitizeCsvField("hello"), "hello")
  })

  // Formula-injection neutralization
  it("prefixes = at start with single-quote", () => {
    assert.equal(sanitizeCsvField("=CMD()"), "'=CMD()")
  })

  it("prefixes + at start with single-quote", () => {
    assert.equal(sanitizeCsvField("+1234"), "'+1234")
  })

  it("prefixes - at start with single-quote", () => {
    assert.equal(sanitizeCsvField("-1234"), "'-1234")
  })

  it("prefixes @ at start with single-quote", () => {
    assert.equal(sanitizeCsvField("@SUM()"), "'@SUM()")
  })

  it("does NOT neutralize = appearing mid-value", () => {
    assert.equal(sanitizeCsvField("a=b"), "a=b")
  })

  it("does NOT neutralize + appearing mid-value", () => {
    assert.equal(sanitizeCsvField("a+b"), "a+b")
  })

  // Quoting
  it("wraps value containing comma in double-quotes", () => {
    assert.equal(sanitizeCsvField("a,b"), '"a,b"')
  })

  it("wraps value containing double-quote and escapes it", () => {
    assert.equal(sanitizeCsvField('say "hi"'), '"say ""hi"""')
  })

  it("wraps value containing newline in double-quotes", () => {
    assert.equal(sanitizeCsvField("line1\nline2"), '"line1\nline2"')
  })

  // Neutralization + quoting combined
  it("neutralizes formula AND quotes when value starts with = and contains comma", () => {
    assert.equal(sanitizeCsvField("=A1,B1"), '"\'=A1,B1"')
  })

  it("neutralizes Guest Name starting with =", () => {
    assert.equal(sanitizeCsvField("=malicious"), "'=malicious")
  })

  it("neutralizes Special Requests starting with @", () => {
    assert.equal(sanitizeCsvField("@room please"), "'@room please")
  })
})

describe("buildCsvRow", () => {
  it("joins fields with commas", () => {
    assert.equal(buildCsvRow(["a", "b", "c"]), "a,b,c")
  })

  it("sanitizes each field", () => {
    assert.equal(buildCsvRow(["=x", null, "y,z"]), "'=x,\"y,z\"")
  })
})

describe("buildCsv", () => {
  it("returns header-only CSV for empty rows", () => {
    assert.equal(buildCsv(["A", "B"], []), "A,B")
  })

  it("joins header and rows with CRLF", () => {
    const result = buildCsv(["A", "B"], [["1", "2"], ["3", "4"]])
    assert.equal(result, "A,B\r\n1,2\r\n3,4")
  })

  it("has no trailing newline", () => {
    const result = buildCsv(["A"], [["1"]])
    assert.ok(!result.endsWith("\r\n"))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx tsx --test lib/csv.test.ts
```

Expected: fail with `Cannot find module './csv'`

- [ ] **Step 3: Implement `lib/csv.ts`**

Create `lib/csv.ts`:

```ts
const FORMULA_CHARS = new Set(["=", "+", "-", "@"])

export function sanitizeCsvField(value: string | null | undefined): string {
  if (value == null) return ""

  // Formula-injection neutralization — must run before quoting
  let v = FORMULA_CHARS.has(value[0]) ? `'${value}` : value

  // RFC 4180 quoting: wrap in double-quotes if the value contains a comma,
  // double-quote, or newline; escape internal double-quotes as ""
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    v = `"${v.replace(/"/g, '""')}"`
  }

  return v
}

export function buildCsvRow(fields: (string | null | undefined)[]): string {
  return fields.map(sanitizeCsvField).join(",")
}

export function buildCsv(
  headers: string[],
  rows: (string | null | undefined)[][],
): string {
  const lines = [buildCsvRow(headers), ...rows.map(buildCsvRow)]
  return lines.join("\r\n")
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx tsx --test lib/csv.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Add `lib/csv.test.ts` to `test:unit` in `package.json`**

In `package.json`, find the `"test:unit"` script and append `lib/csv.test.ts` to the space-separated list:

```json
"test:unit": "tsx --test lib/subcategories.pricing.test.ts lib/subcategory-pricing.test.ts lib/rooms.test.ts lib/listing-images.test.ts lib/account-bookings.test.ts lib/account-actions.test.ts lib/password.test.ts lib/account-schemas.test.ts lib/csv.test.ts"
```

- [ ] **Step 6: Run full unit suite to confirm no regressions**

```bash
npm run test:unit
```

Expected: all tests pass

- [ ] **Step 7: Lint**

```bash
npm run lint
```

Fix any errors before proceeding.

- [ ] **Step 8: Commit**

```bash
git add lib/csv.ts lib/csv.test.ts package.json
git commit -m "feat: add CSV serialization helper with formula-injection neutralization"
```

---

### Task 2: Admin CSV export API route

**Files:**
- Create: `app/api/export/admin/bookings/route.ts`

**Interfaces:**
- Consumes: `buildCsv` from `lib/csv.ts`, `auth` from `@/auth`, `prisma` from `@/lib/prisma`, `differenceInCalendarDays` and `format` from `date-fns`
- Produces: `GET /api/export/admin/bookings?status=&search=&roomId=` → CSV file download or plain-text error

- [ ] **Step 1: Create the route file**

Create `app/api/export/admin/bookings/route.ts`:

```ts
import { differenceInCalendarDays, format } from "date-fns"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { buildCsv } from "@/lib/csv"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const EXPORT_LIMIT = 20_000
const NO_CACHE = "private, no-store"

const HEADERS = [
  "Booking ID",
  "Guest Name",
  "Guest Email",
  "Guest Phone",
  "Room",
  "Room Number",
  "Room Type",
  "Check-in",
  "Check-out",
  "Nights",
  "Guests",
  "Total (CAD)",
  "Status",
  "Special Requests",
  "Stripe Session ID",
  "Created",
]

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": NO_CACHE },
    })
  }
  if (session.user.role !== "ADMIN") {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Cache-Control": NO_CACHE },
    })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? ""
  const search = searchParams.get("search")?.trim() ?? ""
  const roomId = searchParams.get("roomId") ?? ""

  const where: Record<string, unknown> = {}
  if (roomId) where.roomId = roomId
  if (status && status !== "ALL") where.status = status
  if (search) {
    where.OR = [
      { guestName: { contains: search, mode: "insensitive" } },
      { guestEmail: { contains: search, mode: "insensitive" } },
      { room: { name: { contains: search, mode: "insensitive" } } },
    ]
  }

  try {
    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_LIMIT + 1,
      include: {
        room: { select: { name: true, roomNumber: true, type: true } },
        user: { select: { name: true, email: true } },
      },
    })

    if (bookings.length > EXPORT_LIMIT) {
      return new Response(
        "Export exceeds 20,000 rows. Please narrow your filters and try again.",
        { status: 413, headers: { "Cache-Control": NO_CACHE } },
      )
    }

    const rows = bookings.map((b) => [
      b.id,
      b.guestName ?? b.user.name,
      b.guestEmail ?? b.user.email,
      b.guestPhone,
      b.room.name,
      b.room.roomNumber,
      b.room.type,
      format(new Date(b.checkIn), "yyyy-MM-dd"),
      format(new Date(b.checkOut), "yyyy-MM-dd"),
      String(differenceInCalendarDays(new Date(b.checkOut), new Date(b.checkIn))),
      String(b.guests),
      (b.totalPrice / 100).toFixed(2),
      b.status,
      b.specialRequests,
      b.stripeSessionId,
      format(new Date(b.createdAt), "yyyy-MM-dd"),
    ])

    const filename = `reservations-${format(new Date(), "yyyy-MM-dd")}.csv`
    const csv = buildCsv(HEADERS, rows)

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": NO_CACHE,
      },
    })
  } catch (err) {
    console.error("Admin CSV export error:", err)
    return new Response("Export failed. Please try again.", {
      status: 500,
      headers: { "Cache-Control": NO_CACHE },
    })
  }
}
```

- [ ] **Step 2: Manually verify the route works**

Start the dev server (`npm run dev`) and sign in as admin. Open:

```
http://localhost:3000/api/export/admin/bookings
```

Expected: browser downloads `reservations-YYYY-MM-DD.csv` with a header row and all bookings.

Then test with filters:

```
http://localhost:3000/api/export/admin/bookings?status=CONFIRMED
```

Expected: only CONFIRMED bookings in the CSV.

Then sign out and try the URL again — expected: plain-text `Unauthorized` response (not a CSV).

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Fix any errors before proceeding.

- [ ] **Step 4: Commit**

```bash
git add app/api/export/admin/bookings/route.ts
git commit -m "feat: add admin CSV export API route"
```

---

### Task 3: Customer CSV export API route + ExportCsvButton component

**Files:**
- Create: `app/api/export/customer/bookings/route.ts`
- Create: `components/account/export-csv-button.tsx`

**Interfaces:**
- Consumes: `buildCsv` from `lib/csv.ts`, `auth` from `@/auth`, `prisma` from `@/lib/prisma`, `getDisplayRoomName` from `@/lib/account-bookings`, `differenceInCalendarDays` and `format` from `date-fns`
- Produces:
  - `GET /api/export/customer/bookings` → CSV file download scoped to the authenticated user
  - `<ExportCsvButton />` — `"use client"` component that triggers the download on click

- [ ] **Step 1: Create the customer route**

Create `app/api/export/customer/bookings/route.ts`:

```ts
import { differenceInCalendarDays, format } from "date-fns"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { buildCsv } from "@/lib/csv"
import { getDisplayRoomName } from "@/lib/account-bookings"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const NO_CACHE = "private, no-store"

const HEADERS = [
  "Booking ID",
  "Room",
  "Check-in",
  "Check-out",
  "Nights",
  "Guests",
  "Total (CAD)",
  "Status",
  "Special Requests",
]

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": NO_CACHE },
    })
  }
  if (session.user.role !== "CUSTOMER") {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Cache-Control": NO_CACHE },
    })
  }

  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: session.user.id },
      orderBy: { checkIn: "desc" },
      include: { room: { select: { name: true } } },
    })

    const rows = bookings.map((b) => [
      b.id.slice(-8).toUpperCase(),
      getDisplayRoomName(b.room.name),
      format(new Date(b.checkIn), "yyyy-MM-dd"),
      format(new Date(b.checkOut), "yyyy-MM-dd"),
      String(differenceInCalendarDays(new Date(b.checkOut), new Date(b.checkIn))),
      String(b.guests),
      (b.totalPrice / 100).toFixed(2),
      b.status,
      b.specialRequests,
    ])

    const filename = `my-reservations-${format(new Date(), "yyyy-MM-dd")}.csv`
    const csv = buildCsv(HEADERS, rows)

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": NO_CACHE,
      },
    })
  } catch (err) {
    console.error("Customer CSV export error:", err)
    return new Response("Export failed. Please try again.", {
      status: 500,
      headers: { "Cache-Control": NO_CACHE },
    })
  }
}
```

- [ ] **Step 2: Create the ExportCsvButton client component**

Create `components/account/export-csv-button.tsx`:

```tsx
"use client"

import * as React from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ExportCsvButton() {
  const [exporting, setExporting] = React.useState(false)

  function handleExport() {
    setExporting(true)
    window.location.href = "/api/export/customer/bookings"
    setTimeout(() => setExporting(false), 1000)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
    >
      <Download className="size-4" />
      {exporting ? "Exporting…" : "Export CSV"}
    </Button>
  )
}
```

- [ ] **Step 3: Manually verify the customer route**

Sign in as a customer and open:

```
http://localhost:3000/api/export/customer/bookings
```

Expected: browser downloads `my-reservations-YYYY-MM-DD.csv` with only that user's bookings. Booking ID column should show the same 8-char uppercase suffix the UI uses, but without the UI's leading `#` (e.g. UI shows `#A3F7C2D1`, CSV shows `A3F7C2D1`) — the `#` is a UI display affordance, not part of the exported value.

Sign out and try the URL again — expected: plain-text `Unauthorized`.

Sign in as admin and try the URL — expected: plain-text `Forbidden` (wrong role).

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Fix any errors before proceeding.

- [ ] **Step 5: Commit**

```bash
git add app/api/export/customer/bookings/route.ts components/account/export-csv-button.tsx
git commit -m "feat: add customer CSV export route and ExportCsvButton component"
```

---

### Task 4: Wire export buttons into admin table and customer reservations page

**Files:**
- Modify: `components/admin/reservations-table.tsx`
- Modify: `app/account/(dashboard)/reservations/page.tsx`

**Interfaces:**
- Consumes: `ExportCsvButton` from `@/components/account/export-csv-button`
- No new exports

- [ ] **Step 1: Add Export CSV button to `ReservationsTable`**

In `components/admin/reservations-table.tsx`:

1. Add `Download` to the lucide-react import:

```tsx
import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react"
```

2. Add `isExporting` state inside the `ReservationsTable` component (alongside the other `React.useState` calls):

```tsx
const [isExporting, setIsExporting] = React.useState(false)
```

3. Add the `handleExport` function inside the `ReservationsTable` component (after the state declarations):

```tsx
function handleExport() {
  setIsExporting(true)
  const params = new URLSearchParams()
  if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter)
  if (debouncedSearch) params.set("search", debouncedSearch)
  if (roomId) params.set("roomId", roomId)
  window.location.href = `/api/export/admin/bookings?${params.toString()}`
  setTimeout(() => setIsExporting(false), 1000)
}
```

4. In the filter bar JSX (the `{!roomId && (...)}` block), add the Export CSV button at the end of the outer `div`. The current filter bar div looks like:

```tsx
<div className="flex flex-wrap items-center gap-2 mb-4">
  <div className="relative flex-1 min-w-48">
    ...search input...
  </div>
  <div className="flex gap-1.5">
    ...status pills...
  </div>
</div>
```

Add the button as a third child of the outer div, after the status pills div:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={handleExport}
  disabled={isExporting}
>
  <Download className="size-4" />
  {isExporting ? "Exporting…" : "Export CSV"}
</Button>
```

The full updated filter bar block:

```tsx
{!roomId && (
  <div className="flex flex-wrap items-center gap-2 mb-4">
    <div className="relative flex-1 min-w-48">
      <Search className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 size-3.5" />
      <Input
        placeholder="Search guest or room…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-8 h-8 text-sm"
      />
    </div>
    <div className="flex gap-1.5">
      {STATUS_FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => setStatusFilter(f.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            statusFilter === f.value
              ? "bg-primary text-primary-foreground"
              : "border text-muted-foreground hover:bg-muted"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
    >
      <Download className="size-4" />
      {isExporting ? "Exporting…" : "Export CSV"}
    </Button>
  </div>
)}
```

- [ ] **Step 2: Add ExportCsvButton to the customer reservations page**

In `app/account/(dashboard)/reservations/page.tsx`:

1. Add the import at the top:

```tsx
import { ExportCsvButton } from "@/components/account/export-csv-button"
```

2. The page currently fetches `bookings`, maps them to `rows`, partitions them, and renders `<PageHeader>` then `<ReservationsList>`. Add the `ExportCsvButton` between the `PageHeader` and `ReservationsList`, conditional on `rows.length > 0`:

```tsx
return (
  <>
    <PageHeader
      eyebrow="My account"
      title="Reservations"
      subtitle="View upcoming stays and past bookings."
    />
    {rows.length > 0 && (
      <div className="mb-6">
        <ExportCsvButton />
      </div>
    )}
    <ReservationsList upcoming={upcoming} past={past} />
  </>
)
```

- [ ] **Step 3: Manually verify admin UI**

Sign in as admin, go to `/admin`. In the Reservations section:
- Confirm "Export CSV" button appears in the filter bar
- Click it — browser should download a CSV matching the current filter state
- Apply a status filter (e.g. Confirmed) then click Export — only confirmed bookings should be in the file
- Enter a search term then click Export — only matching bookings should be in the file

- [ ] **Step 4: Manually verify customer UI**

Sign in as a customer with at least one booking, go to `/account/reservations`:
- Confirm "Export CSV" button appears below the page header
- Click it — browser should download `my-reservations-YYYY-MM-DD.csv` with only that customer's bookings
- Sign in as a customer with zero bookings — confirm the Export CSV button does NOT appear

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Fix any errors before proceeding.

- [ ] **Step 6: Commit**

```bash
git add components/admin/reservations-table.tsx app/account/\(dashboard\)/reservations/page.tsx
git commit -m "feat: wire CSV export buttons into admin table and customer reservations page"
```

---

## Self-Review

**Spec coverage:**
- ✅ `lib/csv.ts` with `sanitizeCsvField` applied to every field
- ✅ Formula-injection: `=`, `+`, `-`, `@` prefixed with `'`
- ✅ Mid-value trigger chars NOT neutralized (covered by tests)
- ✅ Neutralization + quoting combined (covered by tests)
- ✅ Nullable → empty string
- ✅ `\r\n` row separator, no trailing newline
- ✅ Admin route: `take: 20_001`, 413 if > 20,000
- ✅ Admin route: filter params match `getBookings()` logic exactly
- ✅ `Cache-Control: private, no-store` on every response including errors
- ✅ `export const dynamic = "force-dynamic"` on both routes
- ✅ Admin columns: all 16 fields including Stripe Session ID
- ✅ Customer columns: 9 fields, short booking ID, display room name
- ✅ Admin button: in filter bar, hidden when `roomId` set, 1-second disabled state
- ✅ Customer button: `ExportCsvButton` client component, hidden when 0 bookings
- ✅ Auth: 401 no session, 403 wrong role, checked inline in each route
- ✅ `test:unit` script updated to include `lib/csv.test.ts`

**Type consistency:** `buildCsv(headers: string[], rows: (string | null | undefined)[][])` used consistently in both routes. `getDisplayRoomName` imported from `@/lib/account-bookings` in customer route — matches existing usage in `app/account/(dashboard)/reservations/page.tsx`.
