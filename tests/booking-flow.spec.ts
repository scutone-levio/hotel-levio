import { test, expect, type Page } from "@playwright/test"

async function selectAndApplyDateRange(page: Page) {
  const trigger = page.getByTestId("booking-date-trigger")
  await expect(trigger).toBeVisible()
  await trigger.click()

  const calendar = page.getByTestId("booking-calendar")
  await expect(calendar).toBeVisible()

  const enabledDays = calendar.locator("button[data-day]:not([disabled])")
  await expect(enabledDays.first()).toBeVisible()

  await enabledDays.nth(1).click()
  await enabledDays.nth(5).click()

  await expect(page.getByTestId("booking-nights")).toContainText(/night/i)
  await page.getByTestId("booking-apply").click()
  await expect(calendar).toBeHidden()

  return trigger
}

test.describe("Booking flow", () => {
  test("a user can open the calendar and select a date range", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(
      page.getByRole("heading", { name: /lakeside escape/i }),
    ).toBeVisible()

    const trigger = await selectAndApplyDateRange(page)
    await expect(trigger).toContainText(/\d{4}/)
  })

  test("persists selected dates across client navigation", async ({
    page,
  }) => {
    await page.goto("/")

    const trigger = await selectAndApplyDateRange(page)
    await expect(trigger).toContainText(/\d{4}/)

    const selectedLabel = (await trigger.textContent()) ?? ""

    await page.goto("/about")
    await expect(page).toHaveURL(/\/about$/)

    await page.goto("/")
    await expect(
      page.getByRole("heading", { name: /lakeside escape/i }),
    ).toBeVisible()

    const restoredTrigger = page.getByTestId("booking-date-trigger")
    await expect(restoredTrigger).toContainText(/\d{4}/)
    await expect(restoredTrigger).not.toContainText(/check-in/i)
    await expect(restoredTrigger).toHaveText(selectedLabel)

    expect(page.url()).not.toMatch(/checkIn=/)
    expect(page.url()).not.toMatch(/checkOut=/)
  })

  test("room cards render with a Book Now action", async ({ page }) => {
    await page.goto("/")

    const cards = page.getByTestId("room-card")
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeGreaterThan(0)

    await expect(page.getByTestId("book-now").first()).toBeVisible()
  })
})
