import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { runWeeklyStrategy } from "@/server/strategy";
import { cronAuthError } from "@/lib/cron-auth"; // constant-time Bearer guard; 500 if CRON_SECRET unset

export const maxDuration = 300; // recommendTargets is a multi-minute research call (runner caps at 2×120s)

export async function GET(req: Request) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  const sb = supabaseService();
  const { data } = await sb.from("seed_targets").select("profile_id").eq("active", true);
  const profileIds = [...new Set((data ?? []).map((r) => r.profile_id))];
  const results: Array<{ id: string; ok: boolean }> = [];
  let failed = 0;
  for (const id of profileIds) {
    const r = await runWeeklyStrategy(id);
    results.push({ id, ok: r.ok });
    if (!r.ok) failed++;
  }
  // Total outage → 500 so the cron is visibly failing (mirrors targeting route).
  const allFailed = profileIds.length > 0 && failed === profileIds.length;
  return NextResponse.json({ profiles: profileIds.length, results }, { status: allFailed ? 500 : 200 });
}
