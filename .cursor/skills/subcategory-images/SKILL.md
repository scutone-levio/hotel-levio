---
name: subcategory-images
description: >-
  Curates subcategory listing galleries with exactly one bed photo (two twin beds
  for TWIN), one hotel washroom, and one lounge area with couch and desk. Uses
  only well-lit hotel room images — no residential, apartment, or dark photography.
  Use when adding or updating SubcategoryImage rows, lib/twin-subcategory-images.ts,
  admin subcategory uploads, or when the user mentions subcategory photos, room
  gallery, Unsplash, Pexels, Pixabay, or Lummi.
---

# Subcategory listing images

Each **Room Type → Subcategory** gallery (e.g. Twin · City View) must tell a consistent interior story in **exactly 3 photos**, in this order:

| # | Slot | Content |
|---|------|---------|
| 1 | **Beds** | One bed photo only. **TWIN:** both twin beds visible in a single frame. **QUEEN / KING / SUITE:** one bed (or primary sleeping area) — no second bed shot elsewhere in the gallery. |
| 2 | **Washroom** | Hotel bathroom only — shower, vanity, tub, or toilet area. No beds, no kitchen. |
| 3 | **Lounge** | One **in-room hotel** shot with **both a couch (or sofa / armchairs) and a desk** visible. No beds in frame. Must read as a hotel guest room — not a residential living room. |

The first image is the **cover** on listing cards (`sortOrder` 0).

## Image quality (non-negotiable)

Every gallery photo must pass **both** gates below. If either fails, do not use the image.

### 1. Hotel room only — no residential

Use **only** photos taken inside a **hotel or boutique-hotel guest room** (including its en-suite bathroom or in-room sitting area).

**Never use:**

- Residential homes, condos, or apartments
- Airbnb / vacation-rental interiors
- Generic “living room”, “bedroom”, or “home interior” stock
- Hostels, dorm-style rooms, or co-living spaces
- Hotel lobbies, corridors, or restaurants (unless explicitly asked)
- Furniture showrooms or staged residential sets

**Pass test:** Would a guest reasonably believe this was photographed in a **hotel room they could book**? If not, reject.

### 2. Well-lit only — no dark images

Use **bright, evenly lit** hotel photography where bedding, tile, furniture, and walls are clearly visible.

**Never use:**

- Dim, moody, underexposed, or night-time shots
- Heavy shadows covering most of the room
- “Warmly lit” or “ambient” photos where details are hard to see
- Low-light desk or bathroom shots

**Pass test:** Can you clearly see room details without squinting? If not, reject.

## Hard rules

- **One bed image total** — never add a second photo where beds are the subject or clearly dominate the frame (wide room layouts, “foyer” shots that show the bed, desk-in-bedroom crops that include beds).
- **Hotel room only** — see [Image quality](#image-quality-non-negotiable) above; residential and non-hotel interiors are forbidden.
- **Well-lit only** — see [Image quality](#image-quality-non-negotiable) above; dark or moody photos are forbidden.
- **Interior only** — no building exteriors, balconies, skylines, or window views where outdoors is the focus.
- **No kitchens** — no kitchenettes, wet bars, stoves, or open-plan kitchen/living that reads as a kitchen.
- **Max 5 images** in the system (`addSubcategoryImage` rejects a 6th) — default to **3** unless the user explicitly asks for more.

## Where images live

| Path | Use |
|------|-----|
| `lib/twin-subcategory-images.ts` | Seed galleries for Twin subcategories (Lake View, City View, Lower Level) |
| `lib/queen-subcategory-images.ts` | Seed galleries for Queen subcategories |
| Admin → Catalog → subcategory **Manage** | Upload via UploadThing (`components/admin/subcategory-manage-dialog.tsx`) |
| `prisma/seed.ts` → `ensureTwinSubcategoryImages()` (and the Queen/King/Suite equivalents) | Seeds a subcategory from its `*SubcategoryImagesByName` map only if it has no images yet — non-destructive, never overwrites a populated gallery (seeded or admin-uploaded) |
| `lib/listing-images.ts` | Guest UI uses subcategory images when present; otherwise catalog `RoomImage` fallback |

After changing seed definitions, run `npm run db:seed` then `npx tsx scripts/check-images.ts` to confirm every URL returns HTTP 200.

## Sourcing images (Unsplash, Pexels, Pixabay, Lummi)

Use free stock sites. **Every search must include `hotel room`** (not just `hotel` or `interior`). Prefer results tagged **hotel**, **hospitality**, or **boutique hotel**. Skip anything tagged **home**, **apartment**, **residential**, or **living room** without a hotel context.

Add **`bright`**, **`well-lit`**, or **`daylight`** to every query.

**Beds (TWIN — two twins in one photo)**

- `bright hotel twin room two beds`, `well-lit hotel twin bed room`, `boutique hotel twin room`

**Beds (other types)**

- `bright hotel queen room`, `well-lit hotel king bedroom`, `boutique hotel room bed`

**Washroom**

- `bright hotel bathroom`, `hotel ensuite shower well-lit`, `marble hotel bathroom daylight`

**Lounge (couch + desk)**

- `bright hotel room sitting area desk`, `hotel suite sofa desk daylight`, `well-lit hotel room lounge desk`

### Reject during visual review

**Residential / non-hotel:**

- Titles or tags: **apartment**, **home**, **house**, **condo**, **residential**, **Airbnb**, **living room** (without hotel), **interior design** (residential staging), **hostel**
- Room styling that looks like a private home (personal clutter, family photos, non-hotel furniture packages)

**Dark / low-light:**

- Titles or tags: **dimly lit**, **moody**, **night**, **dark**, **low light**, **warmly lit**, **ambient**, **candlelit**
- Most of the frame in shadow; bedding, tile, or furniture not clearly visible

### Site-specific notes

| Source | How to use | URL / CDN |
|--------|------------|-----------|
| **Unsplash** | Search → open photo → copy CDN link. Prefer `?auto=format&fit=crop&w=1200&q=80`. | `images.unsplash.com` — already in `next.config.ts` |
| **Pexels** | Free download → use direct image URL from asset page. | Usually `images.pexels.com` — add to `next.config.ts` `images.remotePatterns` if used in `<Image>` |
| **Pixabay** | Free download → use CDN URL from image page. | Usually `cdn.pixabay.com` — add remote pattern if needed |
| **Lummi** | [lummi.ai](https://www.lummi.ai) — search hotel/interior; use provided CDN URL. | Add hostname to `next.config.ts` when first used |

**Unsplash helper in seed files:**

```ts
const u = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`
```

### Before committing a URL

1. **HTTP check** — `curl -s -o /dev/null -w "%{http_code}" "<url>"` must be `200`.
2. **Visual check** — confirm slot (bed / washroom / lounge), **hotel room only (no residential)**, **well-lit (no dark)**, no extra beds, no exterior/kitchen.
3. **Uniqueness** — prefer distinct photos per subcategory; reuse across subcategories only when necessary.
4. **Next.js** — if the hostname is not `images.unsplash.com`, `utfs.io`, or `*.ufs.sh`, extend `next.config.ts` before using in guest `<Image>` components.

Admin uploads go through **UploadThing** and do not need remote-pattern changes.

## Seed file shape

```ts
export const twinSubcategoryImagesByName: Record<
  PublicSubcategoryName,
  SubcategoryGalleryImage[]
> = {
  [LAKE_VIEW_NAME]: [
    { url: u("…"), caption: "Two twin beds" },
    { url: u("…"), caption: "En-suite bathroom with walk-in shower" },
    { url: u("…"), caption: "Sitting area with sofa and writing desk" },
  ],
  // …
}
```

Captions should name the slot (beds / washroom / lounge), not the view (avoid “city skyline”, “lake view through window”).

## Admin upload workflow

When adding images through **Manage** on a subcategory:

1. Audit existing images — remove any that show beds twice, exteriors, kitchens, **residential/non-hotel settings**, or **dark/moody lighting**.
2. Upload in order: **beds → washroom → lounge**.
3. Stop at **3** unless the user requests more.
4. If a slot is wrong, delete and re-upload; do not append a fourth “correction” without removing the bad one.

## Checklist

```
Gallery progress:
- [ ] Slot 1: one bed photo (TWIN = two twin beds in one image)
- [ ] Slot 2: hotel washroom only
- [ ] Slot 3: couch/sofa and desk in the same interior shot
- [ ] Every image is a hotel guest room — **no residential / apartment / home interiors**
- [ ] Every image is well-lit — **no dark, moody, or shadow-heavy photography**
- [ ] No second bed photo anywhere in the gallery
- [ ] No exterior or kitchen images
- [ ] URLs return HTTP 200 (seed) or upload succeeded (admin)
- [ ] Seed changes: npm run db:seed + scripts/check-images.ts
- [ ] New CDN hostnames added to next.config.ts if needed
```

## Common mistakes

```ts
// Wrong — apartment / residential living room, not a hotel room
{ url: u("1502672260266-1c1ef2d93688"), caption: "Sitting area with sofa and desk" }

// Wrong — dimly lit; details lost in shadow
{ url: u("1771775528790-28d21016be3f"), caption: "Writing desk" }

// Wrong — bedroom layout used as “foyer” (shows beds again)
{ url: u("1631049307264-da0ec9d70304"), caption: "Room foyer" }

// Wrong — desk photo taken in the bedroom with beds visible
{ url: u("1595526114035-0d45ed16cfbf"), caption: "Writing desk" } // when beds are in frame

// Wrong — window/skyline exterior
{ url: u("1702014861736-d62834317c5e"), caption: "City views" }

// Right — three slots, hotel room, bright, one bed image total
[
  { url: u("1673687784076-f669a5cf98c0"), caption: "Two twin beds" },
  { url: u("1552321554-5fefe8c9ef14"), caption: "Marble en-suite bathroom" },
  { url: u("1776763018821-8feeaeeee0a5"), caption: "Sitting area with sofa and desk" },
]
```

## Scope

Applies to:

- `lib/twin-subcategory-images.ts` and future per-type subcategory seed modules
- `SubcategoryImage` data and admin manage dialog
- Guest surfaces using `resolveListingImages` / `resolveListingImagesForRoom`

Does **not** change catalog-level `RoomImage` galleries unless the user asks to align catalog photos too.
