import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import Facebook from "next-auth/providers/facebook"

import { authConfig } from "@/auth.config"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password"

/**
 * Providers whose returned email we trust as verified, so it's safe to link
 * to an existing account by email match. Google exposes `email_verified` on
 * the profile; Facebook's Graph API only ever returns confirmed emails.
 * Without this check, anyone who can create an OAuth account under an
 * unverified/attacker-controlled email would silently take over an existing
 * credentials account with the same address (OAuthAccountNotLinked-style
 * account takeover).
 */
function isEmailVerifiedForLinking(
  provider: string | undefined,
  profile: { email_verified?: boolean | null } | undefined,
): boolean {
  if (provider === "facebook") return true
  if (provider === "google") return profile?.email_verified === true
  return false
}

async function ensureOAuthUser(input: {
  email: string
  name?: string | null
  image?: string | null
  emailVerified: boolean
}) {
  const email = input.email.toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (!input.emailVerified) {
      throw new Error(
        "An account with this email already exists. Sign in with your password instead.",
      )
    }
    return existing
  }

  return prisma.user.create({
    data: {
      email,
      name: input.name,
      image: input.image,
      role: "CUSTOMER",
      emailVerified: input.emailVerified ? new Date() : null,
    },
  })
}

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: async (credentials) => {
      const email = String(credentials?.email ?? "").toLowerCase().trim()
      const password = String(credentials?.password ?? "")
      if (!email || !password) return null

      const user = await prisma.user.findUnique({ where: { email } })
      if (!user?.password) return null
      if (!(await verifyPassword(password, user.password))) return null

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    },
  }),
]

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  )
}

if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
  providers.push(
    Facebook({
      clientId: process.env.AUTH_FACEBOOK_ID,
      clientSecret: process.env.AUTH_FACEBOOK_SECRET,
    }),
  )
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") return true
      if (!user.email) return false

      let dbUser
      try {
        dbUser = await ensureOAuthUser({
          email: user.email,
          name: user.name,
          image: user.image,
          emailVerified: isEmailVerifiedForLinking(account?.provider, profile),
        })
      } catch {
        return false
      }
      user.id = dbUser.id
      user.role = dbUser.role
      return true
    },
  },
})
