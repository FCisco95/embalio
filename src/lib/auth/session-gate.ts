// Pure routing decisions for the session gate in src/proxy.ts.
//
// Kept free of Next/Supabase imports so the redirect matrix is unit-testable.
// The proxy itself only wires cookies to these decisions.

/** Supabase SSR cookie names: `sb-<project-ref>-auth-token`, optionally chunked `.0`, `.1`, … */
const SESSION_COOKIE = /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i;

export function hasSupabaseSessionCookie(cookieNames: readonly string[]): boolean {
  return cookieNames.some((name) => SESSION_COOKIE.test(name));
}

/** App surfaces that require a signed-in user. Everything else (login, privacy, /api/*) passes through. */
export function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/setup" ||
    pathname.startsWith("/board") ||
    pathname.startsWith("/compose") ||
    pathname.startsWith("/engage") ||
    pathname.startsWith("/performance") ||
    pathname.startsWith("/plan") ||
    pathname.startsWith("/profiles") ||
    pathname.startsWith("/studio") ||
    pathname.startsWith("/topics")
  );
}

/**
 * Where to send the request, given whether the session actually verified.
 * `null` means "let it through". `authenticated` must come from a verified
 * session, NOT from cookie presence: a stale cookie whose refresh token has
 * been consumed must fall through to /login, or /login → / → /login loops.
 */
export function decideSessionRedirect(pathname: string, authenticated: boolean): "/" | "/login" | null {
  if (pathname === "/login") return authenticated ? "/" : null;
  if (isProtectedPath(pathname) && !authenticated) return "/login";
  return null;
}
