/**
 * One-off smoke test: sign in as admin and load /admin/catalog.
 * Run: npx tsx scripts/check-admin-catalog-page.ts
 */
import { chromium } from "playwright"

async function main() {
  const email = process.env.ADMIN_TEST_EMAIL
  const password = process.env.ADMIN_TEST_PASSWORD
  if (!email || !password) {
    throw new Error(
      "ADMIN_TEST_EMAIL and ADMIN_TEST_PASSWORD must be set to run this script",
    )
  }

  const browser = await chromium.launch()
  const page = await browser.newPage()
  const errors: string[] = []

  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`))
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`)
  })

  await page.goto("http://localhost:3000/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/\/(admin|$)/, { timeout: 15000 })

  const response = await page.goto("http://localhost:3000/admin/catalog")
  const status = response?.status() ?? 0
  await page.waitForLoadState("networkidle")

  const bodyText = await page.locator("body").innerText()
  const hasErrorOverlay =
    bodyText.includes("Application error") ||
    bodyText.includes("Unhandled Runtime Error") ||
    bodyText.includes("Internal Server Error")

  console.log("HTTP status:", status)
  console.log("Page title:", await page.title())
  console.log("Has Room Type heading:", bodyText.includes("Room Type"))
  console.log("Has Subcategories:", bodyText.includes("Subcategories"))
  console.log("Has error overlay:", hasErrorOverlay)

  if (errors.length) {
    console.error("Browser errors:")
    for (const e of errors) console.error(" ", e)
  } else {
    console.log("Browser errors: none")
  }

  if (status !== 200 || hasErrorOverlay || errors.length) {
    await browser.close()
    process.exit(1)
  }

  await browser.close()
}

main().catch(async (e) => {
  console.error(e)
  process.exit(1)
})
