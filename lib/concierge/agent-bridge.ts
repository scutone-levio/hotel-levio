const DEFAULT_AGENT_BRIDGE_URL = "http://127.0.0.1:8000"

/** Deadline for a single agent bridge request before it is aborted (ms). */
export const AGENT_BRIDGE_TIMEOUT_MS = 30_000

export function getAgentBridgeUrl(): string {
  return process.env.AGENT_BRIDGE_URL?.trim() || DEFAULT_AGENT_BRIDGE_URL
}

export type AgentBridgeMessage = {
  role: string
  content: string
}

export type AgentBridgeRoom = {
  room: string
  price_per_night_cents: number
  price_display?: string
  room_type_slug?: string
  room_type_name?: string
  view?: string
  capacity?: number
  beds?: number
  featured?: boolean
  roomId?: string
  subcategoryId?: string
  detailUrl?: string
  imageUrl?: string | null
  amenities: string[]
}

export type AgentBridgeResponse = {
  reply: string
  booking_details: Record<string, unknown>
  available_rooms: AgentBridgeRoom[]
  personalized_offer: string
}

type IncomingBridgeMessage = {
  role: string
  content?: string
  parts?: Array<{ type: string; text?: string }>
}

export function normalizeAgentBridgeMessages(
  messages: IncomingBridgeMessage[],
): AgentBridgeMessage[] {
  return messages.map((message) => {
    if (typeof message.content === "string") {
      return { role: message.role, content: message.content }
    }

    const content =
      message.parts
        ?.filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("") ?? ""

    return { role: message.role, content }
  })
}

export async function isAgentBridgeReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${getAgentBridgeUrl()}/openapi.json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}
