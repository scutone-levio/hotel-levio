import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { LoginForm } from "@/components/login-form"

export const metadata = {
  title: "Sign In — Hôtel Levio",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const session = await auth()
  if (session?.user) redirect("/admin")

  const { callbackUrl } = await searchParams
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <LoginForm callbackUrl={callbackUrl ?? "/admin"} />
    </main>
  )
}
