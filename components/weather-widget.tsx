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
