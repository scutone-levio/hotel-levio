import { AGENT_BRIDGE_TIMEOUT_MS, getAgentBridgeUrl } from "@/lib/concierge/agent-bridge"

export type KnowledgeCitation = { source: string; page: number; snippet: string }
export type KnowledgeAnswer = {
  answer: string
  citations: KnowledgeCitation[]
  found: boolean
}
export type KnowledgeResult =
  | { ok: true; data: KnowledgeAnswer }
  | { ok: false; error: string }

export async function askKnowledgeBridge(question: string): Promise<KnowledgeResult> {
  try {
    const response = await fetch(`${getAgentBridgeUrl()}/api/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      cache: "no-store",
      signal: AbortSignal.timeout(AGENT_BRIDGE_TIMEOUT_MS),
    })

    if (response.status === 503) {
      return {
        ok: false,
        error: "The policy knowledge base has not been ingested yet. Run python ingest_kb.py.",
      }
    }
    if (!response.ok) {
      return { ok: false, error: "The policy search service is unavailable." }
    }

    const data = (await response.json()) as KnowledgeAnswer
    return { ok: true, data }
  } catch {
    return { ok: false, error: "Could not reach the policy search service." }
  }
}
