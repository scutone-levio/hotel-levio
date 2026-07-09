import Image from "next/image"
import Link from "next/link"

// Same fixed navy band as the header (bg-[#081a27]), so the page is
// bookended top and bottom regardless of the app's light/dark theme.
export function Footer() {
  return (
    <footer className="border-t border-[#c69456]/20 bg-[#081a27]">
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
            <span
              className="text-[0.95rem] tracking-[0.14em] text-[#f3ecda] uppercase"
              style={{
                fontFamily:
                  '"Big Caslon", "Hoefler Text", Georgia, "Times New Roman", serif',
              }}
            >
              Hôtel Levio
            </span>
            <span className="text-[0.76rem] tracking-wide text-[#f3ecda]/55">
              © {new Date().getFullYear()} Hôtel Levio. A demo application.
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-6">
          <Link
            href="/privacy"
            className="border-b border-transparent pb-0.5 text-[0.74rem] tracking-[0.14em] text-[#f3ecda]/80 uppercase transition-colors hover:border-[#c69456] hover:text-[#f3ecda]"
          >
            Privacy Policy
          </Link>
          <Link
            href="/admin"
            className="border-b border-transparent pb-0.5 text-[0.74rem] tracking-[0.14em] text-[#f3ecda]/80 uppercase transition-colors hover:border-[#c69456] hover:text-[#f3ecda]"
          >
            Admin
          </Link>
        </nav>
      </div>
    </footer>
  )
}
