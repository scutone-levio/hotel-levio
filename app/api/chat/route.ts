import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai"

import {
  CONCIERGE_SYSTEM_PROMPT,
  createGuestConciergeTools,
} from "@/lib/concierge/tools"
import { getConciergeModel, isConciergeConfigured } from "@/lib/concierge/model"
import { getConciergeConfigError } from "@/lib/concierge/config"
import { formatConciergeStreamError } from "@/lib/concierge/errors"
import { checkRateLimit, getClientIp } from "@/lib/concierge/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (!isConciergeConfigured()) {
    return Response.json(
      {
        configured: false,
        error: getConciergeConfigError(),
      },
      { status: 503 },
    )
  }

  return Response.json({ configured: true })
}

export async function POST(request: Request) {
  if (!isConciergeConfigured()) {
    return Response.json(
      {
        error:
          getConciergeConfigError() ??
          "Concierge is not configured. Set LLM_PROVIDER and API keys.",
      },
      { status: 503 },
    )
  }

  const rateLimit = checkRateLimit(getClientIp(request))
  if (!rateLimit.ok) {
    return Response.json({ error: rateLimit.error }, { status: 429 })
  }

  let messages: UIMessage[]
  try {
    const body = (await request.json()) as { messages?: UIMessage[] }
    messages = body.messages ?? []
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  try {
    const result = streamText({
      model: getConciergeModel(),
      system: CONCIERGE_SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools: createGuestConciergeTools(),
      stopWhen: stepCountIs(5),
      onError: ({ error }) => {
        console.error("[concierge]", error)
      },
    })

    return result.toUIMessageStreamResponse({
      onError: (error) => formatConciergeStreamError(error),
    })
  } catch (err) {
    console.error("[concierge]", err)
    return Response.json(
      { error: "Concierge temporarily unavailable" },
      { status: 500 },
    )
  }
}
