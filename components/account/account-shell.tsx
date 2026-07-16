"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { LISTING_CARD_SHADOW_CLASS } from "@/lib/listing-card-shadow"

const links = [
  { href: "/account", label: "Profile", exact: true },
  { href: "/account/reservations", label: "Reservations", exact: false },
] as const

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <nav className="space-y-1">
        {links.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-[#c69456] font-medium text-[#0f2a3d]"
                  : "text-[#0f2a3d]/70 hover:bg-[#0f2a3d] hover:text-white",
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div
        className={cn(
          "rounded-2xl border bg-white p-6 lg:p-8",
          LISTING_CARD_SHADOW_CLASS,
        )}
      >
        {children}
      </div>
    </div>
  )
}
