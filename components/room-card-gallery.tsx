"use client"

import Link from "next/link"

import type { RoomWithDetails } from "@/lib/queries"
import { isListingFeatured, roomPath } from "@/lib/rooms"
import { RoomImageCarousel } from "@/components/room-image-carousel"

export function RoomCardGallery({ room }: { room: RoomWithDetails }) {
  const href = roomPath(room.slug, room.subcategory?.id)

  return (
    <Link
      href={href}
      className="block"
      aria-label={`View ${room.name}`}
      data-testid="room-image-link"
    >
      <RoomImageCarousel
        variant="card"
        images={room.images}
        roomName={room.name}
        featured={isListingFeatured(room)}
        className="bg-muted w-full"
      />
    </Link>
  )
}
