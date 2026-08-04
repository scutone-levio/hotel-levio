import { tool } from "ai"

import { quoteStay, checkAvailability } from "@/lib/concierge/availability"
import { prepareCartItem } from "@/lib/concierge/cart"
import {
  searchRoomTypesInputSchema,
  stayRequestInputSchema,
  weatherInputSchema,
} from "@/lib/concierge/schemas"
import { searchRoomTypes } from "@/lib/concierge/search"
import { getWeather } from "@/lib/weather"

export type ConciergeRole = "guest" | "admin" | "dev"

export const CONCIERGE_SYSTEM_PROMPT = `You are the Hôtel Levio guest concierge. Help visitors find rooms, check availability, quote stays in CAD, and prepare add-to-cart items.

Rules:
- Always use tools for availability, pricing, and cart preparation. Never invent prices, room counts, or availability.
- Prices are in Canadian dollars (CAD). Tool results include formatted display strings.
- Before preparing a cart item, confirm the room name, check-in, check-out, guest count, and total price with the guest.
- Only call prepare_cart_item after the guest explicitly agrees to add the stay to their cart.
- If dates are missing, ask for check-in, check-out, and number of guests.
- Keep replies concise and friendly. After a cart item is prepared, remind the guest they can review checkout on the cart page.
- Do not discuss admin operations, internal systems, or guest PII beyond what the user shares in chat.
- Use get_weather when a guest asks about weather or conditions during their stay. Report temperatures in Celsius.`

export function createGuestConciergeTools() {
  return {
    search_room_types: tool({
      description:
        "List bookable room types and subcategory listings with from-prices. Use when the guest asks what rooms are available in general.",
      inputSchema: searchRoomTypesInputSchema,
      execute: async (input) => searchRoomTypes(input),
    }),
    check_availability: tool({
      description:
        "Check whether a specific listing is available for check-in/check-out dates and guest count.",
      inputSchema: stayRequestInputSchema,
      execute: async (input) => checkAvailability(input),
    }),
    quote_stay: tool({
      description:
        "Quote the total price in cents for a specific listing and stay dates after verifying availability.",
      inputSchema: stayRequestInputSchema,
      execute: async (input) => quoteStay(input),
    }),
    prepare_cart_item: tool({
      description:
        "Prepare a validated cart item payload after the guest confirms they want to add the stay to cart. Does not modify the cart directly.",
      inputSchema: stayRequestInputSchema,
      execute: async (input) => prepareCartItem(input),
    }),
    get_weather: tool({
      description:
        "Get current weather and forecast for the hotel location (Montréal, Old Port). " +
        "Use when a guest asks about weather or conditions during their stay or visit.",
      inputSchema: weatherInputSchema,
      execute: async ({ start_date, end_date }) =>
        getWeather({ startDate: start_date, endDate: end_date }),
    }),
  }
}

export function getConciergeToolsForRole(role: ConciergeRole) {
  switch (role) {
    case "guest":
      return createGuestConciergeTools()
    case "admin":
    case "dev":
      return {}
  }
}

export type GuestConciergeTools = ReturnType<typeof createGuestConciergeTools>
