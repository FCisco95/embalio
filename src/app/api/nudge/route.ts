import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { runNudge } from "@/server/nudge";

// Cloud-safe (no claude). Self-guards on sendHour, so an hourly local trigger
// lands at most one send/day. Not in vercel.json yet — fired by a local scheduler.
const PROFILE_ID = process.env.FIXED_PROFILE_ID!;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  const result = await runNudge(PROFILE_ID);
  return NextResponse.json({ ok: !result.error, ...result });
}
