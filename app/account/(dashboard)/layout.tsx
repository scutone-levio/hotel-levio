import { AccountShell } from "@/components/account/account-shell"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function AccountDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <AccountShell>{children}</AccountShell>
      </main>
      <Footer />
    </div>
  )
}
