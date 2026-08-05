import { test, expect } from "@playwright/test"

test.describe("Concierge chat", () => {
  test("sending a message does not break the home page", async ({ page }) => {
    const pageErrors: string[] = []
    page.on("pageerror", (err) => pageErrors.push(err.message))

    await page.goto("/")
    await expect(page.getByRole("button", { name: /Concierge/i })).toBeVisible()

    await page.getByRole("button", { name: /Concierge/i }).click()
    await expect(page.getByPlaceholder("Ask about rooms or dates")).toBeVisible()

    await page.getByPlaceholder("Ask about rooms or dates").fill("What rooms do you have?")
    await page.getByLabel("Send message").click()

    // Wait for the concierge to settle into a resolved state instead of a fixed
    // delay. With the Python bridge unavailable (the CI default), that surfaces
    // as the "unavailable" notice or a client-side error; otherwise the assistant
    // reply lands. Any of these means the async round-trip has finished.
    const settled = page
      .getByText("Concierge unavailable")
      .or(
        page.getByText(
          /Concierge request failed|Could not reach the concierge service/i,
        ),
      )
      .or(page.getByRole("button", { name: "Add to cart" }))
    await expect(settled.first()).toBeVisible({ timeout: 20000 })

    const homeResponse = await page.request.get("/")
    expect(homeResponse.status()).toBe(200)

    await page.reload()
    await expect(page.getByRole("button", { name: /Concierge/i })).toBeVisible({
      timeout: 20000,
    })

    const criticalErrors = pageErrors.filter(
      (message) =>
        !/quota|rate limit|429|Failed to fetch|agent bridge|port 8000/i.test(
          message,
        ),
    )
    expect(criticalErrors).toEqual([])
  })
})
