import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import { decideSessionRedirect, hasSupabaseSessionCookie } from "@/lib/auth/session-gate"

// Session gate for the app. Two jobs, both load-bearing:
//
// 1. REFRESH. Server Components cannot write cookies (Next throws
//    "Cookies can only be modified in a Server Action or Route Handler"), so
//    once the access token expires (~1h) a page render that refreshes it has
//    nowhere to store the rotated tokens. The proxy is the only per-request
//    hook that can — so it runs the Supabase client over the request/response
//    cookies and lets it refresh here. Pages then read fresh tokens.
//
// 2. VERIFY, don't just look. Deciding on cookie *presence* alone creates a
//    redirect loop the moment a cookie goes stale (refresh token consumed):
//    the layout sends the user to /login, /login sees the cookie and sends
//    them back to /. Decisions below use the verified result, and a dead
//    session gets its cookies cleared on the way through.
//
// Bearer-authenticated API routes (/api/pulse, /api/nudge, /api/telegram/*)
// carry no session cookie and take the cheap path: no Supabase client at all.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const cookieNames = req.cookies.getAll().map((c) => c.name)

  if (!hasSupabaseSessionCookie(cookieNames)) {
    const target = decideSessionRedirect(pathname, false)
    return target ? NextResponse.redirect(new URL(target, req.url)) : NextResponse.next()
  }

  let res = NextResponse.next({ request: req })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => {
          // Mutate the request so downstream Server Components see refreshed
          // tokens, then rebuild the response and set them for the browser.
          toSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    },
  )

  // getClaims() verifies the JWT (locally against JWKS when the project uses
  // asymmetric keys, else via /auth/v1/user) and refreshes an expired session
  // through the cookie adapter above. Any failure → treat as signed out.
  let authenticated = false
  try {
    const { data, error } = await supabase.auth.getClaims()
    authenticated = !error && Boolean(data?.claims?.sub)
  } catch {
    authenticated = false
  }

  const target = decideSessionRedirect(pathname, authenticated)
  if (!target) return res

  // Carry refreshed (or cleared) cookies onto the redirect, or the browser
  // keeps the stale ones and we are back where we started.
  const redirect = NextResponse.redirect(new URL(target, req.url))
  res.cookies.getAll().forEach((c) => redirect.cookies.set(c))
  return redirect
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron/).*)"],
}
