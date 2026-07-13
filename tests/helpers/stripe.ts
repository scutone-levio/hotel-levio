import { expect, type FrameLocator, type Page } from "@playwright/test"

function paymentFrame(page: Page): FrameLocator {
  return page.frameLocator('iframe[src*="elements-inner-accessory-target"]')
}

/** Fill Stripe Payment Element test card fields inside nested iframes. */
export async function fillStripePaymentElement(page: Page) {
  await expect(page.getByRole("button", { name: /^Pay CA \$/ })).toBeVisible({
    timeout: 30_000,
  })

  const frame = paymentFrame(page)

  await expect(async () => {
    const cardTab = frame.getByRole("button", { name: "Card", exact: true })
    if ((await cardTab.count()) > 0) {
      await cardTab.click()
    }
    await expect(frame.locator('[name="number"]')).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })

  await frame.locator('[name="number"]').fill("4242 4242 4242 4242")
  await frame.locator('[name="expiry"]').fill("12 / 34")
  await frame.locator('[name="cvc"]').fill("123")

  const countrySelect = frame.locator('[name="country"]')
  if ((await countrySelect.count()) > 0) {
    await countrySelect.selectOption("CA")
  }

  const postalField = frame.locator(
    '[name="postalCode"], [autocomplete="postal-code"]',
  )
  if ((await postalField.count()) > 0) {
    await postalField.fill("K1A 0B1")
  }

  await page.getByRole("heading", { name: "Payment" }).click()
}
