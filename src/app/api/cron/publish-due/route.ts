import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { supabaseService } from "@/lib/supabase/server";
import { getXClientForProfile } from "@/lib/x-api/client";
import type { XClient } from "@/lib/x-api/types";
import { publishDraft } from "@/server/publish";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BATCH = 10;
const ALREADY_HANDLED = "already in progress or posted";

/**
 * Ticker for approved-and-scheduled originals: publishes whatever is due.
 * Trigger is pg_cron (owner-run SQL); `.github/workflows/publish-due.yml` is a
 * manual fallback. Safe to overlap with an inline approve: the
 * `posting_jobs_active_draft_uidx` index in `publishDraft` is the idempotency key.
 */
async function run(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;

  const sb = supabaseService();
  const { data: due, error } = await sb
    .from("drafts")
    .select("id")
    .eq("status", "scheduled")
    .eq("kind", "original")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    console.error("[publish-due] due query failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message.slice(0, 200) }, { status: 500 });
  }

  // Collect the clients publishDraft resolves so we can report the run's X spend.
  const clients: XClient[] = [];
  const xFor = async (profileId: string, client: typeof sb) => {
    const x = await getXClientForProfile(profileId, client);
    clients.push(x);
    return x;
  };

  let published = 0;
  let failed = 0;
  let skipped = 0;
  for (const { id } of due ?? []) {
    try {
      const out = await publishDraft(id, sb, xFor);
      if (out.ok) published += 1;
      else if (out.reason === ALREADY_HANDLED) skipped += 1;
      else failed += 1;
    } catch (e) {
      failed += 1;
      console.error(`[publish-due] draft ${id}:`, e instanceof Error ? e.message : e);
    }
  }

  const estimatedCostUsd = clients.reduce((sum, c) => sum + c.estimatedCostUsd, 0);
  return NextResponse.json({ ok: true, due: due?.length ?? 0, published, failed, skipped, estimatedCostUsd });
}

export const GET = run;
export const POST = run;
