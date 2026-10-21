import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { supabaseService } from "@/lib/supabase/server";
import { runNudge } from "@/server/nudge";

// Cloud-safe (no claude). Self-guards on sendHour, so an hourly local trigger
// lands at most one send/day. Not in vercel.json yet — fired by a local scheduler.
export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;

  // No session here, so profiles come from the service client: ?profile=<id>
  // for one account, otherwise every account.
  const only = req.nextUrl.searchParams.get("profile");
  let ids: string[];
  if (only) {
    ids = [only];
  } else {
    const { data, error } = await supabaseService().from("profiles").select("id").order("created_at");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    ids = (data ?? []).map((p) => p.id);
  }

  const results: Array<{ profile: string; sent: boolean; error?: string }> = [];
  for (const id of ids) {
    results.push({ profile: id, ...(await runNudge(id)) });
  }
  const ok = results.every((r) => !r.error);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 });
}
