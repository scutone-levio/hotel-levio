"use client"

import * as React from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import type { Session } from "next-auth"

import { CartIcon } from "@/components/cart-icon"
import { SignOutButton } from "@/components/sign-out-button"
import { SiteNavLink } from "@/components/site-nav-link"
import { cartIconTheme } from "@/lib/site-chrome"
import { cn } from "@/lib/utils"

export function MobileNav({ user }: { user: Session["user"] | null }) {
  const [open, setOpen] = React.useState(false)

  function close() {
    setOpen(false)
  }

  return (
    <div className="flex lg:hidden items-center gap-3">
      <span className="text-[#f3ecda]" style={cartIconTheme}>
        <CartIcon />
      </span>

      <Link
        href="/#rooms"
        onClick={close}
        className="ml-2 border border-[#c69456] px-5 py-2.5 text-[0.72rem] tracking-[0.14em] text-[#c69456] uppercase transition-colors hover:bg-[#c69456] hover:text-[#081a27]"
      >
        Book a Room
      </Link>

      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen(!open)}
        className="cursor-pointer p-1 text-[#f3ecda]"
      >
        {open ? <X className="size-6" /> : <Menu className="size-6" />}
      </button>

      <div
        id="mobile-nav-panel"
        inert={!open}
        className={cn(
          "absolute left-0 right-0 top-full z-40 overflow-hidden",
          !open && "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "border-b border-[#c69456]/20 bg-[#081a27] transition-transform",
            open
              ? "translate-y-0 duration-200 ease-out"
              : "-translate-y-full duration-150 ease-in",
          )}
        >
        <nav
          onClick={close}
          className="mx-auto flex max-w-6xl flex-col px-6 py-2"
        >
          <SiteNavLink href="/about" className="block py-4">
            About Us
          </SiteNavLink>
          <SiteNavLink href="/contact" className="block py-4">
            Contact Us
          </SiteNavLink>

          <div className="my-2 border-t border-[#c69456]/20" />

          {!user && (
            <SiteNavLink href="/account/login" className="block py-4">
              Sign in
            </SiteNavLink>
          )}
          {user && user.role !== "ADMIN" && (
            <>
              <SiteNavLink href="/account" className="block py-4">
                My account
              </SiteNavLink>
              <SiteNavLink href="/account/reservations" className="block py-4">
                Reservations
              </SiteNavLink>
              <SignOutButton className="block py-4 text-left cursor-pointer" />
            </>
          )}
          {user?.role === "ADMIN" && (
            <SignOutButton className="block py-4 text-left cursor-pointer" />
          )}
        </nav>
        </div>
      </div>
    </div>
  )
}
