/** Required to run unscoped deleteMany via Prisma (e.g. legacy scripts). */
export const ALLOW_DESTRUCTIVE_DB_OPS_ENV = "ALLOW_DESTRUCTIVE_DB_OPS"

/** Required to run `npm run db:reset` (drops all tables). */
export const CONFIRM_DB_RESET_ENV = "CONFIRM_DB_RESET"

export const BULK_DELETE_PROTECTED_MODELS = new Set([
  "Booking",
  "Room",
  "User",
  "Amenity",
  "RoomImage",
  "RoomBlackout",
  "RoomPriceRule",
])

export function destructiveOpsAllowed() {
  return process.env[ALLOW_DESTRUCTIVE_DB_OPS_ENV] === "yes"
}

export function resetConfirmed() {
  return process.env[CONFIRM_DB_RESET_ENV] === "yes"
}

export function assertDestructiveOpsAllowed(context: string): never | void {
  if (destructiveOpsAllowed()) return

  throw new Error(
    [
      `Blocked destructive database operation: ${context}`,
      `Set ${ALLOW_DESTRUCTIVE_DB_OPS_ENV}=yes only when you intentionally need to wipe data.`,
    ].join("\n"),
  )
}

/** True when deleteMany would remove every row in a table. */
export function isUnscopedDeleteMany(args: { where?: unknown }) {
  if (args.where === undefined) return true
  if (
    typeof args.where === "object" &&
    args.where !== null &&
    !Array.isArray(args.where)
  ) {
    return Object.keys(args.where as object).length === 0
  }
  return false
}
