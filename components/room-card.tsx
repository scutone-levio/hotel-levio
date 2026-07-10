import Link from "next/link"
import { BedDouble, Users } from "lucide-react"

import type { RoomWithDetails } from "@/lib/queries"
import type { AvailabilityCount } from "@/app/actions"
import { formatPrice, isListingFeatured, listingFromPriceCents, roomPath } from "@/lib/rooms"
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
  const listingPrice = room.subcategory
    ? listingFromPriceCents(room.subcategory)
    : room.basePrice
  const hasWeekendRates = room.subcategory?.hasWeekendRates ?? false

  return (
    <Card
      className="flex flex-col overflow-hidden pt-0 shadow-[0_1px_2px_rgba(15,42,61,0.07),0_18px_34px_-18px_rgba(15,42,61,0.32)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(15,42,61,0.08),0_26px_42px_-16px_rgba(15,42,61,0.38)]"
      data-testid="room-card"
      data-featured={isListingFeatured(room) ? "true" : "false"}
    >
      <RoomCardGallery room={room} />
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="!text-lg text-[#0f2a3d]">
              <Link
                href={roomPath(room.slug, room.subcategory?.id)}
                className="hover:underline"
              >
                {room.name}
              </Link>
            </CardTitle>
          </div>
          <div className="text-right">
            <div className="text-lg font-black text-[#0f2a3d]">
              {hasWeekendRates ? "from " : ""}
              {formatPrice(listingPrice, "CAD")}
            </div>
            <div className="text-xs text-[#0f2a3d]/50">per night</div>
          </div>
        </div>
        <CardDescription className="!text-[#0f2a3d]/70">
          {room.description}
        </CardDescription>
        {availability ? (
          <p className="text-xs text-[#0f2a3d]/50">
            {availability.available} of {availability.total} rooms available
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1">
        <div className="mb-3 flex flex-wrap gap-3 text-sm text-[#0f2a3d]/60">
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
            <Badge
              key={a.id}
              variant="secondary"
              className="!rounded-none !border !border-[#0f2a3d]/15 !bg-transparent !px-2.5 !py-1 !text-[0.64rem] !tracking-wider text-[#0f2a3d]/75 uppercase"
            >
              {a.name}
            </Badge>
          ))}
          {room.amenities.length > 4 ? (
            <Badge
              variant="outline"
              className="!rounded-none !border !border-[#0f2a3d]/15 !bg-transparent !px-2.5 !py-1 !text-[0.64rem] !tracking-wider text-[#0f2a3d]/60 uppercase"
            >
              +{room.amenities.length - 4} more
            </Badge>
          ) : null}
        </div>
      </CardContent>
      <CardFooter>
        <BookRoomDialog
          room={room}
          trigger={
            <Button
              className="w-full cursor-pointer !bg-[#0f2a3d] !text-[#f3ecda] hover:!bg-[#c69456] hover:!text-[#0f2a3d]"
              data-testid="book-now"
            >
              Book Now
            </Button>
          }
        />
      </CardFooter>
    </Card>
  )
}
