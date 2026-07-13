import { expect, type Page } from "@playwright/test"

export async function selectAndApplyDateRange(page: Page) {
  const trigger = page.getByTestId("booking-date-trigger")
  await expect(trigger).toBeVisible()
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()

  const calendar = page.getByTestId("booking-calendar")
  await expect(calendar).toBeVisible({ timeout: 15_000 })

  const enabledDays = calendar.locator("button[data-day]:not([disabled])")
  await expect(enabledDays.first()).toBeVisible()

  await enabledDays.nth(1).click()
  await enabledDays.nth(5).click()

  await expect(page.getByTestId("booking-nights")).toContainText(/night/i)
  await page.getByTestId("booking-apply").click()
  await expect(calendar).toBeHidden()

  return trigger
}

/** Pick a date range inside an open Book Room dialog calendar. */
export async function selectDatesInDialog(page: Page) {
  const dialog = page.locator('[data-slot="dialog-content"]')
  await expect(dialog).toBeVisible()

  const enabledDays = dialog.locator("button[data-day]:not([disabled])")
  await expect(enabledDays.first()).toBeVisible()
  // Pick dates further out to avoid overlapping seed bookings or prior E2E runs.
  await enabledDays.nth(10).click()
  await enabledDays.nth(14).click()
}
