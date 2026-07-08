"use client"

import type { RoomWithDetails } from "@/lib/queries"
import { RoomImageCarousel } from "@/components/room-image-carousel"

export function RoomCardGallery({ room }: { room: RoomWithDetails }) {
  return (
    <RoomImageCarousel
      variant="card"
      images={room.images}
      roomName={room.name}
      featured={room.featured}
      className="bg-muted w-full"
      data-testid="room-image-link"
    />
  )
}
