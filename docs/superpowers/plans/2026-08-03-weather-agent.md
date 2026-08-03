# Weather Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Open-Meteo weather data to Hôtel Levio as a room-detail sidebar widget and an AI concierge chat tool.

**Architecture:** A shared `lib/weather.ts` module fetches Open-Meteo with hardcoded hotel coordinates and returns typed `WeatherResult`. A Next.js API route proxies it for the client-side widget. The AI SDK concierge tool and MCP server tool call `lib/weather.ts` directly (no HTTP hop). The widget lives inside `RoomBookingSidebar`, reading the already-tracked `range` state to scope the forecast to the guest's stay dates.

**Tech Stack:** Open-Meteo REST API (no key), Next.js 15 App Router, Vercel AI SDK (`tool`), `@modelcontextprotocol/sdk`, Node.js built-in test runner (`node:test` + `tsx --test`).

## Global Constraints

- No weather API key — Open-Meteo only.
- Hotel coordinates: `latitude=45.5048`, `longitude=-73.5521` (Old Port, Montréal).
- Timezone: `America/Toronto`. Temperatures in Celsius.
- Test runner: `tsx --test <files>`. Tests use `node:test` (`describe`, `it`, `before`, `after`, `beforeEach`) and `node:assert/strict`. No jest, no vitest.
- `@/` path alias resolves to the project root (see `tsconfig.json`).
- All temperatures rounded to nearest integer before returning.
- Widget silently renders `null` on fetch error — never shows an error state.
- Open-Meteo `forecast_days=16` always; filter in code rather than via API params.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `lib/weather.ts` | Fetch Open-Meteo, WMO code mapping, return `WeatherResult` |
| Create | `lib/weather.test.ts` | Unit tests for `lib/weather.ts` and `app/api/weather/route.ts` |
| Create | `app/api/weather/route.ts` | GET handler, cache headers, error envelope |
| Create | `components/weather-widget.tsx` | Client component: fetch `/api/weather`, render current + forecast |
| Modify | `components/room-booking-sidebar.tsx` | Render `<WeatherWidget>` below "Clear dates" button |
| Modify | `lib/concierge/schemas.ts` | Add `weatherInputSchema` |
| Modify | `lib/concierge/tools.ts` | Add `get_weather` tool to `createGuestConciergeTools()` |
| Modify | `lib/concierge/config.ts` | Add weather line to `CONCIERGE_SYSTEM_PROMPT` |
| Modify | `mcp-server/index.ts` | Register `get_weather` tool |
| Modify | `package.json` | Add `lib/weather.test.ts` to `test:unit` script |

---

## Task 1: Weather data library

**Files:**
- Create: `lib/weather.ts`
- Create: `lib/weather.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  ```ts
  export type WeatherResult = {
    current: {
      tempC: number
      feelsLikeC: number
      windKph: number
      label: string
      icon: string
    }
    forecast: Array<{
      date: string      // YYYY-MM-DD
      highC: number
      lowC: number
      precipPct: number
      label: string
      icon: string
    }>
  }
  export function wmoLabel(code: number): { label: string; icon: string }
  export async function getWeather(opts?: { startDate?: string; endDate?: string }): Promise<WeatherResult>
  ```

- [ ] **Step 1: Write the failing tests**

Create `lib/weather.test.ts`:

```ts
import assert from "node:assert/strict"
import { describe, it, before, after, beforeEach } from "node:test"

// Helper: YYYY-MM-DD for today + n days
function dayOffset(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// 16 daily entries starting from today
const MOCK_TIMES = Array.from({ length: 16 }, (_, i) => dayOffset(i))

const MOCK_RESPONSE = {
  current: {
    temperature_2m: 18.5,
    apparent_temperature: 16.2,
    windspeed_10m: 14.1,
    weathercode: 2,
  },
  daily: {
    time: MOCK_TIMES,
    temperature_2m_max: Array(16).fill(22.4),
    temperature_2m_min: Array(16).fill(14.1),
    precipitation_probability_max: Array(16).fill(20),
    weathercode: Array(16).fill(2),
  },
}

describe("wmoLabel", () => {
  it("maps code 0 to clear sky", async () => {
    const { wmoLabel } = await import("./weather")
    assert.equal(wmoLabel(0).label, "Clear sky")
    assert.equal(wmoLabel(0).icon, "☀️")
  })

  it("maps code 2 to partly cloudy", async () => {
    const { wmoLabel } = await import("./weather")
    assert.equal(wmoLabel(2).label, "Partly cloudy")
    assert.equal(wmoLabel(2).icon, "⛅")
  })

  it("maps code 63 to rain", async () => {
    const { wmoLabel } = await import("./weather")
    assert.equal(wmoLabel(63).label, "Rain")
    assert.equal(wmoLabel(63).icon, "🌧️")
  })

  it("maps code 71 to snow", async () => {
    const { wmoLabel } = await import("./weather")
    assert.equal(wmoLabel(71).label, "Snow")
    assert.equal(wmoLabel(71).icon, "🌨️")
  })

  it("maps code 95 to thunderstorm", async () => {
    const { wmoLabel } = await import("./weather")
    assert.equal(wmoLabel(95).label, "Thunderstorm")
    assert.equal(wmoLabel(95).icon, "⛈️")
  })

  it("falls back to Variable for unmapped codes", async () => {
    const { wmoLabel } = await import("./weather")
    assert.equal(wmoLabel(999).label, "Variable")
    assert.equal(wmoLabel(999).icon, "🌡️")
  })
})

describe("getWeather", () => {
  let originalFetch: typeof globalThis.fetch
  let capturedUrl: string

  before(() => {
    originalFetch = globalThis.fetch
  })

  after(() => {
    globalThis.fetch = originalFetch
  })

  beforeEach(() => {
    capturedUrl = ""
    globalThis.fetch = async (url: string | URL | Request) => {
      capturedUrl = url.toString()
      return new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    }
  })

  it("calls Open-Meteo with hotel coordinates", async () => {
    const { getWeather } = await import("./weather")
    await getWeather()
    assert.ok(capturedUrl.includes("latitude=45.5048"), `missing lat in: ${capturedUrl}`)
    assert.ok(capturedUrl.includes("longitude=-73.5521"), `missing lon in: ${capturedUrl}`)
    assert.ok(capturedUrl.includes("open-meteo.com"), `missing host in: ${capturedUrl}`)
  })

  it("returns current conditions with rounded values", async () => {
    const { getWeather } = await import("./weather")
    const result = await getWeather()
    assert.equal(result.current.tempC, 19)      // Math.round(18.5)
    assert.equal(result.current.feelsLikeC, 16) // Math.round(16.2)
    assert.equal(result.current.windKph, 14)    // Math.round(14.1)
    assert.equal(result.current.label, "Partly cloudy")
    assert.equal(result.current.icon, "⛅")
  })

  it("returns next 3 days (excluding today) when no dates provided", async () => {
    const { getWeather } = await import("./weather")
    const result = await getWeather()
    assert.equal(result.forecast.length, 3)
    const today = new Date().toISOString().slice(0, 10)
    for (const day of result.forecast) {
      assert.ok(day.date > today, `expected ${day.date} > ${today}`)
    }
  })

  it("trims forecast to stay dates when startDate/endDate provided", async () => {
    const { getWeather } = await import("./weather")
    const startDate = MOCK_TIMES[2]
    const endDate = MOCK_TIMES[4]
    const result = await getWeather({ startDate, endDate })
    assert.deepEqual(
      result.forecast.map((d) => d.date),
      [MOCK_TIMES[2], MOCK_TIMES[3], MOCK_TIMES[4]],
    )
  })

  it("rounds forecast high and low temperatures", async () => {
    const { getWeather } = await import("./weather")
    const result = await getWeather()
    assert.equal(result.forecast[0].highC, 22) // Math.round(22.4)
    assert.equal(result.forecast[0].lowC, 14)  // Math.round(14.1)
  })

  it("throws on non-2xx response from Open-Meteo", async () => {
    globalThis.fetch = async () => new Response("", { status: 503 })
    const { getWeather } = await import("./weather")
    await assert.rejects(getWeather, /Open-Meteo error/)
  })
})
```

- [ ] **Step 2: Add test file to `package.json` test:unit script**

In `package.json`, update the `test:unit` script to append `lib/weather.test.ts`:

```json
"test:unit": "tsx --test lib/subcategories.pricing.test.ts lib/subcategory-pricing.test.ts lib/rooms.test.ts lib/listing-images.test.ts lib/account-bookings.test.ts lib/account-actions.test.ts lib/password.test.ts lib/account-schemas.test.ts lib/csv.test.ts lib/graph-insights.test.ts lib/concierge/dates.test.ts lib/weather.test.ts",
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/sergiocutone/HotelApp && npx tsx --test lib/weather.test.ts
```

Expected: failures like `Cannot find module './weather'`.

- [ ] **Step 4: Implement `lib/weather.ts`**

Create `lib/weather.ts`:

```ts
const HOTEL_LAT = 45.5048
const HOTEL_LON = -73.5521
const FORECAST_DAYS = 16

const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Partly cloudy", icon: "⛅" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Foggy", icon: "🌫️" },
  48: { label: "Foggy", icon: "🌫️" },
  51: { label: "Drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Drizzle", icon: "🌦️" },
  56: { label: "Drizzle", icon: "🌦️" },
  57: { label: "Drizzle", icon: "🌦️" },
  61: { label: "Rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Rain", icon: "🌧️" },
  66: { label: "Rain", icon: "🌧️" },
  67: { label: "Rain", icon: "🌧️" },
  71: { label: "Snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Snow", icon: "🌨️" },
  77: { label: "Snow", icon: "🌨️" },
  80: { label: "Rain showers", icon: "🌦️" },
  81: { label: "Rain showers", icon: "🌦️" },
  82: { label: "Rain showers", icon: "🌦️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Snow showers", icon: "🌨️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm", icon: "⛈️" },
  99: { label: "Thunderstorm", icon: "⛈️" },
}

const WMO_FALLBACK = { label: "Variable", icon: "🌡️" }

export function wmoLabel(code: number): { label: string; icon: string } {
  return WMO_CODES[code] ?? WMO_FALLBACK
}

export type WeatherResult = {
  current: {
    tempC: number
    feelsLikeC: number
    windKph: number
    label: string
    icon: string
  }
  forecast: Array<{
    date: string
    highC: number
    lowC: number
    precipPct: number
    label: string
    icon: string
  }>
}

export async function getWeather(opts?: {
  startDate?: string
  endDate?: string
}): Promise<WeatherResult> {
  const url = new URL("https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", String(HOTEL_LAT))
  url.searchParams.set("longitude", String(HOTEL_LON))
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,windspeed_10m,weathercode",
  )
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode",
  )
  url.searchParams.set("timezone", "America/Toronto")
  url.searchParams.set("temperature_unit", "celsius")
  url.searchParams.set("forecast_days", String(FORECAST_DAYS))

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`)

  const data = await res.json()

  const currentCode = data.current.weathercode as number
  const current = {
    tempC: Math.round(data.current.temperature_2m as number),
    feelsLikeC: Math.round(data.current.apparent_temperature as number),
    windKph: Math.round(data.current.windspeed_10m as number),
    ...wmoLabel(currentCode),
  }

  const times = data.daily.time as string[]
  const highs = data.daily.temperature_2m_max as number[]
  const lows = data.daily.temperature_2m_min as number[]
  const precips = data.daily.precipitation_probability_max as number[]
  const codes = data.daily.weathercode as number[]

  let indices = times.map((_, i) => i)

  if (opts?.startDate && opts?.endDate) {
    indices = indices.filter(
      (i) => times[i] >= opts.startDate! && times[i] <= opts.endDate!,
    )
  } else {
    const today = new Date().toISOString().slice(0, 10)
    indices = indices.filter((i) => times[i] > today).slice(0, 3)
  }

  const forecast = indices.map((i) => ({
    date: times[i],
    highC: Math.round(highs[i]),
    lowC: Math.round(lows[i]),
    precipPct: precips[i] ?? 0,
    ...wmoLabel(codes[i]),
  }))

  return { current, forecast }
}
```

- [ ] **Step 5: Run tests and verify they pass**

```bash
npx tsx --test lib/weather.test.ts
```

Expected: all tests pass, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add lib/weather.ts lib/weather.test.ts package.json
git commit -m "feat: add weather data library with Open-Meteo integration"
```

---

## Task 2: API route

**Files:**
- Create: `app/api/weather/route.ts`
- Modify: `lib/weather.test.ts` (append route tests)

**Interfaces:**
- Consumes: `getWeather` from `lib/weather.ts` (see Task 1)
- Produces: `GET /api/weather?start=YYYY-MM-DD&end=YYYY-MM-DD` → `WeatherResult` JSON with `Cache-Control: s-maxage=900, stale-while-revalidate=300`; on error → `{ error: "unavailable" }` with status 200.

- [ ] **Step 1: Append route tests to `lib/weather.test.ts`**

Append to the end of `lib/weather.test.ts`:

```ts
describe("GET /api/weather route", () => {
  let originalFetch: typeof globalThis.fetch

  before(() => {
    originalFetch = globalThis.fetch
  })

  after(() => {
    globalThis.fetch = originalFetch
  })

  it("returns Cache-Control header on success", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    const { GET } = await import("../app/api/weather/route")
    const req = new Request("http://localhost/api/weather")
    const res = await GET(req)
    assert.equal(
      res.headers.get("Cache-Control"),
      "s-maxage=900, stale-while-revalidate=300",
    )
    assert.equal(res.status, 200)
  })

  it("returns { error: 'unavailable' } with status 200 when fetch fails", async () => {
    globalThis.fetch = async () => new Response("", { status: 503 })
    const { GET } = await import("../app/api/weather/route")
    const req = new Request("http://localhost/api/weather")
    const res = await GET(req)
    const body = await res.json()
    assert.equal(res.status, 200)
    assert.equal(body.error, "unavailable")
  })

  it("ignores invalid date format params (no 400)", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    const { GET } = await import("../app/api/weather/route")
    const req = new Request(
      "http://localhost/api/weather?start=not-a-date&end=also-wrong",
    )
    const res = await GET(req)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.ok(!body.error)
  })

  it("passes valid start/end params to getWeather", async () => {
    let capturedUrl = ""
    globalThis.fetch = async (url: string | URL | Request) => {
      capturedUrl = url.toString()
      return new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    }
    const { GET } = await import("../app/api/weather/route")
    const req = new Request(
      `http://localhost/api/weather?start=${MOCK_TIMES[2]}&end=${MOCK_TIMES[4]}`,
    )
    await GET(req)
    assert.ok(
      capturedUrl.includes("open-meteo.com"),
      `Expected Open-Meteo call, got: ${capturedUrl}`,
    )
  })
})
```

- [ ] **Step 2: Run tests to verify route tests fail**

```bash
npx tsx --test lib/weather.test.ts
```

Expected: `wmoLabel` and `getWeather` tests still pass; new `GET /api/weather route` tests fail with `Cannot find module '../app/api/weather/route'`.

- [ ] **Step 3: Create `app/api/weather/route.ts`**

```ts
import { NextResponse } from "next/server"

import { getWeather } from "@/lib/weather"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawStart = searchParams.get("start") ?? undefined
  const rawEnd = searchParams.get("end") ?? undefined

  const startDate = rawStart && DATE_RE.test(rawStart) ? rawStart : undefined
  const endDate = rawEnd && DATE_RE.test(rawEnd) ? rawEnd : undefined

  try {
    const result = await getWeather({ startDate, endDate })
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "s-maxage=900, stale-while-revalidate=300",
      },
    })
  } catch {
    return NextResponse.json({ error: "unavailable" })
  }
}
```

- [ ] **Step 4: Run all tests and verify they pass**

```bash
npx tsx --test lib/weather.test.ts
```

Expected: all tests pass, including the 4 new route tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/weather/route.ts lib/weather.test.ts
git commit -m "feat: add /api/weather route with caching and error envelope"
```

---

## Task 3: Weather widget + sidebar integration

**Files:**
- Create: `components/weather-widget.tsx`
- Modify: `components/room-booking-sidebar.tsx`

**Interfaces:**
- Consumes: `GET /api/weather` from Task 2; `WeatherResult` type from `lib/weather.ts`.
- Props: `{ checkIn?: Date; checkOut?: Date }`

- [ ] **Step 1: Create `components/weather-widget.tsx`**

```tsx
"use client"

import * as React from "react"

import type { WeatherResult } from "@/lib/weather"

function formatDay(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  })
}

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-3 bg-muted rounded w-1/2" />
    </div>
  )
}

export function WeatherWidget({
  checkIn,
  checkOut,
}: {
  checkIn?: Date
  checkOut?: Date
}) {
  const [weather, setWeather] = React.useState<WeatherResult | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    const params = new URLSearchParams()
    if (checkIn) params.set("start", checkIn.toISOString().slice(0, 10))
    if (checkOut) params.set("end", checkOut.toISOString().slice(0, 10))

    fetch(`/api/weather?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: WeatherResult & { error?: string }) => {
        setWeather(data.error ? null : data)
        setLoading(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [checkIn, checkOut])

  if (loading) return <Skeleton />
  if (!weather) return null

  const hasForecast = checkIn && checkOut && weather.forecast.length > 0

  return (
    <div className="bg-muted/40 rounded-xl p-3 text-sm space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">
          {weather.current.icon}
        </span>
        <div>
          <p className="font-medium">
            {weather.current.tempC}°C · Feels like {weather.current.feelsLikeC}°C
          </p>
          <p className="text-muted-foreground text-xs">
            Wind {weather.current.windKph} km/h · {weather.current.label}
          </p>
        </div>
      </div>

      {hasForecast && (
        <>
          <div className="border-t" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Your stay forecast
          </p>
          <div className="space-y-1">
            {weather.forecast.map((day) => (
              <div
                key={day.date}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-muted-foreground w-24 shrink-0">
                  {formatDay(day.date)}
                </span>
                <span aria-hidden="true">{day.icon}</span>
                <span className="flex-1">
                  {day.highC}° / {day.lowC}°
                </span>
                <span className="text-muted-foreground">💧 {day.precipPct}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add `WeatherWidget` to `RoomBookingSidebar`**

In `components/room-booking-sidebar.tsx`, add the import at the top:

```ts
import { WeatherWidget } from "@/components/weather-widget"
```

Then after the existing weekend-rates note (the last element in the returned JSX), append:

```tsx
      <div className="border-t" />
      <WeatherWidget checkIn={range?.from} checkOut={range?.to} />
```

The full bottom of the `return` block should look like:

```tsx
      {hasWeekendRates && (
        <p className="text-muted-foreground text-center text-xs">
          Weekend nights may cost more than the rate shown above.
        </p>
      )}

      <div className="border-t" />
      <WeatherWidget checkIn={range?.from} checkOut={range?.to} />
    </div>
  )
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Start dev server and verify manually**

```bash
npm run dev
```

Open `http://localhost:3000`, navigate to any room detail page (e.g. `/rooms/queen-city-view`).

Verify:
- Weather card appears at the bottom of the booking sidebar with current conditions.
- No stay dates selected: only current conditions row shown; no "Your stay forecast" section.
- Select a date range: "Your stay forecast" section appears with one row per day in the stay.
- Clear dates: forecast section disappears.

- [ ] **Step 5: Commit**

```bash
git add components/weather-widget.tsx components/room-booking-sidebar.tsx
git commit -m "feat: add weather widget to room booking sidebar"
```

---

## Task 4: Concierge chat tool

**Files:**
- Modify: `lib/concierge/schemas.ts`
- Modify: `lib/concierge/tools.ts`
- Modify: `lib/concierge/config.ts`

**Interfaces:**
- Consumes: `getWeather` from `lib/weather.ts` (Task 1); `WeatherResult` type.
- Produces: `weatherInputSchema` (exported Zod schema); `get_weather` tool in `createGuestConciergeTools()`.

- [ ] **Step 1: Add `weatherInputSchema` to `lib/concierge/schemas.ts`**

Append to `lib/concierge/schemas.ts`:

```ts
export const weatherInputSchema = z.object({
  start_date: z.string().optional().describe("Stay start date as YYYY-MM-DD"),
  end_date: z.string().optional().describe("Stay end date as YYYY-MM-DD"),
})
```

- [ ] **Step 2: Add `get_weather` tool to `lib/concierge/tools.ts`**

Add the import at the top of `lib/concierge/tools.ts`:

```ts
import { getWeather } from "@/lib/weather"
import { weatherInputSchema } from "@/lib/concierge/schemas"
```

Add `get_weather` to the object returned by `createGuestConciergeTools()`:

```ts
    get_weather: tool({
      description:
        "Get current weather and forecast for the hotel location (Montréal, Old Port). " +
        "Use when a guest asks about weather or conditions during their stay or visit.",
      inputSchema: weatherInputSchema,
      execute: async ({ start_date, end_date }) =>
        getWeather({ startDate: start_date, endDate: end_date }),
    }),
```

- [ ] **Step 3: Update system prompt in `lib/concierge/config.ts`**

In `CONCIERGE_SYSTEM_PROMPT`, append one rule to the Rules list:

```ts
- Use get_weather when a guest asks about weather or conditions during their stay. Report temperatures in Celsius.
```

The updated constant should end with:

```ts
export const CONCIERGE_SYSTEM_PROMPT = `You are the Hôtel Levio guest concierge. Help visitors find rooms, check availability, quote stays in CAD, and prepare add-to-cart items.

Rules:
- Always use tools for availability, pricing, and cart preparation. Never invent prices, room counts, or availability.
- Prices are in Canadian dollars (CAD). Tool results include formatted display strings.
- Before preparing a cart item, confirm the room name, check-in, check-out, guest count, and total price with the guest.
- Only call prepare_cart_item after the guest explicitly agrees to add the stay to their cart.
- If dates are missing, ask for check-in, check-out, and number of guests.
- Keep replies concise and friendly. After a cart item is prepared, remind the guest they can review checkout on the cart page.
- Do not discuss admin operations, internal systems, or guest PII beyond what the user shares in chat.
- Use get_weather when a guest asks about weather or conditions during their stay. Report temperatures in Celsius.`
```

- [ ] **Step 4: Run lint and unit tests**

```bash
npm run lint && npm run test:unit
```

Expected: no lint errors, all tests pass.

- [ ] **Step 5: Verify in the concierge chat manually**

With the dev server running, open the concierge chat widget and send: `"What's the weather like this weekend?"`

Expected: the concierge calls the `get_weather` tool and responds with current conditions and a short forecast in Celsius.

- [ ] **Step 6: Commit**

```bash
git add lib/concierge/schemas.ts lib/concierge/tools.ts lib/concierge/config.ts
git commit -m "feat: add get_weather tool to concierge chat"
```

---

## Task 5: MCP server tool

**Files:**
- Modify: `mcp-server/index.ts`

**Interfaces:**
- Consumes: `getWeather` from `lib/weather.ts` (Task 1); `weatherInputSchema` from `lib/concierge/schemas.ts` (Task 4).

- [ ] **Step 1: Add `get_weather` to `mcp-server/index.ts`**

Add the imports:

```ts
import { getWeather } from "@/lib/weather"
import { weatherInputSchema } from "@/lib/concierge/schemas"
```

Register the tool after the existing `prepare_cart_item` registration:

```ts
server.registerTool(
  "get_weather",
  {
    description:
      "Get current weather and forecast for the hotel location (Montréal, Old Port). " +
      "Use when a guest asks about weather or conditions during their stay or visit.",
    inputSchema: weatherInputSchema,
  },
  async ({ start_date, end_date }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await getWeather({ startDate: start_date, endDate: end_date }),
        ),
      },
    ],
  }),
)
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mcp-server/index.ts
git commit -m "feat: add get_weather tool to MCP server"
```
