import type { CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { CartIcon } from "@/components/cart-icon"

// Fixed navy band (matches the hero's dusk gradient) so the ivory mark and
// gold accents always have the dark ground they were designed against,
// independent of the app's light/dark theme.
const cartTheme = {
  "--foreground": "#f3ecda",
  "--muted": "rgba(198, 148, 86, 0.16)",
  "--primary": "#c69456",
  "--primary-foreground": "#081a27",
} as CSSProperties

export function Header() {
  return (
    <header className="border-b border-[#c69456]/20 bg-[#081a27]">
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
        <nav className="flex items-center gap-6">
          <Link
            href="/about"
            className="border-b border-transparent pb-0.5 text-[0.74rem] tracking-[0.14em] text-[#f3ecda]/80 uppercase transition-colors hover:border-[#c69456] hover:text-[#f3ecda]"
          >
            About Us
          </Link>
          <Link
            href="/contact"
            className="border-b border-transparent pb-0.5 text-[0.74rem] tracking-[0.14em] text-[#f3ecda]/80 uppercase transition-colors hover:border-[#c69456] hover:text-[#f3ecda]"
          >
            Contact Us
          </Link>
          <span className="text-[#f3ecda]" style={cartTheme}>
            <CartIcon />
          </span>
          <Link
            href="/#rooms"
            className="ml-2 border border-[#c69456] px-5 py-2.5 text-[0.72rem] tracking-[0.14em] text-[#c69456] uppercase transition-colors hover:bg-[#c69456] hover:text-[#081a27]"
          >
            Book a Room
          </Link>
        </nav>
      </div>
    </header>
  )
}
