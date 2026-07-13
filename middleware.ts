import NextAuth from "next-auth"
import { NextResponse } from "next/server"

import { authConfig } from "@/auth.config"
import { sanitizeCallbackUrl } from "@/lib/oauth"

const { auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    authorized() {
      return true
    },
  },
})

export default auth((req) => {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/admin")) {
    if (req.auth?.user?.role !== "ADMIN") {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      const raw = url.searchParams.get("callbackUrl")
      url.searchParams.set("callbackUrl", raw ? sanitizeCallbackUrl(raw) : pathname)
      return NextResponse.redirect(url)
    }
    return
  }

  if (pathname.startsWith("/account")) {
    if (pathname === "/account/login" || pathname === "/account/register") {
      return
    }
    if (!req.auth?.user) {
      const url = req.nextUrl.clone()
      url.pathname = "/account/login"
      const raw = url.searchParams.get("callbackUrl")
      url.searchParams.set("callbackUrl", raw ? sanitizeCallbackUrl(raw) : pathname)
      return NextResponse.redirect(url)
    }
  }
})

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
}
