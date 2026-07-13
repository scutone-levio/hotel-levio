import { readFileSync } from "node:fs"
import { join } from "node:path"

const DESTRUCTIVE_SEED_PATTERNS = [
  /\.booking\.deleteMany\s*\(/,
  /\.room\.deleteMany\s*\(/,
  /\.amenity\.deleteMany\s*\(/,
  /\.user\.deleteMany\s*\(/,
  /prisma\.\$executeRaw(?:Unsafe)?\s*\(/,
  /prisma\.\$queryRaw(?:Unsafe)?\s*\(\s*[`'"].*(?:TRUNCATE|DROP TABLE)/i,
]

/** Fail fast if seed.ts regresses to a destructive implementation. */
export function verifySeedFileSafe(seedPath = join(process.cwd(), "prisma/seed.ts")) {
  const source = readFileSync(seedPath, "utf8")

  for (const pattern of DESTRUCTIVE_SEED_PATTERNS) {
    if (pattern.test(source)) {
      throw new Error(
        `Unsafe seed detected in ${seedPath}. Seed must be non-destructive (no bulk deletes or raw DROP/TRUNCATE).`,
      )
    }
  }
}
