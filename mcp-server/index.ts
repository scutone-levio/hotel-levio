import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

import { checkAvailability, quoteStay } from "@/lib/concierge/availability"
import { prepareCartItem } from "@/lib/concierge/cart"
import {
  searchRoomTypesInputSchema,
  stayRequestInputSchema,
  weatherInputSchema,
} from "@/lib/concierge/schemas"
import { searchRoomTypes } from "@/lib/concierge/search"
import { getWeather } from "@/lib/weather"

const server = new McpServer(
  {
    name: "hotel-levio-concierge",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.registerTool(
  "search_room_types",
  {
    description:
      "List bookable room types and subcategory listings with from-prices.",
    inputSchema: searchRoomTypesInputSchema,
  },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await searchRoomTypes(input)) }],
  }),
)

server.registerTool(
  "check_availability",
  {
    description:
      "Check whether a listing is available for specific dates and guest count.",
    inputSchema: stayRequestInputSchema,
  },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await checkAvailability(input)) }],
  }),
)

server.registerTool(
  "quote_stay",
  {
    description: "Quote total price for a listing and stay dates.",
    inputSchema: stayRequestInputSchema,
  },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await quoteStay(input)) }],
  }),
)

server.registerTool(
  "prepare_cart_item",
  {
    description:
      "Prepare a validated cart item payload after guest confirmation.",
    inputSchema: stayRequestInputSchema,
  },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await prepareCartItem(input)) }],
  }),
)

server.registerTool(
  "get_weather",
  {
    description:
      "Get current weather and forecast for the hotel location (Montréal, Old Port). " +
      "Use when a guest asks about weather or conditions during their stay or visit.",
    inputSchema: weatherInputSchema,
  },
  async ({ start_date, end_date }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await getWeather({ startDate: start_date, endDate: end_date }),
        ),
      },
    ],
  }),
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
