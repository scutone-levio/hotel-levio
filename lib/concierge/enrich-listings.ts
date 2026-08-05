import { listingCoverImageUrl } from "@/lib/listing-images"
import type { AgentBridgeRoom } from "@/lib/concierge/agent-bridge"
import { getPublicRoomListings } from "@/lib/queries"
import { formatListingName, roomPath } from "@/lib/rooms"

export async function enrichAgentBridgeRooms(
  rooms: AgentBridgeRoom[],
): Promise<AgentBridgeRoom[]> {
  if (rooms.length === 0) return rooms

  const listings = await getPublicRoomListings()
  const listingByKey = new Map(
    listings.map((listing) => [
      `${listing.roomType.slug}:${listing.subcategory.name}`,
      listing,
    ]),
  )

  return rooms.map((room) => {
    if (!room.room_type_slug || !room.view) return room

    const listing = listingByKey.get(`${room.room_type_slug}:${room.view}`)
    if (!listing) return room

    return {
      ...room,
      roomId: listing.id,
      subcategoryId: listing.subcategory.id,
      detailUrl: roomPath(listing.slug, listing.subcategory.id),
      imageUrl: listingCoverImageUrl(
        listing.images,
        listing.subcategory.images,
      ),
      room: formatListingName(listing.name, listing.subcategory.name),
    }
  })
}
