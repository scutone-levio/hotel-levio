import { readFileSync } from "node:fs"
import { join } from "node:path"

import { verifySeedFileSafe } from "../lib/db-safeguards-seed"

const root = process.cwd()

verifySeedFileSafe(join(root, "prisma/seed.ts"))

const prismaSource = readFileSync(join(root, "lib/prisma.ts"), "utf8")
if (!prismaSource.includes("deleteMany")) {
  throw new Error("lib/prisma.ts is missing deleteMany safeguards.")
}

console.log("Database safety checks passed.")
