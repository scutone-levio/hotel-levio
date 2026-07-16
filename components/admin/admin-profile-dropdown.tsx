"use client"

import { signOut } from "next-auth/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AdminProfileDropdown({
  name,
  email,
  initials,
}: {
  name: string
  email?: string | null
  initials: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hidden md:flex bg-primary text-primary-foreground size-8 rounded-full items-center justify-center text-xs font-bold outline-none cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Admin account menu"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{name}</p>
          {email && (
            <p className="text-muted-foreground text-xs">{email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
