import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";

// Exchanges the PKCE code (or magic-link token) for a session cookie, then
// redirects into the app. Must stay outside the auth gate in middleware.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const rawNext = req.nextUrl.searchParams.get("next") ?? "/board";
  // Same-origin paths only — reject absolute URLs / protocol-relative to avoid an open redirect.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/board";
  if (code) {
    const sb = supabaseService();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url));
    }
  }
  return NextResponse.redirect(new URL(next, req.url));
}
