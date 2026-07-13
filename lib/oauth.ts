export type OAuthProvider = "google" | "facebook"

/** OAuth providers configured with both client id and secret (matches auth.ts). */
export function getOAuthProviders(): OAuthProvider[] {
  const providers: OAuthProvider[] = []
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push("google")
  }
  if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
    providers.push("facebook")
  }
  return providers
}

export function isOAuthEnabled(): boolean {
  return getOAuthProviders().length > 0
}

/**
 * Only allow same-origin relative paths as a post-auth redirect target.
 * Rejects absolute URLs, protocol-relative ("//evil.com"), and backslash
 * tricks browsers normalize to protocol-relative — all open-redirect vectors
 * since this is fed by an attacker-controllable `callbackUrl` query param.
 */
export function sanitizeCallbackUrl(raw: string | undefined | null): string {
  if (!raw) return "/account"
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/account"
  }
  if (raw.includes("://")) return "/account"
  return raw
}
