"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ExternalLink, Menu, X } from "lucide-react"
import { signOut } from "next-auth/react"

import {
  ADMIN_NAV_ITEMS,
  isAdminNavActive,
} from "@/components/admin/admin-nav-items"
import { cn } from "@/lib/utils"

export function AdminMobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  function close() {
    setOpen(false)
  }

  return (
    <div className="flex md:hidden items-center">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="admin-mobile-nav-panel"
        onClick={() => setOpen(!open)}
        className="cursor-pointer p-1 text-foreground"
      >
        {open ? <X className="size-6" /> : <Menu className="size-6" />}
      </button>

      <div
        id="admin-mobile-nav-panel"
        inert={!open}
        className={cn(
          "absolute left-0 right-0 top-full z-40 overflow-hidden",
          !open && "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "border-b bg-background transition-transform",
            open
              ? "translate-y-0 duration-200 ease-out"
              : "-translate-y-full duration-150 ease-in",
          )}
        >
          <nav
            onClick={close}
            className="flex flex-col gap-1 px-5 py-3"
          >
            {ADMIN_NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
              const active = isAdminNavActive(pathname, href, exact)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-[#0f2a3d] hover:text-white",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              )
            })}

            <div className="my-2 border-t" />

            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-[#0f2a3d] hover:text-white transition-colors"
            >
              <ExternalLink className="size-4 shrink-0" />
              View site
            </Link>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg px-3 py-3 text-left text-sm font-medium text-foreground hover:bg-[#0f2a3d] hover:text-white transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </nav>
        </div>
      </div>
    </div>
  )
}
