import type { Session } from "next-auth"

import { SignOutButton } from "@/components/sign-out-button"
import { SiteNavLink } from "@/components/site-nav-link"

export function AccountNav({
  user,
}: {
  user: Session["user"] | null
}) {
  if (!user) {
    return <SiteNavLink href="/account/login">Sign in</SiteNavLink>
  }

  if (user.role === "ADMIN") {
    return (
      <>
        <SiteNavLink href="/admin">Admin</SiteNavLink>
        <SignOutButton />
      </>
    )
  }

  return (
    <>
      <SiteNavLink href="/account">My account</SiteNavLink>
      <SiteNavLink href="/account/reservations">Reservations</SiteNavLink>
      <SignOutButton />
    </>
  )
}
