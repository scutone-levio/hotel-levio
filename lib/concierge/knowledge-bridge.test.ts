import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import { askKnowledgeBridge } from "./knowledge-bridge"

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

test("maps a 200 response to ok with data", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ answer: "Cancel free up to 24h.", citations: [], found: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch

  const result = await askKnowledgeBridge("cancellation policy?")
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.data.answer, "Cancel free up to 24h.")
})

test("maps a 503 to a not-ingested error", async () => {
  globalThis.fetch = (async () => new Response("{}", { status: 503 })) as typeof fetch
  const result = await askKnowledgeBridge("x")
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /ingested/i)
})

test("maps a network throw to a reachable-service error", async () => {
  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED")
  }) as typeof fetch
  const result = await askKnowledgeBridge("x")
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /reach/i)
})
