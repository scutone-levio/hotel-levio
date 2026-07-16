import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ReservationsList } from "@/components/account/reservations-list"
import { ExportCsvButton } from "@/components/account/export-csv-button"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "My Reservations — Hôtel Levio" }

export default async function AccountReservationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/account/login")

  return (
    <>
      <PageHeader
        eyebrow="My account"
        title="Reservations"
        subtitle="View upcoming stays and past bookings."
      />
      <div className="mb-6">
        <ExportCsvButton />
      </div>
      <ReservationsList />
    </>
  )
}
