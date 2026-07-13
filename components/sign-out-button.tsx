"use client"

import { signOut } from "next-auth/react"

import { siteNavActionClassName } from "@/lib/site-chrome"

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className={siteNavActionClassName}
    >
      Sign out
    </button>
  )
}
