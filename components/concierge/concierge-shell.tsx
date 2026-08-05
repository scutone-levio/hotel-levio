"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { MessageCircle, Send, X } from "lucide-react"
import { toast } from "sonner"

import { prepareConciergeCartItem } from "@/app/actions"
import type {
  AgentBridgeMessage,
  AgentBridgeResponse,
  AgentBridgeRoom,
} from "@/lib/concierge/agent-bridge"
import { useCart } from "@/lib/cart"
import { formatPrice, listingAvailabilityKey } from "@/lib/rooms"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AgentBookingDetails = {
  check_in_date?: string | null
  check_out_date?: string | null
  guests?: number | null
}

type ConciergeMessage = AgentBridgeMessage & {
  id: string
  availableRooms?: AgentBridgeRoom[]
  personalizedOffer?: string
  bookingDetails?: AgentBookingDetails
}

function createMessageId(): string {
  return crypto.randomUUID()
}

function listingKey(room: AgentBridgeRoom): string {
  if (room.roomId && room.subcategoryId) {
    return listingAvailabilityKey(room.roomId, room.subcategoryId)
  }
  return room.room
}

function hasStayDates(details?: AgentBookingDetails): boolean {
  return Boolean(details?.check_in_date && details?.check_out_date)
}

function RoomOfferCard({
  room,
  bookingDetails,
  onAdd,
  added,
  adding,
}: Readonly<{
  room: AgentBridgeRoom
  bookingDetails?: AgentBookingDetails
  onAdd: () => void
  added: boolean
  adding: boolean
}>) {
  const priceLabel = formatPrice(room.price_per_night_cents, "CAD")
  const canAddToCart = hasStayDates(bookingDetails)

  let addToCartButton = null
  if (canAddToCart) {
    if (added) {
      addToCartButton = (
        <p className="text-primary self-center text-xs font-medium">
          Added to cart.{" "}
          <Link href="/cart" className="underline underline-offset-4">
            View cart
          </Link>
        </p>
      )
    } else {
      addToCartButton = (
        <Button
          variant="action"
          size="sm"
          onClick={onAdd}
          disabled={adding || !room.roomId}
        >
          {adding ? "Adding…" : "Add to cart"}
        </Button>
      )
    }
  }

  return (
    <div className="mt-2 rounded-lg border bg-background p-3 text-sm shadow-sm">
      <p className="font-medium">{room.room}</p>
      <p className="text-muted-foreground mt-1">
        From {priceLabel}/night
        {room.capacity ? ` · sleeps ${room.capacity}` : ""}
      </p>
      {room.amenities.length > 0 ? (
        <p className="text-muted-foreground mt-2 text-xs">
          {room.amenities.slice(0, 3).join(" · ")}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {room.detailUrl ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={room.detailUrl}>Details</Link>
          </Button>
        ) : null}
        {addToCartButton}
      </div>
    </div>
  )
}

function ConciergeChatPanel({ onClose }: { readonly onClose: () => void }) {
  const router = useRouter()
  const { addItem } = useCart()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [input, setInput] = React.useState("")

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])
  const [messages, setMessages] = React.useState<ConciergeMessage[]>([])
  const [setupError, setSetupError] = React.useState<string | null>(null)
  const [clientError, setClientError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [addedListingKeys, setAddedListingKeys] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [addingListingKey, setAddingListingKey] = React.useState<string | null>(
    null,
  )

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/agent")
      .then(async (response) => {
        if (response.ok) {
          if (!cancelled) setSetupError(null)
          return
        }
        const body = (await response.json()) as { error?: string }
        if (!cancelled) {
          setSetupError(
            body.error ??
              "Python agent bridge is not running. Start the FastAPI app on port 8000.",
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSetupError("Could not reach the concierge service.")
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const latestBookingDetails = React.useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const details = messages[index]?.bookingDetails
      if (details) return details
    }
    return undefined
  }, [messages])

  async function handleAddToCart(
    room: AgentBridgeRoom,
    bookingDetails?: AgentBookingDetails,
  ) {
    const stay = bookingDetails ?? latestBookingDetails
    const key = listingKey(room)
    if (!room.roomId) {
      toast.error("This listing could not be matched to the hotel catalog.")
      return
    }

    const checkIn = stay?.check_in_date ?? undefined
    const checkOut = stay?.check_out_date ?? undefined
    const guests = stay?.guests ?? undefined

    if (!checkIn || !checkOut || !guests) {
      toast.error(
        "Tell the concierge your check-in, check-out, and number of guests first.",
      )
      return
    }

    setAddingListingKey(key)
    try {
      const result = await prepareConciergeCartItem({
        roomId: room.roomId,
        subcategoryId: room.subcategoryId,
        checkIn,
        checkOut,
        guests,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      addItem({
        roomId: result.item.roomId,
        roomName: result.item.roomName,
        imageUrl: result.item.imageUrl,
        checkIn: result.item.checkIn,
        checkOut: result.item.checkOut,
        guests: result.item.guests,
        nights: result.item.nights,
        totalPrice: result.item.totalPrice,
        subcategoryId: result.item.subcategoryId,
      })
      setAddedListingKeys((prev) => new Set(prev).add(key))
      toast.success(`${result.item.roomName} added to cart`, {
        action: {
          label: "View cart",
          onClick: () => router.push("/cart"),
        },
      })
    } catch {
      toast.error("Could not add this room to your cart. Please try again.")
    } finally {
      setAddingListingKey(null)
    }
  }

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = input.trim()
    if (!text || isLoading || setupError) return

    const userMessage: ConciergeMessage = {
      id: createMessageId(),
      role: "user",
      content: text,
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput("")
    setIsLoading(true)
    setClientError(null)

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      })

      const data = (await response.json()) as AgentBridgeResponse & {
        error?: string
      }

      if (!response.ok) {
        setClientError(data.error ?? "Concierge request failed.")
        return
      }

      const bookingDetails = data.booking_details as AgentBookingDetails

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: data.reply,
          availableRooms: data.available_rooms,
          personalizedOffer: data.personalized_offer || undefined,
          bookingDetails,
        },
      ])
    } catch {
      setClientError("Could not reach the concierge service.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <dialog
      id="concierge-panel"
      open
      aria-labelledby="concierge-panel-title"
      className="fixed inset-x-4 bottom-4 z-50 flex max-h-[min(640px,calc(100vh-6rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[min(100vw-3rem,24rem)]"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p id="concierge-panel-title" className="font-medium">
            Concierge
          </p>
          <p className="text-muted-foreground text-xs">
            Ask about rooms, dates, and special offers
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close concierge"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {setupError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">Concierge unavailable</p>
            <p className="text-muted-foreground mt-1">{setupError}</p>
          </div>
        ) : null}

        {messages.length === 0 && !setupError ? (
          <p className="text-muted-foreground text-sm">
            Hi — I can help you plan your stay, find a room, and suggest tailored
            offers.
          </p>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[92%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
              message.role === "user"
                ? "bg-primary text-primary-foreground ml-auto"
                : "bg-muted",
            )}
          >
            {message.content}
            {message.availableRooms?.map((room) => {
              const key = listingKey(room)
              return (
                <RoomOfferCard
                  key={key}
                  room={room}
                  bookingDetails={latestBookingDetails ?? message.bookingDetails}
                  added={addedListingKeys.has(key)}
                  adding={addingListingKey === key}
                  onAdd={() =>
                    handleAddToCart(
                      room,
                      latestBookingDetails ?? message.bookingDetails,
                    )
                  }
                />
              )
            })}
            {message.personalizedOffer ? (
              <p className="text-primary mt-2 text-xs font-medium">
                {message.personalizedOffer}
              </p>
            ) : null}
          </div>
        ))}

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Concierge is typing…</p>
        ) : null}

        {clientError ? (
          <p className="text-destructive text-sm">{clientError}</p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="border-t p-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-label="Message the concierge"
            placeholder="Ask about rooms or dates…"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 min-w-0 flex-1 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
            disabled={isLoading || Boolean(setupError)}
          />
          <Button
            type="submit"
            variant="action"
            size="icon"
            disabled={isLoading || !input.trim() || Boolean(setupError)}
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </dialog>
  )
}

export function ConciergeShell() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const restoreFocus = React.useRef(false)

  React.useEffect(() => {
    if (!open && restoreFocus.current) {
      triggerRef.current?.focus()
      restoreFocus.current = false
    }
  }, [open])

  if (pathname.startsWith("/admin")) return null

  return (
    <>
      {!open ? (
        <Button
          ref={triggerRef}
          type="button"
          variant="action"
          className="fixed right-4 bottom-4 z-50 rounded-full shadow-lg"
          onClick={() => {
            restoreFocus.current = true
            setOpen(true)
          }}
          aria-expanded={open}
          aria-controls="concierge-panel"
        >
          <MessageCircle className="size-4" />
          Concierge
        </Button>
      ) : (
        <ConciergeChatPanel onClose={() => setOpen(false)} />
      )}
    </>
  )
}
