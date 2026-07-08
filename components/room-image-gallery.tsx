import { RoomImageCarousel } from "@/components/room-image-carousel"

export function RoomImageGallery({
  images,
  roomName,
  featured = false,
}: {
  images: { id: string; url: string }[]
  roomName: string
  featured?: boolean
}) {
  return (
    <RoomImageCarousel
      variant="hero"
      images={images}
      roomName={roomName}
      featured={featured}
    />
  )
}
