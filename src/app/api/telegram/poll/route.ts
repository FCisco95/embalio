import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { drainTelegramUpdates } from "@/server/telegram-poll";

// Cloud-safe getUpdates drain. Hit ~every minute by a local scheduler while
// dogfooding. We never setWebhook (mutually exclusive with getUpdates).
const PROFILE_ID = process.env.FIXED_PROFILE_ID!;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  const result = await drainTelegramUpdates(PROFILE_ID);
  return NextResponse.json({ ok: !result.error, ...result });
}
