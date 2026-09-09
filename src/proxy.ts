import { type NextRequest, NextResponse } from "next/server"

function hasSupabaseSessionCookie(req: NextRequest): boolean {
  return req.cookies
    .getAll()
    .some((cookie) => /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(cookie.name))
}

function isProtectedPath(pathname: string): boolean {
  return pathname === "/setup" || pathname === "/" || pathname.startsWith("/board") || pathname.startsWith("/compose") ||
    pathname.startsWith("/engage") || pathname.startsWith("/performance") || pathname.startsWith("/plan") ||
    pathname.startsWith("/profiles") || pathname.startsWith("/studio") || pathname.startsWith("/topics")
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasSession = hasSupabaseSessionCookie(req)

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  if (isProtectedPath(pathname) && !hasSession) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron/).*)"],
}
