import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getOAuthProviders, isOAuthEnabled, sanitizeCallbackUrl } from "@/lib/oauth"
import type { OAuthProvider } from "@/lib/oauth"

export async function resolveAuthPageRedirect(rawCallbackUrl?: string): Promise<{
  destination: string
  oauthProviders: OAuthProvider[]
  oauthEnabled: boolean
}> {
  const session = await auth()
  const destination = sanitizeCallbackUrl(rawCallbackUrl)
  const oauthProviders = getOAuthProviders()
  const oauthEnabled = isOAuthEnabled()

  if (session?.user) {
    redirect(session.user.role === "ADMIN" ? "/admin" : destination)
  }

  return { destination, oauthProviders, oauthEnabled }
}
