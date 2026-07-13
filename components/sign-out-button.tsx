"use client"

import { signOut } from "next-auth/react"

import { siteNavActionClassName } from "@/lib/site-chrome"
import { cn } from "@/lib/utils"

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className={cn(siteNavActionClassName, className)}
    >
      Sign out
    </button>
  )
}
