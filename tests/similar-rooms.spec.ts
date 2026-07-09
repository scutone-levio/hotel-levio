import { test, expect, type Locator } from "@playwright/test"

import { SEED_FEATURED_SUBCATEGORY_NAME } from "../lib/subcategories"

function roomTitleLink(card: Locator) {
  return card.locator('[data-slot="card-title"] a')
}

test.describe("Similar rooms", () => {
  test("recommendations use public subcategory listings", async ({ page }) => {
    await page.goto("/")

    const featuredCard = page
      .locator('[data-testid="room-card"][data-featured="true"]')
      .first()
    await expect(featuredCard).toBeVisible()

    const detailLink = roomTitleLink(featuredCard)
    const listingTitle = (await detailLink.textContent())?.trim() ?? ""
    expect(listingTitle).toContain(SEED_FEATURED_SUBCATEGORY_NAME)
    expect(listingTitle).toContain(" - ")

    await detailLink.click()
    await expect(page).toHaveURL(/\/rooms\/.*\?subcategory=/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(listingTitle)

    const section = page.getByRole("heading", {
      name: "Other Rooms You Might Like",
    })
    await expect(section).toBeVisible()

    const similarSection = section.locator("xpath=ancestor::section[1]")
    const similarCards = similarSection.locator('[data-testid="room-card"]')
    await expect(similarCards.first()).toBeVisible()

    const similarCount = await similarCards.count()
    expect(similarCount).toBeGreaterThan(0)
    expect(similarCount).toBeLessThanOrEqual(3)

    for (let i = 0; i < similarCount; i++) {
      const title = await roomTitleLink(similarCards.nth(i)).textContent()
      expect(title).toContain(" - ")
      expect(title?.trim()).not.toBe(listingTitle)
    }

    const href = await roomTitleLink(similarCards.first()).getAttribute("href")
    expect(href).toMatch(/\?subcategory=/)
  })
})
