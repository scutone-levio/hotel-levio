"use client"

import type { RoomWithDetails } from "@/lib/queries"
import { isListingFeatured, roomPath } from "@/lib/rooms"
import { resolveListingImagesForRoom } from "@/lib/listing-images"
import { RoomImageCarousel } from "@/components/room-image-carousel"

export function RoomCardGallery({ room }: { room: RoomWithDetails }) {
  const images = resolveListingImagesForRoom(room)
  return (
    <RoomImageCarousel
      variant="card"
      images={images}
      roomName={room.name}
      featured={isListingFeatured(room)}
      imageHref={roomPath(room.slug, room.subcategory?.id)}
      className="bg-muted w-full"
      data-testid="room-image-link"
    />
  )
}
