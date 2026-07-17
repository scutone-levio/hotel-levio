import { InsightsDashboard } from "@/components/admin/insights-dashboard"
import { getGraphInsights } from "@/lib/graph-insights"

export const metadata = { title: "Insights — Hôtel Levio Admin" }
export const dynamic = "force-dynamic"

export default async function AdminInsightsPage() {
  const insights = await getGraphInsights()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl tracking-tight">Insights</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Relationship views across room types, inventory, amenities, and
          bookings — powered by Neo4j (read-only analytics).
        </p>
      </div>

      {!insights.connected ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">Graph database unavailable</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-lg text-sm">
            {insights.reason === "not_configured"
              ? "Neo4j is not configured. Add NEO4J_URI and NEO4J_PASSWORD to your .env file (see .env.example)."
              : "Could not connect to Neo4j. Ensure the service is running and credentials are correct."}
          </p>
          <ol className="text-muted-foreground mx-auto mt-4 max-w-md list-decimal space-y-1 text-left text-sm">
            <li>
              Start Neo4j:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                docker compose up -d neo4j
              </code>
            </li>
            <li>
              Sync from Postgres:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                npm run graph:sync
              </code>
            </li>
            <li>Refresh this page</li>
          </ol>
          <p className="text-muted-foreground mt-4 text-xs">
            Browser UI:{" "}
            <a
              href="http://localhost:7474"
              className="text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              http://localhost:7474
            </a>
          </p>
        </div>
      ) : (
        <InsightsDashboard insights={insights} />
      )}
    </div>
  )
}
