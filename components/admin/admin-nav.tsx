"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BedDouble,
  CalendarDays,
  ExternalLink,
  LayoutDashboard,
  Layers,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/admin", label: "Reservations", icon: LayoutDashboard, exact: true },
  { href: "/admin/catalog", label: "Room Type", icon: Layers },
  { href: "/admin/rooms", label: "Rooms", icon: BedDouble },
  { href: "/admin/amenities", label: "Amenities", icon: Sparkles },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
]

export function AdminNav() {
  const pathname = usePathname()

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <nav className="flex flex-col gap-1">
      <p className="text-muted-foreground px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider">
        Menu
      </p>
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(href, exact)
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-muted",
          )}
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </Link>
      ))}

      <div className="mt-auto pt-6 border-t mt-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <ExternalLink className="size-4 shrink-0" />
          View site
        </Link>
      </div>
    </nav>
  )
}
