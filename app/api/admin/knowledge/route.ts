import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { askKnowledgeBridge } from "@/lib/concierge/knowledge-bridge"
import { checkRateLimit, getClientIp } from "@/lib/concierge/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const rate = checkRateLimit(getClientIp(req))
  if (!rate.ok) {
    return NextResponse.json({ ok: false, error: rate.error }, { status: 429 })
  }

  let question = ""
  try {
    const body = (await req.json()) as { question?: string }
    question = (body.question ?? "").trim()
  } catch {
    question = ""
  }
  if (!question) {
    return NextResponse.json({ ok: false, error: "Question is required." }, { status: 400 })
  }

  const result = await askKnowledgeBridge(question)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 })
  }
  return NextResponse.json({ ok: true, ...result.data })
}
