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

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
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
      (i) => times[i] >= opts.startDate! && times[i] < opts.endDate!,
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
