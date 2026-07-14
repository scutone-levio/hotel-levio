import Image from "next/image"
import Link from "next/link"

import { auth } from "@/auth"
import { CartIcon } from "@/components/cart-icon"
import { AccountNav } from "@/components/account-nav"
import { MobileNav } from "@/components/mobile-nav"
import { SiteNavLink } from "@/components/site-nav-link"
import { cartIconTheme, siteHeaderClassName } from "@/lib/site-chrome"

export async function Header() {
  const session = await auth()

  return (
    <header className={`${siteHeaderClassName} relative`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-[10px]">
        <Link
          href="/"
          className="shrink-0 leading-none transition-opacity hover:opacity-90"
        >
          <Image
            src="/hotel-levio-logo-ivory.png"
            alt="Hôtel Levio"
            width={993}
            height={495}
            className="block h-[60px] w-auto"
            priority
          />
        </Link>
        <nav className="hidden lg:flex items-center gap-6">
          <SiteNavLink href="/about">About Us</SiteNavLink>
          <SiteNavLink href="/contact">Contact Us</SiteNavLink>
          <AccountNav user={session?.user ?? null} />
          <span className="text-[#f3ecda]" style={cartIconTheme}>
            <CartIcon />
          </span>
          <Link
            href="/#rooms"
            className="ml-2 border border-[#c69456] px-5 py-2.5 text-[0.72rem] tracking-[0.14em] text-[#c69456] uppercase transition-colors hover:bg-[#c69456] hover:text-[#081a27]"
          >
            Book a Room
          </Link>
        </nav>
        <MobileNav user={session?.user ?? null} />
      </div>
    </header>
  )
}
