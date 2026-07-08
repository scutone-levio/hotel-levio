import Image from "next/image"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-8 text-sm sm:flex-row">
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <Link
            href="/"
            className="shrink-0 leading-none hover:opacity-90 transition-opacity"
          >
            <Image
              src="/hotel-levio-logo-symbol.png"
              alt="Hôtel Levio"
              width={385}
              height={648}
              className="block h-[100px] w-auto"
            />
          </Link>
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} Hôtel Levio. A demo application.
          </p>
        </div>
        <nav className="text-muted-foreground flex items-center gap-4">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/admin" className="hover:text-foreground transition-colors">
            Admin
          </Link>
        </nav>
      </div>
    </footer>
  )
}
