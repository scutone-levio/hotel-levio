import { PrismaClient } from "@prisma/client"

import {
  assertDestructiveOpsAllowed,
  BULK_DELETE_PROTECTED_MODELS,
  isUnscopedDeleteMany,
} from "@/lib/db-safeguards"

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  }).$extends({
    query: {
      $allModels: {
        async deleteMany({ model, args, query }) {
          if (
            isUnscopedDeleteMany(args) &&
            BULK_DELETE_PROTECTED_MODELS.has(model)
          ) {
            assertDestructiveOpsAllowed(`deleteMany on ${model}`)
          }
          return query(args)
        },
      },
    },
  })
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>

export type PrismaTransactionClient = Parameters<
  Parameters<ExtendedPrismaClient["$transaction"]>[0]
>[0]

// Reuse a single PrismaClient instance across hot-reloads in development to
// avoid exhausting the database connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
