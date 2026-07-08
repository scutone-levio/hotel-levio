import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CartIcon } from "@/components/cart-icon"

export function Header() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-[10px]">
        <Link
          href="/"
          className="shrink-0 leading-none hover:opacity-90 transition-opacity"
        >
          <Image
            src="/hotel-levio-logo.png"
            alt="Hôtel Levio"
            width={993}
            height={495}
            className="block h-[60px] w-auto"
            priority
          />
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/about">About Us</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/contact">Contact Us</Link>
          </Button>
          <CartIcon />
          <Button asChild className="ml-2">
            <Link href="/#rooms">Book a room</Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}
