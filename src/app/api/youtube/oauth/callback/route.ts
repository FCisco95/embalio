import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { exchangeCodeForRefreshToken, YT_OAUTH_STATE_COOKIE } from "@/lib/youtube";
import { supabaseService } from "@/lib/supabase/server";
import { getActiveProfile } from "@/server/studio/recording-profiles";

export const dynamic = "force-dynamic";

// Constant-time compare so a mismatched state can't be probed byte-by-byte.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  // CSRF check: the state echoed by Google must match the cookie set at /start.
  const state = url.searchParams.get("state") ?? "";
  const cookieState = req.cookies.get(YT_OAUTH_STATE_COOKIE)?.value ?? "";
  if (!state || !cookieState || !safeEqual(state, cookieState))
    return NextResponse.json({ error: "invalid state" }, { status: 403 });

  const redirectUri = `${url.origin}/api/youtube/oauth/callback`;
  const { refreshToken, scope } = await exchangeCodeForRefreshToken(code, redirectUri);
  const profile = await getActiveProfile();
  const sb = supabaseService();
  const { error } = await sb.from("youtube_credentials").upsert(
    {
      profile_id: profile.id,
      refresh_token: refreshToken,
      scope: scope ?? null,
      obtained_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // One-time use: clear the state cookie now that it's been consumed.
  const res = NextResponse.redirect(`${url.origin}/studio?yt=connected`);
  res.cookies.set(YT_OAUTH_STATE_COOKIE, "", { path: "/api/youtube/oauth", maxAge: 0 });
  return res;
}
