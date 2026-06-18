import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildAuthUrl, YT_OAUTH_STATE_COOKIE } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "YOUTUBE_CLIENT_ID not set" }, { status: 500 });
  const url = new URL(req.url);
  const redirectUri = `${url.origin}/api/youtube/oauth/callback`;

  // CSRF protection: mint a random state, stash it in an HttpOnly cookie scoped
  // to the OAuth routes, and pass the same value to Google. The callback only
  // honors a code whose echoed state matches this cookie.
  const state = randomBytes(32).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl({ clientId, redirectUri, state }));
  res.cookies.set(YT_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax", // survives the top-level GET redirect back from Google
    secure: url.protocol === "https:",
    path: "/api/youtube/oauth",
    maxAge: 600,
  });
  return res;
}
