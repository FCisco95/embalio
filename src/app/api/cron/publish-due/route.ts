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
const TIME_BUDGET_MS = 45_000;
const STUCK_AFTER_MS = 10 * 60_000;

/**
 * A job still 'running' after 10 minutes means its function was killed mid-publish: the
 * tweet may or may not be live. It must NOT go to 'failed' (that would let the ticker
 * retry and double-post); park it as needs_manual_confirmation and its draft as
 * 'unconfirmed' so it leaves the due query instead of starving it. Best effort: a failure
 * here is logged and never blocks the publish run. Returns how many jobs were reaped.
 */
async function reapStuckJobs(sb: ReturnType<typeof supabaseService>): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
    const { data: stuck, error } = await sb
      .from("posting_jobs")
      .select("id, draft_id")
      .eq("method", "xapi")
      .eq("status", "running")
      .lt("updated_at", cutoff);
    if (error) throw new Error(error.message);
    if (!stuck || stuck.length === 0) return 0;

    const now = new Date().toISOString();
    const { error: jobErr } = await sb
      .from("posting_jobs")
      .update({ status: "needs_manual_confirmation", error: "timed out while running; verify on X before retrying", updated_at: now })
      .in("id", stuck.map((j) => j.id))
      .eq("status", "running"); // a job that finished since the select must not be overwritten
    if (jobErr) throw new Error(jobErr.message);

    const draftIds = stuck.map((j) => j.draft_id).filter((id): id is string => !!id);
    if (draftIds.length > 0) {
      const { error: draftErr } = await sb
        .from("drafts")
        .update({ status: "unconfirmed" })
        .in("id", draftIds)
        .in("status", ["scheduled", "approved"]);
      if (draftErr) throw new Error(draftErr.message);
    }
    return stuck.length;
  } catch (e) {
    console.error("[publish-due] reap failed:", e instanceof Error ? e.message : e);
    return 0;
  }
}

/**
 * Ticker for approved-and-scheduled originals: publishes whatever is due.
 * Trigger is pg_cron (owner-run SQL); `.github/workflows/publish-due.yml` is a
 * manual fallback. Safe to overlap with an inline approve: the
 * `posting_jobs_active_draft_uidx` index in `publishDraft` is the idempotency key.
 */
async function run(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;

  const startedAt = Date.now();
  const sb = supabaseService();
  const reaped = await reapStuckJobs(sb);

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
  let deferred = 0;
  for (const { id } of due ?? []) {
    // The function is killed at maxDuration (60s). Stop starting new publishes with headroom
    // left; the rest are still due and the next tick picks them up.
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      deferred += 1;
      continue;
    }
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
  return NextResponse.json({ ok: true, due: due?.length ?? 0, published, failed, skipped, deferred, reaped, estimatedCostUsd });
}

export const GET = run;
export const POST = run;
