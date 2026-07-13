"use client"

import * as React from "react"
import { toast } from "sonner"

import { changePassword, updateProfile } from "@/app/account/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type ProfileUser = {
  id: string
  name: string | null
  email: string
  phone: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  province: string | null
  postalCode: string | null
  country: string | null
  hasPassword: boolean
}

export function ProfileForm({ user }: { user: ProfileUser }) {
  const [pending, startTransition] = React.useTransition()
  const [passwordPending, startPasswordTransition] = React.useTransition()
  const [form, setForm] = React.useState({
    name: user.name ?? "",
    phone: user.phone ?? "",
    addressLine1: user.addressLine1 ?? "",
    addressLine2: user.addressLine2 ?? "",
    city: user.city ?? "",
    province: user.province ?? "",
    postalCode: user.postalCode ?? "",
    country: user.country ?? "CA",
  })
  const [passwords, setPasswords] = React.useState({
    currentPassword: "",
    newPassword: "",
  })

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateProfile(form)
      if (result.ok) toast.success("Profile updated")
      else toast.error(result.error)
    })
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    startPasswordTransition(async () => {
      const result = await changePassword(passwords)
      if (result.ok) {
        toast.success("Password updated")
        setPasswords({ currentPassword: "", newPassword: "" })
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-10">
      <form onSubmit={handleProfileSubmit} className="space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} readOnly disabled />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="addressLine1">Address line 1</Label>
          <Input
            id="addressLine1"
            value={form.addressLine1}
            onChange={(e) =>
              setForm((f) => ({ ...f, addressLine1: e.target.value }))
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="addressLine2">Address line 2</Label>
          <Input
            id="addressLine2"
            value={form.addressLine2}
            onChange={(e) =>
              setForm((f) => ({ ...f, addressLine2: e.target.value }))
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="province">Province / State</Label>
            <Input
              id="province"
              value={form.province}
              onChange={(e) =>
                setForm((f) => ({ ...f, province: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input
              id="postalCode"
              value={form.postalCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, postalCode: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={form.country}
              onChange={(e) =>
                setForm((f) => ({ ...f, country: e.target.value }))
              }
            />
          </div>
        </div>

        <Button type="submit" disabled={pending} className="cursor-pointer">
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>

      {user.hasPassword ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-4 border-t pt-8">
          <h2 className="text-lg font-semibold">Change password</h2>
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={passwords.currentPassword}
              onChange={(e) =>
                setPasswords((p) => ({
                  ...p,
                  currentPassword: e.target.value,
                }))
              }
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={passwords.newPassword}
              onChange={(e) =>
                setPasswords((p) => ({ ...p, newPassword: e.target.value }))
              }
              required
              minLength={8}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={passwordPending}
            className="cursor-pointer"
          >
            {passwordPending ? "Updating…" : "Update password"}
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground border-t pt-8 text-sm">
          You signed in with Google or Facebook. Password change is not available
          for this account.
        </p>
      )}
    </div>
  )
}
