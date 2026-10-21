import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/cron-auth";
import { supabaseService } from "@/lib/supabase/server";
import { assertOwnProfile, requireSessionUser } from "@/server/auth";
import { encryptSecret } from "@/lib/x-api/crypto";
import { X_OAUTH_COOKIE, exchangeCode, fetchMe } from "@/lib/x-api/oauth";

export const dynamic = "force-dynamic";

interface OAuthCookie {
  state: string;
  verifier: string;
  profileId: string;
}

function parseCookie(raw: string | undefined): OAuthCookie | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (typeof v?.state === "string" && typeof v?.verifier === "string" && typeof v?.profileId === "string") return v;
  } catch {
    // fall through
  }
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const redirect = (path: string) => {
    // One-time use: the state cookie is consumed on every terminal outcome.
    const res = NextResponse.redirect(`${url.origin}${path}`);
    res.cookies.set(X_OAUTH_COOKIE, "", { path: "/api/x/oauth", maxAge: 0 });
    return res;
  };

  // CSRF: the state echoed by X must match the cookie minted at /start (constant-time).
  const cookie = parseCookie(req.cookies.get(X_OAUTH_COOKIE)?.value);
  const state = url.searchParams.get("state") ?? "";
  if (!cookie || !state || !safeEqual(state, cookie.state))
    return NextResponse.json({ error: "invalid state" }, { status: 403 });

  if (url.searchParams.get("error")) return redirect("/profiles?x=denied");
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  // The cookie is not trusted for ownership: re-verify against the live session
  // before spending an auth code or the $0.010 user read.
  await requireSessionUser(); // outside the try: an anonymous caller is redirected to /login
  try {
    await assertOwnProfile(cookie.profileId);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let tokens, me;
  try {
    tokens = await exchangeCode({ code, verifier: cookie.verifier, redirectUri: `${url.origin}/api/x/oauth/callback` });
    me = await fetchMe(tokens.access_token);
  } catch (e) {
    console.error("[x-oauth] link failed:", e instanceof Error ? e.message : e);
    return redirect("/profiles?x=error");
  }

  const sb = supabaseService();
  const { error } = await sb.from("x_accounts").upsert(
    {
      profile_id: cookie.profileId,
      x_user_id: me.id,
      x_username: me.username,
      access_token_enc: encryptSecret(tokens.access_token),
      refresh_token_enc: encryptSecret(tokens.refresh_token),
      access_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope,
      needs_reauth: false,
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) {
    // x_user_id is UNIQUE: this X account is already linked to another profile.
    if (error.code === "23505") return redirect(`/profiles?x=already-linked&handle=${encodeURIComponent(me.username)}`);
    // Never echo the database message to the browser; log it server-side.
    console.error("[x-oauth] x_accounts upsert failed:", error.code, error.message);
    return redirect("/profiles?x=error");
  }

  return redirect("/profiles?x=connected");
}
