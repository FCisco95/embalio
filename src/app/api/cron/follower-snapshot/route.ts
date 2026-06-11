import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { captureFollowerSnapshot } from "@/server/follower-snapshot";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  const profileId = process.env.FIXED_PROFILE_ID;
  if (!profileId) return NextResponse.json({ ok: false, error: "FIXED_PROFILE_ID unset" }, { status: 500 });
  try {
    const followers = await captureFollowerSnapshot(profileId);
    if (followers === null) {
      return NextResponse.json({ ok: false, error: "no follower count captured" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, followers });
  } catch (err) {
    console.error("follower-snapshot failed:", err);
    return NextResponse.json({ ok: false, error: String(err).slice(0, 200) }, { status: 500 });
  }
}
