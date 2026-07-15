"use client"

import * as React from "react"
import { signIn } from "next-auth/react"
import { useSession } from "next-auth/react"

import { registerCustomer } from "@/app/account/actions"
import { sanitizeCallbackUrl, type OAuthProvider } from "@/lib/oauth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AuthPanelProps = {
  callbackUrl?: string
  onAuthenticated?: () => void
  compact?: boolean
  defaultTab?: "signin" | "register"
  oauthEnabled?: boolean
  oauthProviders?: OAuthProvider[]
}

function AuthOAuthSection({
  showGoogle,
  showFacebook,
  onOAuthSignIn,
}: {
  showGoogle: boolean
  showFacebook: boolean
  onOAuthSignIn: (provider: "google" | "facebook") => void
}) {
  if (!showGoogle && !showFacebook) return null

  return (
    <>
      <div
        className={
          showGoogle && showFacebook
            ? "grid gap-2 sm:grid-cols-2"
            : "grid gap-2"
        }
      >
        {showGoogle ? (
          <Button
            type="button"
            variant="outline"
            className="w-full cursor-pointer"
            onClick={() => onOAuthSignIn("google")}
          >
            Continue with Google
          </Button>
        ) : null}
        {showFacebook ? (
          <Button
            type="button"
            variant="outline"
            className="w-full cursor-pointer"
            onClick={() => onOAuthSignIn("facebook")}
          >
            Continue with Facebook
          </Button>
        ) : null}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">or</span>
        </div>
      </div>
    </>
  )
}

export function AuthPanel({
  callbackUrl = "/account",
  onAuthenticated,
  compact = false,
  defaultTab = "signin",
  oauthEnabled = false,
  oauthProviders = [],
}: AuthPanelProps) {
  const destination = sanitizeCallbackUrl(callbackUrl)
  const { data: session, status } = useSession()
  const [signInEmail, setSignInEmail] = React.useState("")
  const [signInPassword, setSignInPassword] = React.useState("")
  const [registerName, setRegisterName] = React.useState("")
  const [registerEmail, setRegisterEmail] = React.useState("")
  const [registerPassword, setRegisterPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const prevStatusRef = React.useRef(status)

  React.useEffect(() => {
    const justAuthenticated =
      status === "authenticated" &&
      !!session?.user &&
      prevStatusRef.current !== "authenticated"

    if (justAuthenticated) {
      onAuthenticated?.()
    }
    prevStatusRef.current = status
  }, [status, session, onAuthenticated])

  if (status === "authenticated" && session?.user) {
    return (
      <div className="rounded-xl border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Signed in as {session.user.name ?? session.user.email}</p>
        <p className="text-muted-foreground mt-1">{session.user.email}</p>
      </div>
    )
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const res = await signIn("credentials", {
      email: signInEmail,
      password: signInPassword,
      redirect: false,
    })
    setPending(false)
    if (res?.error) {
      setError("Invalid email or password")
      return
    }
    window.location.href = destination
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const result = await registerCustomer({
      name: registerName,
      email: registerEmail,
      password: registerPassword,
    })
    if (!result.ok) {
      setError(result.error)
      setPending(false)
      return
    }
    const res = await signIn("credentials", {
      email: registerEmail,
      password: registerPassword,
      redirect: false,
    })
    setPending(false)
    if (res?.error) {
      setError("Account created but sign-in failed. Please sign in manually.")
      return
    }
    window.location.href = destination
  }

  function oauthSignIn(provider: "google" | "facebook") {
    void signIn(provider, { callbackUrl: destination })
  }

  const showGoogle = oauthEnabled && oauthProviders.includes("google")
  const showFacebook = oauthEnabled && oauthProviders.includes("facebook")

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <AuthOAuthSection
        showGoogle={showGoogle}
        showFacebook={showFacebook}
        onOAuthSignIn={oauthSignIn}
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="register">Create account</TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form onSubmit={handleSignIn} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="auth-signin-email">Email</Label>
              <Input
                id="auth-signin-email"
                type="email"
                autoComplete="username"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-signin-password">Password</Label>
              <Input
                id="auth-signin-password"
                type="password"
                autoComplete="current-password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="blue" className="w-full cursor-pointer" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={handleRegister} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="auth-register-name">Full name</Label>
              <Input
                id="auth-register-name"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-register-email">Email</Label>
              <Input
                id="auth-register-email"
                type="email"
                autoComplete="email"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-register-password">Password</Label>
              <Input
                id="auth-register-password"
                type="password"
                autoComplete="new-password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" variant="action" className="w-full cursor-pointer" disabled={pending}>
              {pending ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
