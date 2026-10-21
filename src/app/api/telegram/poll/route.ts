import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { supabaseService } from "@/lib/supabase/server";
import { resolveCronProfiles } from "@/server/cron-profiles";
import { drainTelegramUpdates } from "@/server/telegram-poll";

// Cloud-safe getUpdates drain. Hit ~every minute by a local scheduler while
// dogfooding. We never setWebhook (mutually exclusive with getUpdates).
//
// Single-profile on purpose: there is ONE global Telegram bot and the getUpdates
// offset is stored per profile, so draining several profiles per tick would
// re-read the same updates with different offsets and lose or mis-apply taps.
// `?profile=<id>` picks the account; otherwise the oldest one.
export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;

  let profile;
  try {
    [profile] = await resolveCronProfiles(req, supabaseService());
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
  if (!profile) return NextResponse.json({ ok: true, profile: null, applied: 0 });

  const result = await drainTelegramUpdates(profile.id);
  return NextResponse.json({ ok: !result.error, profile: profile.id, ...result }, { status: result.error ? 500 : 200 });
}
