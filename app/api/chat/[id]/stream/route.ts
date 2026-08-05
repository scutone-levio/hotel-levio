export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** AI SDK reconnect probe — no persisted stream in v1. */
export async function GET() {
  return new Response(null, { status: 204 })
}
