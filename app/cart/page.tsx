import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { CartCheckoutForm } from "@/components/cart-checkout-form"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Your Cart — Hôtel Levio" }

export default function CartPage() {
  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <PageHeader
            eyebrow="Your stay"
            title="Your cart"
            subtitle="Review your rooms, enter your details, and complete payment."
          />
          <CartCheckoutForm
            publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}
