import { test, expect } from "@playwright/test"

test.describe("Admin policy search", () => {
  test("redirects unauthenticated users away from /admin/knowledge", async ({ page }) => {
    await page.goto("/admin/knowledge")
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole("button", { name: /sign in/i }).first()).toBeVisible()
  })
})
