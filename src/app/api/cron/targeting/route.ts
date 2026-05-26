import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { refreshTargetsForProfile } from "@/server/targeting";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET)
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseService();
  const { data: profiles } = await sb.from("profiles").select("id");
  const results: Record<string, number> = {};
  for (const p of profiles ?? []) {
    try { results[p.id] = await refreshTargetsForProfile(p.id); }
    catch (e) { results[p.id] = -1; console.error("targeting failed", p.id, e); }
  }
  return NextResponse.json({ ok: true, results });
}
