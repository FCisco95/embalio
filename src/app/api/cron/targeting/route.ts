import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { scanTargetsForProfile } from "@/server/targeting";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET)
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseService();
  const { data: profiles } = await sb.from("profiles").select("id");
  const results: Record<string, number> = {};
  let failed = 0;
  for (const p of profiles ?? []) {
    // Scan only — drafting needs `claude` and runs locally, not on the cron.
    try { results[p.id] = await scanTargetsForProfile(p.id); }
    catch (e) { results[p.id] = -1; failed++; console.error("targeting failed", p.id, e); }
  }
  // Surface a total outage as 500 so the cron is visibly failing, not silently 200.
  const total = Object.keys(results).length;
  const allFailed = total > 0 && failed === total;
  return NextResponse.json({ ok: !allFailed, results, failed }, { status: allFailed ? 500 : 200 });
}
