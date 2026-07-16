import Image from "next/image"
import Link from "next/link"
import { auth } from "@/auth"
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav"
import { AdminNav } from "@/components/admin/admin-nav"
import { AdminProfileDropdown } from "@/components/admin/admin-profile-dropdown"
import { AdminThemeScope } from "@/components/admin/admin-theme-scope"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const name = session?.user?.name ?? session?.user?.email ?? "Admin"
  const email = session?.user?.email
  const initials = name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="admin-theme bg-muted/30 min-h-screen flex flex-col">
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.classList.add("admin-theme")`,
        }}
      />
      <AdminThemeScope />
      {/* Top bar */}
      <header className="bg-background border-b relative flex items-center justify-between px-5 py-[10px] shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
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
          <span className="text-muted-foreground text-sm font-normal">
            · admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm hidden sm:block">
            {name}
          </span>
          <div className="md:hidden bg-primary text-primary-foreground size-8 rounded-full flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
          <AdminProfileDropdown
            name={name}
            email={email}
            initials={initials}
          />
          <AdminMobileNav />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="bg-background border-r w-52 shrink-0 p-4 hidden md:block">
          <AdminNav />
        </aside>

        {/* Page content */}
        <main className="flex-1 min-w-0 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
