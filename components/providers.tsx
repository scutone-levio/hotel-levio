"use client"

import * as React from "react"
import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { CartProvider } from "@/lib/cart"
import { DateRangeProvider } from "@/lib/date-range"

// App-wide client providers. Currently wires up TanStack Query (used by the
// admin dashboard). Add other client-side context providers here as needed.
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <DateRangeProvider>
          <CartProvider>{children}</CartProvider>
        </DateRangeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
