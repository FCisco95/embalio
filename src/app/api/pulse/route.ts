import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { supabaseService } from "@/lib/supabase/server";
import { runPulse } from "@/server/pulse";

// LOCAL-only: runPulse drafts via `claude`, which can't spawn on Vercel. This
// route is NOT in vercel.json — trigger it from a local launchd job (curl with
// the CRON_SECRET bearer) while `npm run dev` is running.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  // ?refresh=0 → deliver-only (skip the Apify/claude scan; just push what's in the DB).
  const refresh = req.nextUrl.searchParams.get("refresh") !== "0";

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

  const results: Array<{ profile: string; ok: boolean; error?: string; surfaced?: number; drafted?: number; sent?: number }> = [];
  for (const id of ids) {
    try {
      results.push({ profile: id, ok: true, ...(await runPulse(id, { refresh })) });
    } catch (e) {
      console.error("pulse failed", id, e);
      results.push({ profile: id, ok: false, error: String(e) });
    }
  }
  const ok = results.every((r) => r.ok);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 });
}
