import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { supabaseService } from "@/lib/supabase/server";
import { drainTelegramUpdates } from "@/server/telegram-poll";

// Cloud-safe getUpdates drain. Hit ~every minute by a local scheduler while
// dogfooding. We never setWebhook (mutually exclusive with getUpdates).
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

  const results: Array<{ profile: string; applied: number; error?: string }> = [];
  for (const id of ids) {
    results.push({ profile: id, ...(await drainTelegramUpdates(id)) });
  }
  const ok = results.every((r) => !r.error);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 });
}
