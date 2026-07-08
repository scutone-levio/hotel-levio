import { test, expect } from "@playwright/test"

test.describe("Rooms filter", () => {
  test("filters rooms by type via the filter modal", async ({ page }) => {
    await page.goto("/")

    const cards = page.getByTestId("room-card")
    await expect(cards.first()).toBeVisible()
    const initialCount = await cards.count()
    expect(initialCount).toBeGreaterThan(1)

    // The filter button sits to the right of the "Available rooms" title.
    await page.getByTestId("rooms-filter-trigger").click()

    const modal = page.getByTestId("rooms-filter-modal")
    await expect(modal).toBeVisible()

    // Select the first room-type checkbox, then apply.
    await modal.locator('input[type="checkbox"]').first().check()
    await page.getByRole("button", { name: /Show \d+ room/ }).click()
    await expect(modal).toBeHidden()

    const filteredCount = await cards.count()
    expect(filteredCount).toBeGreaterThan(0)
    expect(filteredCount).toBeLessThan(initialCount)

    // Clearing filters restores every room.
    await page.getByTestId("rooms-filter-trigger").click()
    await expect(modal).toBeVisible()
    await page.getByRole("button", { name: "Clear all" }).click()
    await page.getByRole("button", { name: /Show \d+ room/ }).click()
    await expect(modal).toBeHidden()
    await expect(cards).toHaveCount(initialCount)
  })
})
