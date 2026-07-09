"use client"

import type { RoomWithDetails } from "@/lib/queries"
import { isListingFeatured, roomPath } from "@/lib/rooms"
import { RoomImageCarousel } from "@/components/room-image-carousel"

export function RoomCardGallery({ room }: { room: RoomWithDetails }) {
  return (
    <RoomImageCarousel
      variant="card"
      images={room.images}
      roomName={room.name}
      featured={isListingFeatured(room)}
      imageHref={roomPath(room.slug, room.subcategory?.id)}
      className="bg-muted w-full"
      data-testid="room-image-link"
    />
  )
}
