import { spawnSync } from "node:child_process"

import { PrismaClient } from "@prisma/client"

import {
  ALLOW_DESTRUCTIVE_DB_OPS_ENV,
  resetConfirmed,
} from "../lib/db-safeguards"

async function main() {
  if (!resetConfirmed()) {
    console.error(`
Refusing to reset the database.

\`db:reset\` drops every table and re-runs migrations + seed.
Your bookings, rooms, and users will be permanently deleted.

To proceed intentionally, run:
  CONFIRM_DB_RESET=yes npm run db:reset
`)
    process.exit(1)
  }

  const prisma = new PrismaClient()
  try {
    const [bookings, rooms, users] = await Promise.all([
      prisma.booking.count(),
      prisma.room.count(),
      prisma.user.count(),
    ])

    if (bookings > 0 || rooms > 0 || users > 0) {
      console.warn(
        `Warning: this reset will delete ${bookings} booking(s), ${rooms} room(s), and ${users} user(s).`,
      )
    }
  } finally {
    await prisma.$disconnect()
  }

  const result = spawnSync(
    "npx",
    ["prisma", "migrate", "reset", "--force"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        [ALLOW_DESTRUCTIVE_DB_OPS_ENV]: "yes",
      },
    },
  )

  process.exit(result.status ?? 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
