import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { AuthPanel } from "@/components/auth-panel"
import { getOAuthProviders, isOAuthEnabled, sanitizeCallbackUrl } from "@/lib/oauth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata = { title: "Create Account — Hôtel Levio" }

export default async function AccountRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const session = await auth()
  const { callbackUrl } = await searchParams
  const destination = sanitizeCallbackUrl(callbackUrl)
  const oauthProviders = getOAuthProviders()
  const oauthEnabled = isOAuthEnabled()

  if (session?.user) {
    redirect(session.user.role === "ADMIN" ? "/admin" : destination)
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Required to complete a reservation and view your bookings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthPanel
              callbackUrl={destination}
              defaultTab="register"
              oauthEnabled={oauthEnabled}
              oauthProviders={oauthProviders}
            />
            <p className="text-muted-foreground mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link
                href={`/account/login?callbackUrl=${encodeURIComponent(destination)}`}
                className="underline underline-offset-2"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
