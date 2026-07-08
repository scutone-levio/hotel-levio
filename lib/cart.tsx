"use client"

import * as React from "react"

const STORAGE_KEY = "hotellevio_cart"

export type CartItem = {
  id: string        // client-generated uuid, not a DB id
  roomId: string
  roomName: string
  imageUrl: string | null
  checkIn: string   // ISO string
  checkOut: string  // ISO string
  guests: number
  nights: number
  totalPrice: number // cents, pre-quoted client-side (re-verified server-side at checkout)
}

type CartCtx = {
  items: CartItem[]
  addItem: (item: Omit<CartItem, "id">) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

const CartContext = React.createContext<CartCtx>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  clearCart: () => {},
})

function persist(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {}
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([])

  // Hydrate from localStorage after mount.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {}
  }, [])

  function addItem(item: Omit<CartItem, "id">) {
    const next = [...items, { ...item, id: crypto.randomUUID() }]
    setItems(next)
    persist(next)
  }

  function removeItem(id: string) {
    const next = items.filter((i) => i.id !== id)
    setItems(next)
    persist(next)
  }

  function clearCart() {
    setItems([])
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return React.useContext(CartContext)
}
