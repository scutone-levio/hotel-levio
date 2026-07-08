import Stripe from "stripe"

// Server-side Stripe client. Uses a placeholder key so the app still boots
// without real credentials during local development / mock mode.
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder",
  {
    // Use the SDK's pinned default API version. Set STRIPE_API_VERSION only if
    // you need to override it for a specific account.
    typescript: true,
  },
)
