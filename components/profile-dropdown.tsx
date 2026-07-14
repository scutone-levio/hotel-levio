"use client"

import Link from "next/link"
import { UserCircle } from "lucide-react"
import { signOut } from "next-auth/react"
import type { Session } from "next-auth"

import { SiteNavLink } from "@/components/site-nav-link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const iconClassName =
  "text-[#f3ecda]/80 hover:text-[#f3ecda] transition-colors"

export function ProfileDropdown({ user }: { user: Session["user"] | null }) {
  if (!user) {
    return (
      <>
        <SiteNavLink href="/account/login">Sign in</SiteNavLink>
        <Link
          href="/account/login"
          className={iconClassName}
          aria-label="Sign in"
        >
          <UserCircle className="size-5" />
        </Link>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`${iconClassName} outline-none`}
        aria-label="Account menu"
      >
        <UserCircle className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {user.role !== "ADMIN" && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/account">My account</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/reservations">Reservations</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
