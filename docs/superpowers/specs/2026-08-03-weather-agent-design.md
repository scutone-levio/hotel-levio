# Weather Agent — Design Spec

**Date:** 2026-08-03
**Branch:** feature to be created from `main`
**Status:** Approved

## Overview

Add weather awareness to Hôtel Levio in two places:

1. **Room detail page sidebar** — a compact weather card showing current conditions and a forecast scoped to the guest's selected stay dates.
2. **AI concierge chat** — a `get_weather` tool so guests can ask "what's the weather like this weekend?" and get a real answer.

Weather data comes from [Open-Meteo](https://open-meteo.com/) (free, no API key required). The hotel is located at **45.5048°N, 73.5521°W** (Old Port, Montréal, QC). All temperatures are in Celsius.

---

## Architecture

Six pieces, each with one job:

| Piece | File | Role |
|---|---|---|
| Weather lib | `lib/weather.ts` | Fetches Open-Meteo, maps WMO codes, returns typed `WeatherResult` |
| API route | `app/api/weather/route.ts` | GET handler for client consumption; adds HTTP caching |
| Widget | `components/weather-widget.tsx` | Client component rendered in the booking sidebar |
| Sidebar integration | `components/room-booking-sidebar.tsx` | Passes selected dates to the widget |
| Concierge tool | `lib/concierge/tools.ts` + `schemas.ts` | `get_weather` tool for the AI SDK chat path |
| MCP tool | `mcp-server/index.ts` | Mirrors `get_weather` for the MCP path |

Data flows:
- Widget → `GET /api/weather` → `lib/weather.ts` → Open-Meteo
- Chat tool → `lib/weather.ts` → Open-Meteo (direct, no HTTP hop)
- MCP tool → `lib/weather.ts` → Open-Meteo (direct, no HTTP hop)

Nothing touches the database.

---

## Data Layer

### `lib/weather.ts`

Exports one function:

```ts
export async function getWeather(opts?: {
  startDate?: string  // YYYY-MM-DD
  endDate?: string    // YYYY-MM-DD
}): Promise<WeatherResult>
```

Builds a single Open-Meteo request:

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=45.5048
  &longitude=-73.5521
  &current=temperature_2m,apparent_temperature,windspeed_10m,weathercode
  &daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode
  &timezone=America/Toronto
  &temperature_unit=celsius
```

The `daily` array is trimmed to `[startDate, endDate]` when provided; otherwise defaults to the next 3 days. WMO weather codes are mapped to a `{ label, icon }` pair via a local lookup table (no runtime dependency).

Return type:

```ts
type WeatherResult = {
  current: {
    tempC: number
    feelsLikeC: number
    windKph: number
    label: string   // e.g. "Partly cloudy"
    icon: string    // e.g. "⛅"
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
```

Throws on non-2xx responses from Open-Meteo.

### WMO Code Mapping

A static lookup table maps the subset of WMO codes returned by Open-Meteo to a label and emoji. Key mappings:

| Code(s) | Label | Icon |
|---|---|---|
| 0 | Clear sky | ☀️ |
| 1–3 | Partly cloudy | ⛅ |
| 45, 48 | Foggy | 🌫️ |
| 51–57 | Drizzle | 🌦️ |
| 61–67 | Rain | 🌧️ |
| 71–77 | Snow | 🌨️ |
| 80–82 | Rain showers | 🌦️ |
| 85–86 | Snow showers | 🌨️ |
| 95–99 | Thunderstorm | ⛈️ |

Unmapped codes fall back to `{ label: "Variable", icon: "🌡️" }`.

### `app/api/weather/route.ts`

```ts
GET /api/weather?start=YYYY-MM-DD&end=YYYY-MM-DD
```

- `start` and `end` are optional; validated with `/^\d{4}-\d{2}-\d{2}$/`.
- Invalid date format → params ignored (treated as absent), not a 400.
- Calls `getWeather({ startDate, endDate })` and returns JSON.
- On any error: returns `{ error: "unavailable" }` with status 200.
- Response header: `Cache-Control: s-maxage=900, stale-while-revalidate=300` (15-min cache).

---

## Widget

### `components/weather-widget.tsx`

Client component. Props:

```ts
{ checkIn?: Date; checkOut?: Date }
```

Fetches `/api/weather` on mount and whenever `checkIn`/`checkOut` change. Uses `AbortController` to cancel in-flight requests on prop change.

**Render states:**

- **Loading** — slim skeleton matching the card width (one line for current, one row for forecast)
- **Error / no data** — renders nothing (`null`); sidebar layout is unaffected
- **Loaded** — compact card:

```
┌─────────────────────────────────┐
│ ⛅  18°C  Feels like 16°C       │
│    Wind 14 km/h · Partly cloudy │
├─────────────────────────────────┤
│ Your stay forecast              │  ← hidden when no dates selected
│ Fri  ⛅ 22° / 14°  💧 20%      │
│ Sat  🌧 19° / 12°  💧 60%      │
│ Sun  ☀️  24° / 15°  💧  5%      │
└─────────────────────────────────┘
```

The forecast section is hidden entirely when no dates are selected — no placeholder message. Styling: `bg-muted/40 rounded-xl p-3 text-sm` to feel subordinate to the booking form above it.

### Integration in `RoomBookingSidebar`

Below the existing "Clear dates" button, add a `border-t` and render:

```tsx
<WeatherWidget checkIn={range?.from} checkOut={range?.to} />
```

`range` is already tracked as state in `RoomBookingSidebar` — no new state needed.

---

## Chat Tool

### `lib/concierge/schemas.ts`

Add a shared Zod schema:

```ts
export const weatherInputSchema = z.object({
  start_date: z.string().optional().describe("Stay start date as YYYY-MM-DD"),
  end_date: z.string().optional().describe("Stay end date as YYYY-MM-DD"),
})
```

### `lib/concierge/tools.ts`

Add to `createGuestConciergeTools()`:

```ts
get_weather: tool({
  description:
    "Get current weather and forecast for the hotel location (Montréal, Old Port). " +
    "Use when a guest asks about weather or conditions during their stay or visit.",
  inputSchema: weatherInputSchema,
  execute: async ({ start_date, end_date }) =>
    getWeather({ startDate: start_date, endDate: end_date }),
})
```

Update `CONCIERGE_SYSTEM_PROMPT` with one line:

> `- Use get_weather when a guest asks about weather or conditions during their stay. Report temperatures in Celsius.`

### `mcp-server/index.ts`

Add a matching `server.registerTool("get_weather", ...)` that calls `getWeather` from `lib/weather.ts` directly, using `weatherInputSchema` for the input schema.

---

## Error Handling

| Layer | Behaviour |
|---|---|
| `lib/weather.ts` | Throws on non-2xx; callers handle |
| `/api/weather` | Catches all errors, returns `{ error: "unavailable" }` with 200 |
| `weather-widget.tsx` | On `error` field or fetch failure: renders `null` silently |
| Chat tool | Error propagates to AI SDK; LLM handles gracefully in prose |
| MCP tool | Same as chat tool |

No retry logic. Open-Meteo is highly available; the 15-min cache keeps load minimal.

---

## Testing

### Unit tests — `lib/weather.ts`

- Mock `fetch`; assert correct Open-Meteo URL is called with hotel coordinates.
- Assert WMO code mapping for representative codes: 0 (clear), 2 (partly cloudy), 63 (rain), 71 (snow), 95 (thunderstorm).
- Assert daily forecast is trimmed to `[startDate, endDate]` when provided.
- Assert next 3 days are returned when no dates given.
- Assert throws on non-2xx response.

### Unit tests — `app/api/weather/route.ts`

- Mock `getWeather`; assert `Cache-Control` header is present in the response.
- Assert `{ error: "unavailable" }` with status 200 when `getWeather` throws.
- Assert invalid date format params are ignored (no 400 returned).

### No E2E tests

The widget silently hides on error, and the happy path depends on Open-Meteo availability — a fragile E2E dependency. Manual verification during development is sufficient.

---

## Files Created / Modified

| Action | File |
|---|---|
| Create | `lib/weather.ts` |
| Create | `app/api/weather/route.ts` |
| Create | `components/weather-widget.tsx` |
| Modify | `components/room-booking-sidebar.tsx` |
| Modify | `lib/concierge/tools.ts` |
| Modify | `lib/concierge/schemas.ts` |
| Modify | `lib/concierge/config.ts` (system prompt) |
| Modify | `mcp-server/index.ts` |
