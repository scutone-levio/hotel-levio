# Insights Relationship Samples Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `/admin/insights` Relationship samples so every room type tab lists all rooms with all linked amenities shown as inline chips.

**Architecture:** Remove the global `LIMIT 10` in the Neo4j read query, return `amenityNames: string[]` per room via `collect(DISTINCT a.name)`, normalize/sort amenity names with a small pure helper, and render chips in the existing tabbed table UI.

**Tech Stack:** Next.js 15, Neo4j driver (`runReadQuery`), React client component, shadcn `Badge`, Node.js built-in test runner (`tsx --test`)

## Global Constraints

- One row per room; amenities share a single table cell
- Amenities render as `<Badge variant="secondary">` in a `flex flex-wrap gap-1` container
- Empty amenity list displays `—` (em dash)
- Empty type tab message: `No rooms for this type.`
- Column header text: **Amenities** (not "Sample amenity")
- Section title stays **Relationship samples**; subtitle unchanged
- Include all synced rooms (catalog + archived); no pagination
- Filter null amenity names in JS, then sort alphabetically per row
- Unit tests use `import assert from "node:assert/strict"` and `import { describe, it } from "node:test"`
- After every task: run `npm run lint` and `npm run typecheck`; fix errors before committing

---

### Task 1: Amenity name normalization helper + unit tests

**Files:**
- Modify: `lib/graph-insights.ts` (add exported helper at bottom of file)
- Create: `lib/graph-insights.test.ts`
- Modify: `package.json` (add `lib/graph-insights.test.ts` to `test:unit` script)

**Interfaces:**
- Produces:
  - `normalizeAmenityNames(raw: unknown): string[]` — filters falsy/null entries from Neo4j collect results, sorts alphabetically, returns deduplicated string array

- [ ] **Step 1: Write the failing tests**

Create `lib/graph-insights.test.ts`:

```ts
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { normalizeAmenityNames } from "./graph-insights"

describe("normalizeAmenityNames", () => {
  it("returns empty array for null/undefined", () => {
    assert.deepEqual(normalizeAmenityNames(null), [])
    assert.deepEqual(normalizeAmenityNames(undefined), [])
  })

  it("returns empty array for empty input", () => {
    assert.deepEqual(normalizeAmenityNames([]), [])
  })

  it("filters null entries from Neo4j collect results", () => {
    assert.deepEqual(
      normalizeAmenityNames(["Mini-fridge", null, "Smart TV"]),
      ["Mini-fridge", "Smart TV"],
    )
  })

  it("sorts alphabetically", () => {
    assert.deepEqual(
      normalizeAmenityNames(["Zebra", "Alpha", "Beta"]),
      ["Alpha", "Beta", "Zebra"],
    )
  })

  it("deduplicates names", () => {
    assert.deepEqual(
      normalizeAmenityNames(["Alpha", "Alpha", "Beta"]),
      ["Alpha", "Beta"],
    )
  })
})
```

Add `lib/graph-insights.test.ts` to the `test:unit` script array in `package.json`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- lib/graph-insights.test.ts`

Expected: FAIL — `normalizeAmenityNames` is not exported / not defined

- [ ] **Step 3: Write minimal implementation**

Add to the bottom of `lib/graph-insights.ts`:

```ts
export function normalizeAmenityNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const names = raw.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  )
  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- lib/graph-insights.test.ts`

Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/graph-insights.ts lib/graph-insights.test.ts package.json
git commit -m "test: add normalizeAmenityNames helper for graph insights"
```

---

### Task 2: Expand graph-insights query and types

**Files:**
- Modify: `lib/graph-insights.ts`

**Interfaces:**
- Consumes: `normalizeAmenityNames(raw: unknown): string[]` from Task 1
- Produces:
  - `RoomRelationshipRow` type with `amenityNames: string[]`
  - `GraphInsights.roomRelationships: RoomRelationshipRow[]` (replaces `relationshipSamples`)

- [ ] **Step 1: Update types**

In `lib/graph-insights.ts`, replace:

```ts
export type RelationshipSampleRow = {
  typeName: string
  subcategoryName: string | null
  roomNumber: string
  amenityName: string | null
}
```

with:

```ts
export type RoomRelationshipRow = {
  typeName: string
  subcategoryName: string | null
  roomNumber: string
  amenityNames: string[]
}
```

On `GraphInsights`, replace `relationshipSamples: RelationshipSampleRow[]` with `roomRelationships: RoomRelationshipRow[]`.

- [ ] **Step 2: Update Cypher query**

Replace the relationship samples query block (the last item in the `Promise.all` array). Change the destructured variable from `sampleRows` to `relationshipRows`. New query:

```ts
runReadQuery<{
  typeName: string
  subcategoryName: string | null
  roomNumber: string
  amenityNames: unknown
}>(
  `
  MATCH (rt:RoomType)<-[:INSTANCE_OF]-(r:Room)
  OPTIONAL MATCH (r)-[:IN_SUBCATEGORY]->(sc:Subcategory)
  OPTIONAL MATCH (r)-[:HAS_AMENITY]->(a:Amenity)
  RETURN rt.name AS typeName,
         sc.name AS subcategoryName,
         r.roomNumber AS roomNumber,
         collect(DISTINCT a.name) AS amenityNames
  ORDER BY typeName, roomNumber
  `,
),
```

Remove the old query's `LIMIT 10` and `head(collect(...)) AS amenityName`.

- [ ] **Step 3: Map query results**

Replace the return mapping for relationship samples:

```ts
roomRelationships: relationshipRows.map((row) => ({
  typeName: row.typeName,
  subcategoryName: row.subcategoryName,
  roomNumber: row.roomNumber,
  amenityNames: normalizeAmenityNames(row.amenityNames),
})),
```

- [ ] **Step 4: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`

Expected: Type errors in `components/admin/insights-dashboard.tsx` referencing `relationshipSamples` — that is expected until Task 3. If other files reference the old type/name, fix them in Task 3.

- [ ] **Step 5: Commit**

```bash
git add lib/graph-insights.ts
git commit -m "feat: return all room relationships with full amenity lists from Neo4j"
```

---

### Task 3: Render amenity chips in insights dashboard

**Files:**
- Modify: `components/admin/insights-dashboard.tsx`

**Interfaces:**
- Consumes: `GraphInsights.roomRelationships: RoomRelationshipRow[]` from Task 2
- Produces: Updated Relationship samples table UI with inline amenity chips

- [ ] **Step 1: Add Badge import**

At top of `components/admin/insights-dashboard.tsx`:

```ts
import { Badge } from "@/components/ui/badge"
```

- [ ] **Step 2: Update data filtering**

Replace:

```ts
const samples = insights.relationshipSamples.filter(
  (row) => row.typeName === name,
)
```

with:

```ts
const rows = insights.roomRelationships.filter(
  (row) => row.typeName === name,
)
```

- [ ] **Step 3: Update table header and body**

Change column header from `Sample amenity` to `Amenities`.

Replace the tbody rendering. Use `rows` instead of `samples`. Update empty-state copy to `No rooms for this type.` Amenities cell:

```tsx
<td className="px-2 py-2">
  {row.amenityNames.length ? (
    <div className="flex flex-wrap gap-1">
      {row.amenityNames.map((amenity) => (
        <Badge key={amenity} variant="secondary">
          {amenity}
        </Badge>
      ))}
    </div>
  ) : (
    "—"
  )}
</td>
```

Update the row key to remain stable:

```tsx
key={`${row.roomNumber}-${row.subcategoryName ?? "none"}`}
```

- [ ] **Step 4: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`

Expected: PASS with no errors

- [ ] **Step 5: Manual verification**

Run: `npm run graph:sync` (requires Neo4j running via `docker compose up -d`)

Start dev server if not running: `npm run dev`

Open: `http://localhost:3000/admin/insights`

Verify:
- King Room tab lists all king rooms (not capped at 10)
- Queen Room, Penthouse, Suite, Twin tabs show rooms (no longer empty)
- Rooms with multiple amenities show all names as secondary badges
- Rooms with no amenities show `—`

- [ ] **Step 6: Commit**

```bash
git add components/admin/insights-dashboard.tsx
git commit -m "feat: show all room amenities as inline chips on insights page"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| Complete room coverage (remove LIMIT 10) | Task 2 |
| Full amenity lists (`amenityNames: string[]`) | Task 2 |
| One row per room | Task 2 + Task 3 |
| Inline chips (`Badge variant="secondary"`) | Task 3 |
| No pagination | Task 2 (no LIMIT) |
| Filter null + sort amenities | Task 1 |
| Column header "Amenities" | Task 3 |
| Empty amenities → `—` | Task 3 |
| Empty type → "No rooms for this type." | Task 3 |
| Section title unchanged | Task 3 (no title change) |

## Out of Scope (confirmed)

- Per-tab lazy loading
- Catalog/archived filtering
- Expandable rows
- Section rename
