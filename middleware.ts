// Runs the NextAuth `authorized` callback for matched routes. When it returns
// false, NextAuth redirects to the configured sign-in page (/login) with a
// callbackUrl so the user returns here after signing in.
export { auth as middleware } from "@/auth"

export const config = {
  matcher: ["/admin/:path*"],
}
