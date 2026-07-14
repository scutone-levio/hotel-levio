"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { signIn } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
    if (res?.error) {
      setError("Invalid email or password")
      setPending(false)
      return
    }
    // Full navigation so server components pick up the new session cookie.
    window.location.href = callbackUrl
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mb-2 flex justify-center">
          <Link href="/">
            <Image
              src="/hotel-levio-logo.png"
              alt="Hôtel Levio"
              width={993}
              height={495}
              className="h-[52px] w-auto"
            />
          </Link>
        </div>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Staff access to the admin dashboard</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="admin@hotel.test"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="blue" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {process.env.NODE_ENV !== "production" && (
          <p className="text-muted-foreground mt-4 text-center text-xs">
            Demo admin: <span className="font-medium">admin@hotel.test</span> ·
            password <span className="font-medium">password123</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
