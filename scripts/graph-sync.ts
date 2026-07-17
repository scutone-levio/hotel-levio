import { syncGraphFromPostgresAndClose } from "@/lib/graph-sync"
import { isNeo4jConfigured } from "@/lib/neo4j"

async function main() {
  if (!isNeo4jConfigured()) {
    console.error(
      "Neo4j is not configured. Copy NEO4J_* vars from .env.example and run: docker compose up -d neo4j",
    )
    process.exit(1)
  }

  console.log("Syncing Postgres data into Neo4j…")
  const stats = await syncGraphFromPostgresAndClose()
  console.log("Graph sync complete:")
  console.log(`  Room types:    ${stats.roomTypes}`)
  console.log(`  Subcategories: ${stats.subcategories}`)
  console.log(`  Rooms:         ${stats.rooms}`)
  console.log(`  Amenities:     ${stats.amenities}`)
  console.log(`  Users:         ${stats.users}`)
  console.log(`  Bookings:      ${stats.bookings}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
