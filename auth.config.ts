import type { NextAuthConfig } from "next-auth"

/**
 * Edge-compatible Auth.js config for middleware.
 * Do not import Prisma or other Node-only modules here.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized() {
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.role = user.role ?? "CUSTOMER"
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = (token.role as string) ?? "CUSTOMER"
      }
      return session
    },
  },
} satisfies NextAuthConfig
