"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { cn } from "@/lib/utils"

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80"

type GalleryImage = { id: string; url: string }

export function RoomImageCarousel({
  images,
  roomName,
  featured = false,
  variant,
  className,
  "data-testid": dataTestId,
}: {
  images: GalleryImage[]
  roomName: string
  featured?: boolean
  variant: "hero" | "card"
  className?: string
  "data-testid"?: string
}) {
  const slides =
    images.length > 0 ? images : [{ id: "placeholder", url: PLACEHOLDER }]
  const hasMultiple = slides.length > 1
  const showDots = variant === "hero"

  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)

  React.useEffect(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap())
    })
  }, [api])

  const isHero = variant === "hero"
  const badgeClass = isHero ? "top-4 left-4" : "top-2 left-2"
  const frameClass = isHero
    ? "aspect-[4/3] sm:aspect-[21/9] rounded-2xl"
    : "aspect-[4/3]"

  function stopNav(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  if (!hasMultiple) {
    const img = slides[0]
    return (
      <div
        className={cn("relative overflow-hidden", frameClass, className)}
        data-testid={dataTestId}
      >
        <Image
          src={img.url}
          alt={roomName}
          fill
          priority
          sizes={isHero ? "100vw" : "(max-width: 768px) 100vw, 33vw"}
          className="object-cover"
        />
        {featured && (
          <div className={cn("absolute", badgeClass)}>
            <Badge
              className="gap-1 text-white hover:opacity-90"
              style={{ backgroundColor: "#69C94F" }}
              data-testid="featured-badge"
            >
              <Star className="size-3 fill-current" /> Featured
            </Badge>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(isHero ? "relative mb-10" : "relative", className)}
      data-testid={dataTestId}
    >
      <Carousel setApi={setApi} className="w-full">
        <CarouselContent className="ml-0">
          {slides.map((img, index) => (
            <CarouselItem key={img.id} className="pl-0">
              <div className={cn("relative overflow-hidden", frameClass)}>
                <Image
                  src={img.url}
                  alt={`${roomName} — photo ${index + 1}`}
                  fill
                  priority={index === 0}
                  sizes={isHero ? "100vw" : "(max-width: 768px) 100vw, 33vw"}
                  className="object-cover"
                />
                {featured && index === current && (
                  <div className={cn("absolute", badgeClass)}>
                    <Badge
                      className="gap-1 text-white hover:opacity-90"
                      style={{ backgroundColor: "#69C94F" }}
                      data-testid="featured-badge"
                    >
                      <Star className="size-3 fill-current" /> Featured
                    </Badge>
                  </div>
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "bg-background/80 absolute top-1/2 -translate-y-1/2 rounded-full shadow-sm backdrop-blur-sm",
            isHero ? "left-3 size-9" : "left-2 size-7",
          )}
          onClick={(e) => {
            stopNav(e)
            api?.scrollPrev()
          }}
          aria-label="Previous image"
        >
          <ChevronLeft className={isHero ? "size-5" : "size-4"} />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "bg-background/80 absolute top-1/2 -translate-y-1/2 rounded-full shadow-sm backdrop-blur-sm",
            isHero ? "right-3 size-9" : "right-2 size-7",
          )}
          onClick={(e) => {
            stopNav(e)
            api?.scrollNext()
          }}
          aria-label="Next image"
        >
          <ChevronRight className={isHero ? "size-5" : "size-4"} />
        </Button>
      </Carousel>

      {showDots ? (
        <div className="mt-3 flex justify-center gap-1.5">
          {slides.map((img, index) => (
            <button
              key={img.id}
              type="button"
              aria-label={`Go to image ${index + 1}`}
              aria-current={index === current ? "true" : undefined}
              onClick={() => api?.scrollTo(index)}
              className={cn(
                "size-2 rounded-full transition-colors",
                index === current ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
