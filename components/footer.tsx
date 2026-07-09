import Image from "next/image"
import Link from "next/link"

import { SiteNavLink } from "@/components/site-nav-link"
import { siteFooterClassName } from "@/lib/site-chrome"

export function Footer() {
  return (
    <footer className={siteFooterClassName}>
      <div className="mx-auto flex max-w-6xl flex-col flex-wrap items-center justify-between gap-6 px-6 py-12 text-sm sm:flex-row">
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="shrink-0 leading-none transition-opacity hover:opacity-90"
          >
            <Image
              src="/hotel-levio-logo-symbol-ivory.png"
              alt="Hôtel Levio"
              width={385}
              height={648}
              className="block h-[80px] w-auto"
            />
          </Link>
          <div className="flex flex-col gap-1">
            <span className="font-heading text-[0.95rem] tracking-[0.14em] text-[#f3ecda] uppercase">
              Hôtel Levio
            </span>
            <span className="text-[0.76rem] tracking-wide text-[#f3ecda]/55">
              © {new Date().getFullYear()} Hôtel Levio. A demo application.
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-6">
          <SiteNavLink href="/privacy">Privacy Policy</SiteNavLink>
          <SiteNavLink href="/admin">Admin</SiteNavLink>
        </nav>
      </div>
    </footer>
  )
}
