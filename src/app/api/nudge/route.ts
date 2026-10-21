import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { supabaseService } from "@/lib/supabase/server";
import { resolveCronProfiles } from "@/server/cron-profiles";
import { runNudge } from "@/server/nudge";

// Cloud-safe (no claude). Self-guards on sendHour, so an hourly local trigger
// lands at most one send/day. Not in vercel.json yet — fired by a local scheduler.
export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;

  let profiles;
  try {
    profiles = await resolveCronProfiles(req, supabaseService());
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }

  const results: Array<{ profile: string; sent: boolean; error?: string }> = [];
  for (const p of profiles) {
    results.push({ profile: p.id, ...(await runNudge(p.id)) });
  }
  const ok = results.every((r) => !r.error);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 });
}
