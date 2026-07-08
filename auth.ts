import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

// NextAuth v5 (Auth.js) configuration.
//
// This uses a Credentials provider with a mock/demo login so the app works
// out-of-the-box without an external identity provider. Swap in a database
// lookup (see the commented Prisma example) and password hashing for real use.
export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
        const password = String(credentials?.password ?? "")

        // --- MOCK AUTH (demo only) -----------------------------------------
        // Any password works for these two demo accounts.
        if (email === "admin@hotel.test" && password.length > 0) {
          return { id: "demo-admin", name: "Hotel Admin", email, role: "ADMIN" }
        }
        if (email === "guest@hotel.test" && password.length > 0) {
          return {
            id: "demo-guest",
            name: "Demo Guest",
            email,
            role: "CUSTOMER",
          }
        }

        // --- REAL AUTH (uncomment and add bcrypt) --------------------------
        // const user = await prisma.user.findUnique({ where: { email } })
        // if (user?.password && (await bcrypt.compare(password, user.password))) {
        //   return { id: user.id, name: user.name, email: user.email, role: user.role }
        // }

        return null
      },
    }),
  ],
  callbacks: {
    // Used by the middleware to gate protected routes. Only ADMIN users may
    // access anything under /admin.
    authorized({ auth, request }) {
      const isAdminRoute = request.nextUrl.pathname.startsWith("/admin")
      if (isAdminRoute) return auth?.user?.role === "ADMIN"
      return true
    },
    // Persist the user's role onto the JWT and expose it on the session.
    jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role ?? "CUSTOMER"
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as string) ?? "CUSTOMER"
      }
      return session
    },
  },
})
