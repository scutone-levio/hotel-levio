import { spawnSync } from "node:child_process"

import { verifySeedFileSafe } from "../lib/db-safeguards-seed"

try {
  verifySeedFileSafe()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

const result = spawnSync("tsx", ["prisma/seed.ts"], {
  stdio: "inherit",
  env: process.env,
})

process.exit(result.status ?? 1)
