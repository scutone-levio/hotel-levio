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
