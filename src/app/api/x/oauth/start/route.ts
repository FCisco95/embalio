import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { assertOwnProfile, requireSessionUser } from "@/server/auth";
import { X_OAUTH_COOKIE, buildXAuthUrl, makePkce } from "@/lib/x-api/oauth";

export const dynamic = "force-dynamic";

/** GET /api/x/oauth/start?profile=<id>: begin the per-profile X OAuth 2.0 PKCE link. */
export async function GET(req: Request) {
  // Outside any try/catch on purpose: an anonymous caller is redirected to /login.
  await requireSessionUser();

  const url = new URL(req.url);
  const profileId = url.searchParams.get("profile");
  if (!profileId) return NextResponse.json({ error: "missing profile" }, { status: 400 });
  try {
    await assertOwnProfile(profileId);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "X_CLIENT_ID not set" }, { status: 500 });

  const redirectUri = `${url.origin}/api/x/oauth/callback`;
  const state = randomBytes(32).toString("hex");
  const { verifier, challenge } = makePkce();

  const res = NextResponse.redirect(buildXAuthUrl({ clientId, redirectUri, state, challenge }));
  // Same shape as the YouTube flow: HttpOnly, scoped to the OAuth routes, 10 minutes.
  // The profile id rides along only to be re-verified against the live session in the callback.
  res.cookies.set(X_OAUTH_COOKIE, JSON.stringify({ state, verifier, profileId }), {
    httpOnly: true,
    sameSite: "lax", // survives the top-level GET redirect back from X
    secure: url.protocol === "https:",
    path: "/api/x/oauth",
    maxAge: 600,
  });
  return res;
}
