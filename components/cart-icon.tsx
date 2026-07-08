"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { useCart } from "@/lib/cart"
import { Button } from "@/components/ui/button"

export function CartIcon() {
  const { items } = useCart()
  return (
    <Button variant="ghost" size="sm" asChild className="relative">
      <Link href="/cart" aria-label={`Cart (${items.length} item${items.length !== 1 ? "s" : ""})`}>
        <ShoppingCart className="size-4" />
        {items.length > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold leading-none">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </Link>
    </Button>
  )
}
