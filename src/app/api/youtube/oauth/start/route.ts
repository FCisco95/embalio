import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "YOUTUBE_CLIENT_ID not set" }, { status: 500 });
  const redirectUri = `${new URL(req.url).origin}/api/youtube/oauth/callback`;
  return NextResponse.redirect(buildAuthUrl({ clientId, redirectUri }));
}
