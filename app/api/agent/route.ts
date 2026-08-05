import { NextResponse } from "next/server"

import {
  AGENT_BRIDGE_TIMEOUT_MS,
  getAgentBridgeUrl,
  isAgentBridgeReachable,
  normalizeAgentBridgeMessages,
  type AgentBridgeResponse,
} from "@/lib/concierge/agent-bridge"
import { enrichAgentBridgeRooms } from "@/lib/concierge/enrich-listings"
import { checkRateLimit, getClientIp } from "@/lib/concierge/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const reachable = await isAgentBridgeReachable()
  if (!reachable) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "Python agent bridge is not running. Start the FastAPI app on port 8000.",
      },
      { status: 503 },
    )
  }

  return NextResponse.json({ configured: true })
}

export async function POST(req: Request) {
  const rateLimit = checkRateLimit(getClientIp(req))
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.error }, { status: 429 })
  }

  try {
    const body = (await req.json()) as {
      messages?: Parameters<typeof normalizeAgentBridgeMessages>[0]
    }

    const pythonResponse = await fetch(`${getAgentBridgeUrl()}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: normalizeAgentBridgeMessages(body.messages ?? []),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(AGENT_BRIDGE_TIMEOUT_MS),
    })

    if (!pythonResponse.ok) {
      let detail = `Python bridge responded with status: ${pythonResponse.status}`
      try {
        const errorBody = (await pythonResponse.json()) as { detail?: string }
        if (errorBody.detail) detail = errorBody.detail
      } catch {
        // ignore non-JSON error bodies
      }
      throw new Error(detail)
    }

    const data = (await pythonResponse.json()) as AgentBridgeResponse
    data.available_rooms = await enrichAgentBridgeRooms(data.available_rooms ?? [])
    return NextResponse.json(data)
  } catch (error) {
    console.error("[agent-bridge]", error)
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        {
          error:
            "The concierge service took too long to respond. Please try again in a moment.",
        },
        { status: 504 },
      )
    }
    return NextResponse.json(
      {
        error:
          "The concierge service is temporarily unavailable. Please try again in a moment.",
      },
      { status: 500 },
    )
  }
}
