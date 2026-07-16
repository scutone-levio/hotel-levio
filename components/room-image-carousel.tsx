"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
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
import {
  LISTING_CARD_SHADOW_CLASS,
} from "@/lib/listing-card-shadow"

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80"

type GalleryImage = { id: string; url: string }

function CarouselDotNav({
  slides,
  current,
  onSelect,
}: {
  slides: GalleryImage[]
  current: number
  onSelect: (index: number) => void
}) {
  return (
    <div className="mt-3 flex justify-center gap-1.5">
      {slides.map((img, index) => (
        <button
          key={img.id}
          type="button"
          aria-label={`Go to image ${index + 1}`}
          aria-current={index === current ? "true" : undefined}
          onClick={() => onSelect(index)}
          className={cn(
            "size-2 rounded-full transition-colors",
            index === current ? "bg-primary" : "bg-muted-foreground/30",
          )}
        />
      ))}
    </div>
  )
}

function RoomImageSingle({
  img,
  roomName,
  featured,
  isHero,
  badgeClass,
  frameClass,
  heroShadowWrap,
  heroClipWrap,
  className,
  imageHref,
  dataTestId,
}: {
  img: GalleryImage
  roomName: string
  featured: boolean
  isHero: boolean
  badgeClass: string
  frameClass: string
  heroShadowWrap?: string
  heroClipWrap?: string
  className?: string
  imageHref?: string
  dataTestId?: string
}) {
  const gallery = (
    <SlideFrame
      roomName={roomName}
      isHero={isHero}
      frameClass={frameClass}
      imageHref={imageHref}
      testId={dataTestId}
    >
      <Image
        src={img.url}
        alt={roomName}
        fill
        priority
        sizes={isHero ? "100vw" : "(max-width: 768px) 100vw, 33vw"}
        className="object-cover"
      />
      {featured ? (
        <div className={cn("absolute", badgeClass)}>
          <Badge
            className="gap-1 text-white hover:opacity-90"
            style={{ backgroundColor: "#69C94F" }}
            data-testid="featured-badge"
          >
            <Star className="size-3 fill-current" /> Featured
          </Badge>
        </div>
      ) : null}
    </SlideFrame>
  )

  if (!isHero) {
    return <div className={className}>{gallery}</div>
  }

  return (
    <div className={cn("relative mb-10", className)}>
      <div className={heroShadowWrap}>
        <div className={heroClipWrap}>{gallery}</div>
      </div>
    </div>
  )
}

function SlideFrame({
  children,
  roomName,
  isHero,
  frameClass,
  className: frameClassName,
  testId,
  ariaLabel,
  imageHref,
}: {
  children: React.ReactNode
  roomName: string
  isHero: boolean
  frameClass: string
  className?: string
  testId?: string
  ariaLabel?: string
  imageHref?: string
}) {
  const frameClassNameMerged = cn(
    "relative overflow-hidden",
    frameClass,
    frameClassName,
  )

  if (imageHref && !isHero) {
    return (
      <Link
        href={imageHref}
        className={cn("block", frameClassNameMerged)}
        aria-label={ariaLabel ?? `View ${roomName}`}
        data-testid={testId}
      >
        {children}
      </Link>
    )
  }

  return (
    <div className={frameClassNameMerged} data-testid={testId}>
      {children}
    </div>
  )
}

export function RoomImageCarousel({
  images,
  roomName,
  featured = false,
  variant,
  className,
  imageHref,
  "data-testid": dataTestId,
}: {
  images: GalleryImage[]
  roomName: string
  featured?: boolean
  variant: "hero" | "card"
  className?: string
  imageHref?: string
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
  const heroShadowWrap = isHero
    ? cn("rounded-2xl", LISTING_CARD_SHADOW_CLASS)
    : undefined
  const heroClipWrap = isHero ? "relative overflow-hidden rounded-2xl" : undefined

  function stopNav(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  if (!hasMultiple) {
    return (
      <RoomImageSingle
        img={slides[0]}
        roomName={roomName}
        featured={featured}
        isHero={isHero}
        badgeClass={badgeClass}
        frameClass={frameClass}
        heroShadowWrap={heroShadowWrap}
        heroClipWrap={heroClipWrap}
        className={className}
        imageHref={imageHref}
        dataTestId={dataTestId}
      />
    )
  }

  const carouselWithNav = (
    <>
      <Carousel setApi={setApi} className="w-full">
        <CarouselContent className="ml-0">
          {slides.map((img, index) => (
            <CarouselItem key={img.id} className="pl-0">
              <SlideFrame
                roomName={roomName}
                isHero={isHero}
                frameClass={frameClass}
                imageHref={imageHref}
                testId={index === 0 ? dataTestId : undefined}
                ariaLabel={`View ${roomName} — photo ${index + 1}`}
              >
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
              </SlideFrame>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

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
    </>
  )

  return (
    <div
      className={cn(isHero ? "relative mb-10" : "relative", className)}
    >
      {isHero ? (
        <div className={heroShadowWrap}>
          <div className={heroClipWrap}>{carouselWithNav}</div>
        </div>
      ) : (
        carouselWithNav
      )}

      {showDots ? (
        <CarouselDotNav
          slides={slides}
          current={current}
          onSelect={(index) => api?.scrollTo(index)}
        />
      ) : null}
    </div>
  )
}
