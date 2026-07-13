import { test, expect } from "@playwright/test"

import { selectDatesInDialog } from "./helpers/dates"
import { fillStripePaymentElement } from "./helpers/stripe"

test.describe("Customer checkout", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.STRIPE_SECRET_KEY ||
        !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      "Stripe test keys required for checkout E2E",
    )
  })

  test("registers a new customer account", async ({ page }) => {
    const email = `e2e-${Date.now()}@hotel.test`

    await page.goto("/account/register?callbackUrl=/")
    await page.locator("#auth-register-name").fill("E2E Register Guest")
    await page.locator("#auth-register-email").fill(email)
    await page.locator("#auth-register-password").fill("password123")
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page).toHaveURL("/")
    await expect(page.getByRole("link", { name: "My account" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0)
  })

  test("signed-in customer completes cart checkout and sees reservation", async ({
    page,
  }) => {
    test.setTimeout(180_000)

    await page.goto("/account/login?callbackUrl=/")
    await page.locator("#auth-signin-email").fill("customer@hotel.test")
    await page.locator("#auth-signin-password").fill("password123")
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page).toHaveURL("/")
    await expect(page.getByRole("link", { name: "My account" })).toBeVisible()
    await page.waitForLoadState("networkidle")

    await page.locator("#rooms").scrollIntoViewIfNeeded()
    await expect(async () => {
      await page.getByTestId("room-card").first().getByTestId("book-now").click()
      await expect(page.locator('[data-slot="dialog-content"]')).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 20_000 })
    await selectDatesInDialog(page)
    await expect(page.getByRole("button", { name: "Add to cart" })).toBeEnabled({
      timeout: 15_000,
    })
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.locator('[data-slot="dialog-content"]')).toBeHidden()

    await page.getByRole("link", { name: /Cart \(1 item\)/i }).click()
    await expect(page).toHaveURL("/cart")

    await page.getByRole("button", { name: "Continue →" }).click()
    await expect(page.getByText("Signed in as Demo Customer")).toBeVisible()

    await page
      .getByLabel("Special requests (optional)")
      .fill("Late check-in please")
    await page.getByRole("button", { name: "Continue to payment →" }).click()

    await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible()
    await fillStripePaymentElement(page)
    const payButton = page.getByRole("button", { name: /^Pay CA \$/ })
    await expect(payButton).toBeEnabled({ timeout: 30_000 })
    await page
      .locator("form")
      .filter({ has: payButton })
      .evaluate((form) => form.requestSubmit())

    await expect(page).toHaveURL(/\/cart\/confirmation\?ids=/, {
      timeout: 90_000,
    })
    await expect(page.getByText(/confirmed!/i)).toBeVisible()

    await page.goto("/account/reservations")
    await expect(page.getByRole("heading", { name: "Reservations" })).toBeVisible()
    await expect(page.getByText(/Upcoming \(\d+\)/)).toBeVisible()
    await expect(page.getByText("CONFIRMED").first()).toBeVisible()
  })
})
