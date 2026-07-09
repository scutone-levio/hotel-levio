import type { ReactNode } from "react"
import Link from "next/link"

import { siteNavLinkClassName } from "@/lib/site-chrome"
import { cn } from "@/lib/utils"

export function SiteNavLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link href={href} className={cn(siteNavLinkClassName, className)}>
      {children}
    </Link>
  )
}
