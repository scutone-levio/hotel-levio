import type { LucideIcon } from "lucide-react"
import {
  BedDouble,
  CalendarDays,
  LayoutDashboard,
  Layers,
  Sparkles,
} from "lucide-react"

export type AdminNavItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Reservations", icon: LayoutDashboard, exact: true },
  { href: "/admin/catalog", label: "Room Type", icon: Layers },
  { href: "/admin/rooms", label: "Rooms", icon: BedDouble },
  { href: "/admin/amenities", label: "Amenities", icon: Sparkles },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
]

export function isAdminNavActive(
  pathname: string,
  href: string,
  exact = false,
) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
