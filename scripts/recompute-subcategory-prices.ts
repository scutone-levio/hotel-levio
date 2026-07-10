import { prisma } from "../lib/prisma"
import {
  deleteOrphanSubcategories,
  recomputeAllSubcategoryPricing,
  syncMismatchedInventoryBases,
} from "../lib/subcategory-pricing"

async function main() {
  console.log("Recomputing subcategory listing prices…")

  const basesSynced = await syncMismatchedInventoryBases()
  console.log(`  • ${basesSynced} inventory base price(s) synced to subcategory`)

  const orphansDeleted = await deleteOrphanSubcategories()
  console.log(`  • ${orphansDeleted} orphan subcategory(ies) deleted`)

  await recomputeAllSubcategoryPricing()
  console.log("  • fromPriceCents + hasWeekendRates updated for all subcategories")

  console.log("Done.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
