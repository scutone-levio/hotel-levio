import { test, expect } from "@playwright/test"

import { SEED_FEATURED_SUBCATEGORY_NAME } from "../lib/subcategories"

test.describe("Featured subcategories", () => {
  test("featured listings show a badge on room cards", async ({ page }) => {
    await page.goto("/")

    const featuredCards = page.locator('[data-testid="room-card"][data-featured="true"]')
    const nonFeaturedCards = page.locator(
      '[data-testid="room-card"][data-featured="false"]',
    )

    await expect(featuredCards.first()).toBeVisible()
    expect(await featuredCards.count()).toBeGreaterThan(0)
    expect(await nonFeaturedCards.count()).toBeGreaterThan(0)

    await expect(
      featuredCards.first().getByTestId("featured-badge"),
    ).toBeVisible()
    await expect(
      nonFeaturedCards.first().getByTestId("featured-badge"),
    ).toHaveCount(0)

    const featuredTitle = await featuredCards
      .first()
      .getByRole("link")
      .first()
      .textContent()
    expect(featuredTitle).toContain(SEED_FEATURED_SUBCATEGORY_NAME)
  })

  test("default sort places featured listings before non-featured", async ({
    page,
  }) => {
    await page.goto("/")

    const cards = page.getByTestId("room-card")
    await expect(cards.first()).toBeVisible()

    const count = await cards.count()
    expect(count).toBeGreaterThan(1)

    let sawNonFeatured = false
    for (let i = 0; i < count; i++) {
      const featured = await cards.nth(i).getAttribute("data-featured")
      if (featured === "false") {
        sawNonFeatured = true
      } else if (sawNonFeatured) {
        throw new Error(
          `Non-featured card at index ${i - 1} was followed by featured card at index ${i}`,
        )
      }
    }
  })

  test("detail page shows featured badge when opened from a featured listing", async ({
    page,
  }) => {
    await page.goto("/")

    const featuredCard = page
      .locator('[data-testid="room-card"][data-featured="true"]')
      .first()
    await expect(featuredCard).toBeVisible()

    await featuredCard.getByRole("link").first().click()
    await expect(page).toHaveURL(/\/rooms\/.*\?subcategory=/)

    await expect(page.getByTestId("featured-badge")).toBeVisible()
  })

  test("switching to price sort still shows badges but changes card order", async ({
    page,
  }) => {
    await page.goto("/")

    const sortTrigger = page.locator('[role="combobox"]').nth(1)
    await sortTrigger.click()
    await page.getByRole("option", { name: "Price: low to high" }).click()

    const cards = page.getByTestId("room-card")
    await expect(cards.first()).toBeVisible()

    const featuredCount = await page
      .locator('[data-testid="room-card"][data-featured="true"]')
      .count()
    expect(featuredCount).toBeGreaterThan(0)

    const firstFeatured = await cards.first().getAttribute("data-featured")
    const allFeatured = featuredCount === (await cards.count())
    expect(firstFeatured === "false" || allFeatured).toBeTruthy()
  })
})
