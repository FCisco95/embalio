import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { runPulse } from "@/server/pulse";

// LOCAL-only: runPulse drafts via `claude`, which can't spawn on Vercel. This
// route is NOT in vercel.json — trigger it from a local launchd job (curl with
// the CRON_SECRET bearer) while `npm run dev` is running.
export const maxDuration = 300;

const PROFILE_ID = process.env.FIXED_PROFILE_ID!;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  try {
    const result = await runPulse(PROFILE_ID);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("pulse failed", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
