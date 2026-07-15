import type { Metadata } from "next"
import { RoomImageGallery } from "@/components/room-image-gallery"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  ArrowLeft,
  BedDouble,
  Briefcase,
  Coffee,
  Droplets,
  Home,
  MapPin,
  Monitor,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Train,
  Tv,
  UtensilsCrossed,
  Users,
  Wifi,
  Wind,
  Wine,
} from "lucide-react"

import { getCatalogRoomBySlug, getSimilarRooms } from "@/lib/queries"
import { TYPE_TOTALS } from "@/lib/floor-plan"
import {
  isListingFeatured,
  listingAvailabilityKey,
  ROOM_TYPE_LABELS,
} from "@/lib/rooms"
import { resolveListingImagesForRoom } from "@/lib/listing-images"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RoomCard } from "@/components/room-card"
import { RoomBookingSidebar } from "@/components/room-booking-sidebar"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ subcategory?: string }>
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const { subcategory: subcategoryId } = await searchParams
  const room = await getCatalogRoomBySlug(slug, subcategoryId)
  if (!room) return { title: "Room not found — Hôtel Levio" }
  return { title: `${room.name} — Hôtel Levio`, description: room.description }
}

/* ------------------------------------------------------------------ */
/*  Amenity icon                                                         */
/* ------------------------------------------------------------------ */

const AMENITY_RULES: { pattern: RegExp; icon: LucideIcon }[] = [
  { pattern: /wi-fi|wifi|internet/i, icon: Wifi },
  { pattern: /television|tv|screen/i, icon: Tv },
  { pattern: /coffee|nespresso|cappuccino/i, icon: Coffee },
  { pattern: /bath|shower|tub|soaking/i, icon: Droplets },
  { pattern: /climate|air\b/i, icon: Wind },
  { pattern: /desk|work/i, icon: Monitor },
  { pattern: /fridge|refrigerator/i, icon: Package },
  { pattern: /safe|security/i, icon: ShieldCheck },
  { pattern: /robe|slipper|toiletries|lotion|soap/i, icon: Sparkles },
  { pattern: /kitchen|microwave|bar\b|wet bar/i, icon: UtensilsCrossed },
  { pattern: /bed|mattress/i, icon: BedDouble },
  { pattern: /living|lounge|sofa|seating/i, icon: Home },
  { pattern: /dining|table/i, icon: Briefcase },
]

function AmenityIcon({ name }: { name: string }) {
  const match = AMENITY_RULES.find((r) => r.pattern.test(name))
  const Icon = match?.icon ?? Star
  return <Icon className="size-4 text-muted-foreground shrink-0" />
}

/* ------------------------------------------------------------------ */
/*  Nearby place icon                                                    */
/* ------------------------------------------------------------------ */

const NEARBY_ICONS: Record<string, LucideIcon> = {
  restaurant: UtensilsCrossed,
  attraction: MapPin,
  transport: Train,
  wellness: Sparkles,
  shopping: ShoppingBag,
  bar: Wine,
}

function NearbyIcon({ category }: { category: string }) {
  const Icon = NEARBY_ICONS[category] ?? MapPin
  return <Icon className="size-5" />
}

/* ------------------------------------------------------------------ */
/*  Page                                                                 */
/* ------------------------------------------------------------------ */

export default async function RoomPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { subcategory: subcategoryId } = await searchParams
  const room = await getCatalogRoomBySlug(slug, subcategoryId)
  if (!room) notFound()

  const similarRooms = await getSimilarRooms(room, 3)
  const featured = isListingFeatured(room)
  const listingImages = resolveListingImagesForRoom(room)

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
            <Link href="/#rooms">
              <ArrowLeft className="size-4" />
              Back to rooms
            </Link>
          </Button>

          <RoomImageGallery
            images={listingImages}
            roomName={room.name}
            featured={featured}
          />

          {/* Content grid */}
          <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
            {/* Left: info */}
            <div className="space-y-8">
              {/* Header */}
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="secondary">
                    {ROOM_TYPE_LABELS[room.type]}
                  </Badge>
                  {room.subcategory && (
                    <Badge variant="outline">
                      {room.subcategory.name}
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl tracking-tight text-primary-foreground sm:text-4xl">
                  {room.name}
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  {TYPE_TOTALS[room.type]} {room.type.toLowerCase()} rooms in the hotel
                </p>
                <div className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4" /> Sleeps {room.capacity}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BedDouble className="size-4" /> {room.beds} bed
                    {room.beds > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                  {room.description}
                </p>
              </div>

              <div className="border-t" />

              {/* Amenities */}
              {room.amenities.length > 0 && (
                <section>
                  <h2 className="text-xl tracking-tight text-primary-foreground mb-4">
                    Amenities
                  </h2>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {room.amenities.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        <AmenityIcon name={a.name} />
                        <span>{a.name}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* What's nearby */}
              {room.nearbyPlaces.length > 0 && (
                <>
                  <div className="border-t" />
                  <section>
                    <h2 className="text-xl tracking-tight text-primary-foreground mb-4">
                      What&apos;s nearby
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {room.nearbyPlaces.map((place) => (
                        <div key={place.id} className="flex items-center gap-3">
                          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                            <NearbyIcon category={place.category} />
                          </div>
                          <div>
                            <p className="text-sm font-medium leading-none mb-0.5">
                              {place.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {place.distance}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>

            {/* Right: booking sidebar */}
            <div className="lg:sticky lg:top-24">
              <RoomBookingSidebar room={room} />
            </div>
          </div>

          {/* Similar rooms */}
          {similarRooms.length > 0 && (
            <section className="mt-14">
              <h2 className="text-2xl tracking-tight text-primary-foreground">
                Other Rooms You Might Like
              </h2>
              <p className="text-muted-foreground mt-1">
                Similar stays based on room type, amenities, and price.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {similarRooms.map((similar) => (
                  <RoomCard
                    key={listingAvailabilityKey(
                      similar.id,
                      similar.subcategory.id,
                    )}
                    room={similar}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
