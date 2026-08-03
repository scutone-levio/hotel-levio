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
