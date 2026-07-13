import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { LoginForm } from "@/components/login-form"
import { sanitizeCallbackUrl } from "@/lib/oauth"

export const metadata = {
  title: "Sign In — Hôtel Levio",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const session = await auth()
  if (session?.user) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/account")
  }

  const { callbackUrl } = await searchParams
  const destination = callbackUrl ? sanitizeCallbackUrl(callbackUrl) : "/admin"
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <LoginForm callbackUrl={destination} />
    </main>
  )
}
