import NextAuth from "next-auth"
import { NextResponse } from "next/server"

import { authConfig } from "@/auth.config"

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
      if (!url.searchParams.has("callbackUrl")) {
        url.searchParams.set("callbackUrl", pathname)
      }
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
      if (!url.searchParams.has("callbackUrl")) {
        url.searchParams.set("callbackUrl", pathname)
      }
      return NextResponse.redirect(url)
    }
  }
})

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
}
