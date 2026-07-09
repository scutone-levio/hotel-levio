import Link from "next/link"
import { BedDouble, Users } from "lucide-react"

import type { RoomWithDetails } from "@/lib/queries"
import type { AvailabilityCount } from "@/app/actions"
import { formatPrice, fromPrice, isListingFeatured, roomPath } from "@/lib/rooms"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BookRoomDialog } from "@/components/book-room-dialog"
import { RoomCardGallery } from "@/components/room-card-gallery"

export function RoomCard({
  room,
  availability = null,
}: {
  room: RoomWithDetails
  availability?: AvailabilityCount | null
}) {
  const hasWeekendRule = room.priceRules.length > 0

  return (
    <Card
      className="flex flex-col overflow-hidden pt-0"
      data-testid="room-card"
      data-featured={isListingFeatured(room) ? "true" : "false"}
    >
      <RoomCardGallery room={room} />
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg">
              <Link
                href={roomPath(room.slug, room.subcategory?.id)}
                className="hover:underline"
              >
                {room.name}
              </Link>
            </CardTitle>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">
              {hasWeekendRule ? "from " : ""}
              {formatPrice(fromPrice(room))}
            </div>
            <div className="text-muted-foreground text-xs">per night</div>
          </div>
        </div>
        <CardDescription>{room.description}</CardDescription>
        {availability ? (
          <p className="text-muted-foreground text-xs">
            {availability.available} of {availability.total} rooms available
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1">
        <div className="text-muted-foreground mb-3 flex flex-wrap gap-3 text-sm">
          <span className="flex items-center gap-1">
            <Users className="size-4" /> Sleeps {room.capacity}
          </span>
          <span className="flex items-center gap-1">
            <BedDouble className="size-4" /> {room.beds} bed
            {room.beds > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {room.amenities.slice(0, 4).map((a) => (
            <Badge key={a.id} variant="secondary">
              {a.name}
            </Badge>
          ))}
          {room.amenities.length > 4 ? (
            <Badge variant="outline">+{room.amenities.length - 4} more</Badge>
          ) : null}
        </div>
      </CardContent>
      <CardFooter>
        <BookRoomDialog
          room={room}
          trigger={
            <Button className="w-full cursor-pointer" data-testid="book-now">
              Book Now
            </Button>
          }
        />
      </CardFooter>
    </Card>
  )
}
