import { prisma } from "../lib/prisma"
import { catalogImagesByType } from "../lib/room-type-images"
import { kingSubcategoryImagesByName } from "../lib/king-subcategory-images"
import { queenSubcategoryImagesByName } from "../lib/queen-subcategory-images"
import { suiteSubcategoryImagesByName } from "../lib/suite-subcategory-images"
import { twinSubcategoryImagesByName } from "../lib/twin-subcategory-images"

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80"

const FETCH_TIMEOUT_MS = 10_000

async function checkUrl(url: string): Promise<number | "error"> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HotelApp/1.0; +https://localhost)",
      },
    })
    return res.status
  } catch {
    return "error"
  }
}

function addGalleryUrls(
  urls: Map<string, string>,
  galleries: Record<string, { url: string }[]>,
  prefix: string,
) {
  for (const [name, imgs] of Object.entries(galleries)) {
    for (const img of imgs) urls.set(img.url, `${prefix}:${name}`)
  }
}

async function collectAllUrls(): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  urls.set(PLACEHOLDER, "placeholder:room-image-carousel")

  for (const [type, imgs] of Object.entries(catalogImagesByType)) {
    for (const img of imgs) urls.set(img.url, `catalog:${type}`)
  }
  addGalleryUrls(urls, twinSubcategoryImagesByName, "twin-sub")
  addGalleryUrls(urls, queenSubcategoryImagesByName, "queen-sub")
  addGalleryUrls(urls, kingSubcategoryImagesByName, "king-sub")
  addGalleryUrls(urls, suiteSubcategoryImagesByName, "suite-sub")

  const roomImages = await prisma.roomImage.findMany({
    select: {
      url: true,
      room: {
        select: {
          isCatalog: true,
          roomType: { select: { slug: true } },
        },
      },
    },
  })
  for (const img of roomImages) {
    urls.set(
      img.url,
      `db:room:${img.room.roomType.slug}${img.room.isCatalog ? ":catalog" : ""}`,
    )
  }

  const subImages = await prisma.subcategoryImage.findMany({
    select: {
      url: true,
      subcategory: {
        select: {
          name: true,
          roomType: { select: { slug: true } },
        },
      },
    },
  })
  for (const img of subImages) {
    urls.set(
      img.url,
      `db:sub:${img.subcategory.roomType.slug}:${img.subcategory.name}`,
    )
  }

  return urls
}

async function main() {
  const urls = await collectAllUrls()
  const broken: Array<{ url: string; source: string; status: number | string }> =
    []
  let ok = 0

  const entries = [...urls.entries()]
  const CONCURRENCY = 10

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY)
    const statuses = await Promise.all(batch.map(([url]) => checkUrl(url)))

    for (let j = 0; j < batch.length; j++) {
      const [url, source] = batch[j]
      const status = statuses[j]
      if (status === 200) ok += 1
      else broken.push({ url, source, status })
    }
  }

  console.log(`Checked ${urls.size} unique URLs: ${ok} OK, ${broken.length} broken`)
  if (broken.length) {
    console.log("\nBroken images:")
    for (const row of broken) {
      console.log(`  [${row.status}] ${row.source}`)
      console.log(`    ${row.url}`)
    }
    process.exitCode = 1
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
