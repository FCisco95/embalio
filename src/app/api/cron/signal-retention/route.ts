import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { supabaseService } from "@/lib/supabase/server";
import { purgeExpiredSignals } from "@/lib/signals/retention";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  const sb = supabaseService();
  try {
    const { deleted, cutoff } = await purgeExpiredSignals(sb);
    return NextResponse.json({ ok: true, deleted, cutoff }, { status: 200 });
  } catch (err) {
    console.error("[signal-retention]", err);
    return NextResponse.json({ ok: false, error: String(err).slice(0, 200) }, { status: 500 });
  }
}
