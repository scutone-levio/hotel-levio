# Admin Insights — Relationship Samples Expansion — Design Spec

**Date:** 2026-07-17  
**Status:** Approved

## Overview

Expand the **Relationship samples** section on `/admin/insights` so every room type tab lists **all rooms** for that type, each with **all linked amenities** displayed as small inline chips. Fixes the current bug where only 10 rows are returned globally (King Room fills the cap; other tabs show empty).

## Problem

The Cypher query in `lib/graph-insights.ts` applies `LIMIT 10` across all room types and returns a single sample amenity via `head(collect(DISTINCT a.name))`. The UI filters those 10 rows by active tab, so Queen Room, Penthouse, Suite, and Twin Room tabs often show "No sample paths for this type" despite graph data existing.

## Requirements

1. **Complete room coverage** — every synced `Room` node appears under its `RoomType` tab.
2. **Full amenity lists** — each room row shows all amenities linked via `HAS_AMENITY`, not one sample.
3. **One row per room** — subcategory and room number appear once; amenities share a single cell.
4. **Inline chips** — amenities render as small `Badge` components (`variant="secondary"`), wrapping with `flex flex-wrap gap-1`.
5. **No pagination** — hotel inventory is ~61 rooms; load all rows in one query.

## Data layer

### Type change (`lib/graph-insights.ts`)

Rename and extend the row type:

```ts
export type RoomRelationshipRow = {
  typeName: string
  subcategoryName: string | null
  roomNumber: string
  amenityNames: string[]
}
```

Replace `relationshipSamples: RelationshipSampleRow[]` with `roomRelationships: RoomRelationshipRow[]` on `GraphInsights`.

### Cypher query

```cypher
MATCH (rt:RoomType)<-[:INSTANCE_OF]-(r:Room)
OPTIONAL MATCH (r)-[:IN_SUBCATEGORY]->(sc:Subcategory)
OPTIONAL MATCH (r)-[:HAS_AMENITY]->(a:Amenity)
RETURN rt.name AS typeName,
       sc.name AS subcategoryName,
       r.roomNumber AS roomNumber,
       collect(DISTINCT a.name) AS amenityNames
ORDER BY typeName, roomNumber
```

- Remove `LIMIT 10`.
- Filter null amenity names in JS after the query (`amenityNames.filter(Boolean)`), then sort alphabetically per row.
- Room scope: all rooms synced to Neo4j (includes catalog and archived), consistent with current graph sync.

## UI (`components/admin/insights-dashboard.tsx`)

| Element | Change |
|---------|--------|
| Data source | Filter `insights.roomRelationships` by `typeName` per tab |
| Column header | "Sample amenity" → **Amenities** |
| Amenities cell | `flex flex-wrap gap-1` container of `<Badge variant="secondary">` per amenity |
| Empty amenities | Show `—` (no chips) |
| Empty type tab | "No rooms for this type." (only when type truly has zero rooms) |
| Section title | Keep **Relationship samples**; subtitle unchanged |

Chip styling follows existing admin patterns (e.g. amenities manager category badges).

## Error handling

No new failure modes. If Neo4j is unreachable, the existing empty/unavailable state on the insights page applies unchanged.

## Testing

1. Run `npm run graph:sync`.
2. Open `/admin/insights`.
3. Verify each room type tab (King, Queen, Penthouse, Suite, Twin) lists all rooms for that type.
4. Verify rooms with multiple amenities show all names as chips.
5. Verify rooms with no amenities show `—`.
6. Run `npm run lint` and typecheck.

## Files to change

| File | Change |
|------|--------|
| `lib/graph-insights.ts` | Update query, types, return shape |
| `components/admin/insights-dashboard.tsx` | Chip rendering, updated field names |

## Out of scope

- Per-tab lazy loading or pagination
- Filtering out catalog/archived rooms
- Expandable rows or room–amenity pair rows
- Renaming the section to "Room relationships"
