import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ProfileForm } from "@/components/account/profile-form"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "My Account — Hôtel Levio" }

export default async function AccountProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/account/login")

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) redirect("/account/login")

  return (
    <>
      <PageHeader
        eyebrow="My account"
        title="Profile"
        subtitle="Update your contact details and address."
      />
      <ProfileForm
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          addressLine1: user.addressLine1,
          addressLine2: user.addressLine2,
          city: user.city,
          province: user.province,
          postalCode: user.postalCode,
          country: user.country,
          hasPassword: !!user.password,
        }}
      />
    </>
  )
}
