"use client"

import * as React from "react"

import type { KnowledgeCitation } from "@/lib/concierge/knowledge-bridge"
import { Button } from "@/components/ui/button"

type AnswerState = {
  answer: string
  citations: KnowledgeCitation[]
  found: boolean
}

export function KnowledgePanel() {
  const [question, setQuestion] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<AnswerState | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const text = question.trim()
    if (!text || loading) return

    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      })
      const data = (await response.json()) as
        | { ok: true; answer: string; citations: KnowledgeCitation[]; found: boolean }
        | { ok: false; error: string }
      if (!data.ok) {
        setError(data.error)
        return
      }
      setResult({ answer: data.answer, citations: data.citations, found: data.found })
    } catch {
      setError("Could not reach the policy search service.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          aria-label="Policy question"
          placeholder="e.g. What is the guest cancellation policy?"
          className="border-input bg-background h-10 min-w-0 flex-1 rounded-md border px-3 text-sm outline-none"
        />
        <Button type="submit" variant="action" disabled={loading || !question.trim()}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Policy search unavailable</p>
          <p className="text-muted-foreground mt-1">{error}</p>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="whitespace-pre-wrap">{result.answer}</p>
          {result.citations.length > 0 ? (
            <details className="mt-3">
              <summary className="text-muted-foreground cursor-pointer text-xs font-medium">
                Sources ({result.citations.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {result.citations.map((citation, index) => (
                  <li key={`${citation.source}-${citation.page}-${index}`} className="text-muted-foreground text-xs">
                    <span className="font-medium">
                      {citation.source}, p. {citation.page}
                    </span>
                    <span className="mt-0.5 block">{citation.snippet}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
