import { NextResponse } from "next/server";
import { exchangeCodeForRefreshToken } from "@/lib/youtube";
import { supabaseService } from "@/lib/supabase/server";
import { getActiveProfile } from "@/server/studio/recording-profiles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
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
  return NextResponse.redirect(`${url.origin}/studio?yt=connected`);
}
