"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ExternalLink } from "lucide-react"

import {
  ADMIN_FOOTER_NAV_ITEMS,
  ADMIN_NAV_ITEMS,
  isAdminNavActive,
} from "@/components/admin/admin-nav-items"
import { cn } from "@/lib/utils"

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1">
      <p className="text-muted-foreground px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider">
        Menu
      </p>
      {ADMIN_NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isAdminNavActive(pathname, href, exact)
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-[#0f2a3d] hover:text-white",
          )}
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </Link>
      ))}

      <div className="mt-auto pt-6 border-t mt-6">
        {ADMIN_FOOTER_NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isAdminNavActive(pathname, href, exact)
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-[#0f2a3d] hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-[#0f2a3d] hover:text-white transition-colors"
        >
          <ExternalLink className="size-4 shrink-0" />
          View site
        </Link>
      </div>
    </nav>
  )
}
