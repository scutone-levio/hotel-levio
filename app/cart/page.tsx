import { auth } from "@/auth"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { CartCheckoutForm } from "@/components/cart-checkout-form"
import { PageHeader } from "@/components/page-header"
import { getOAuthProviders, isOAuthEnabled } from "@/lib/oauth"

export const metadata = { title: "Your Cart — Hôtel Levio" }

export default async function CartPage() {
  const session = await auth()
  const oauthProviders = getOAuthProviders()
  const oauthEnabled = isOAuthEnabled()

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <PageHeader
            eyebrow="Your stay"
            title="Your cart"
            subtitle={
              session?.user
                ? "Review your rooms and complete payment."
                : "Review your rooms, sign in, and complete payment."
            }
          />
          <CartCheckoutForm
            publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
            isAuthenticated={!!session?.user}
            oauthEnabled={oauthEnabled}
            oauthProviders={oauthProviders}
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}
