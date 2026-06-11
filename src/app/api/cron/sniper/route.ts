import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { runSniperPollAll } from "@/server/sniper";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  try {
    const result = await runSniperPollAll();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("sniper poll failed:", err);
    return NextResponse.json({ ok: false, error: String(err).slice(0, 200) }, { status: 500 });
  }
}
