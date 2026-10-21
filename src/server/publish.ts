import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { logActivity } from "@/lib/activity";
import { bodyHasUrl } from "@/lib/posting/link-rule";
import { getXClientForProfile } from "@/lib/x-api/client";
import type { XClient } from "@/lib/x-api/types";

// Plain module (no "use server"): called by the queue Server Action (inline fast
// path), by the publish-due cron route and importable from scripts. Service role
// on purpose: the cron has no session, and ownership was already proven by the
// caller (RLS read in `approveAndSchedule`).

export type PublishResult =
  | { ok: true; url: string; linkUrl?: string }
  | { ok: false; reason: string };

type XFor = (profileId: string, sb: SupabaseClient<Database>) => Promise<XClient>;

/** After this many failed jobs the draft drops back to 'approved' so the ticker stops retrying. */
const MAX_FAILED_ATTEMPTS = 3;

/**
 * Publish one approved/scheduled ORIGINAL through the profile's own X OAuth.
 * Mirrors `postDraft` in src/server/posting.ts step for step; the partial unique
 * index `posting_jobs_active_draft_uidx` is the idempotency key, so the cron
 * ticker and an inline approve can race safely.
 */
export async function publishDraft(
  draftId: string,
  sb: SupabaseClient<Database> = supabaseService(),
  xFor: XFor = getXClientForProfile,
): Promise<PublishResult> {
  const { data: draft, error } = await sb.from("drafts").select("*").eq("id", draftId).maybeSingle();
  if (error) return { ok: false, reason: error.message };
  if (!draft) return { ok: false, reason: "draft not found" };

  if (draft.status !== "approved" && draft.status !== "scheduled")
    return { ok: false, reason: `draft status is ${draft.status}, expected approved or scheduled` };

  /**
   * Refuse before any job exists. A SCHEDULED draft must also leave the due query, or it is
   * re-selected every minute and (oldest-first, limit 10) can starve the rest: move it back to
   * approved and record why as a failed job, which the queue UI reads as `last_error`.
   */
  const refuse = async (reason: string): Promise<PublishResult> => {
    if (draft.status === "scheduled") {
      const { error: jErr } = await sb
        .from("posting_jobs")
        .insert({ profile_id: draft.profile_id, draft_id: draft.id, method: "xapi", status: "failed", attempts: 1, error: reason });
      if (jErr) console.error("[publish] could not record refusal:", jErr.message);
      const { error: dErr } = await sb.from("drafts").update({ status: "approved" }).eq("id", draft.id);
      if (dErr) console.error("[publish] could not bounce draft to approved:", dErr.message);
    }
    return { ok: false, reason };
  };

  // ToS: replies are sent by the human in X's own composer, never through the API.
  if (draft.kind === "reply") return refuse("reply drafts are manual-send only");
  if (!draft.body || !draft.body.trim()) return refuse("draft body is empty");
  // Reach rule: a URL never rides in the main body (approveAndSchedule lifts it into link_url).
  if (bodyHasUrl(draft.body)) return refuse("body contains a URL; it must go in the link reply");

  const { data: job, error: jobErr } = await sb
    .from("posting_jobs")
    .insert({ profile_id: draft.profile_id, draft_id: draft.id, method: "xapi", status: "running", attempts: 1 })
    .select()
    .single();
  if (jobErr) {
    if (jobErr.code !== "23505") return { ok: false, reason: jobErr.message };
    // A needs_manual_confirmation job will block this draft forever; if it is still 'scheduled'
    // (the earlier park failed) take it out of the due query. A 'running' job is a genuine
    // concurrent publish: leave it alone.
    if (draft.status === "scheduled") {
      const { data: active } = await sb
        .from("posting_jobs")
        .select("status")
        .eq("draft_id", draft.id)
        .eq("status", "needs_manual_confirmation")
        .limit(1)
        .maybeSingle();
      if (active?.status === "needs_manual_confirmation") {
        const { error: pErr } = await sb.from("drafts").update({ status: "unconfirmed" }).eq("id", draft.id);
        if (pErr) console.error("[publish] could not park unconfirmed draft:", pErr.message);
      }
    }
    return { ok: false, reason: "already in progress or posted" };
  }
  if (!job) return { ok: false, reason: "failed to create posting_job" };

  const setJob = (patch: Database["public"]["Tables"]["posting_jobs"]["Update"]) =>
    sb.from("posting_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", job.id);

  // Distinguishes "tweet never sent: safe to retry" from "tweet live but our state
  // sync failed: must not retry, needs manual reconciliation".
  let tweetSent = false;
  let draftPosted = false;
  try {
    const x = await xFor(draft.profile_id, sb);
    const main = await x.createTweet({ text: draft.body });
    tweetSent = true;
    const url = `https://x.com/${x.username}/status/${main.id}`;

    const { error: postErr } = await sb.from("posts").insert({
      profile_id: draft.profile_id,
      draft_id: draft.id,
      tweet_url: url,
      tweet_id: main.id,
    });
    if (postErr && postErr.code !== "23505") throw new Error(postErr.message);

    const { error: draftErr } = await sb.from("drafts").update({ status: "posted" }).eq("id", draft.id);
    if (draftErr) throw new Error(draftErr.message);
    draftPosted = true;

    if (draft.candidate_id) {
      const { error: candErr } = await sb.from("candidates").update({ status: "engaged" }).eq("id", draft.candidate_id);
      if (candErr) throw new Error(candErr.message);
    }

    await logActivity(sb, draft.profile_id, "post_published", {
      refId: draft.id,
      meta: { tweet_url: url, via: "xapi" },
    });

    // Reply 1 carries the link ($0.200). Its failure must never undo or fail the live main post.
    let linkUrl: string | undefined;
    let linkFailed = false;
    if (draft.link_url) {
      try {
        const reply = await x.createTweet({
          text: draft.link_url,
          reply: { in_reply_to_tweet_id: main.id },
        });
        linkUrl = `https://x.com/${x.username}/status/${reply.id}`;
        await sb.from("posts").update({ link_tweet_url: linkUrl }).eq("profile_id", draft.profile_id).eq("tweet_id", main.id);
      } catch (e) {
        linkFailed = true;
        console.error("[publish] link reply failed:", e instanceof Error ? e.message : e);
      }
    }

    const { error: jobSuccErr } = await setJob({
      status: "succeeded",
      result_url: url,
      reply_result_url: linkUrl ?? null,
      error: linkFailed ? "link reply failed" : null,
    });
    if (jobSuccErr) throw new Error(jobSuccErr.message);

    return linkUrl ? { ok: true, url, linkUrl } : { ok: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // needs_manual_confirmation (not failed) keeps the idempotency index blocking auto-retry.
    await setJob({ status: tweetSent ? "needs_manual_confirmation" : "failed", error: msg });

    if (tweetSent) {
      // Park the draft so the ticker's due-selection stops returning it every minute
      // (unless it was already marked posted: then the draft row is already correct).
      if (!draftPosted) {
        const { error: pErr } = await sb.from("drafts").update({ status: "unconfirmed" }).eq("id", draft.id);
        // If this fails the 23505 branch above parks it on the next tick.
        if (pErr) console.error("[publish] could not park unconfirmed draft:", pErr.message);
      }
    } else {
      const { count } = await sb
        .from("posting_jobs")
        .select("id", { count: "exact", head: true })
        .eq("draft_id", draft.id)
        .eq("status", "failed");
      if ((count ?? 0) >= MAX_FAILED_ATTEMPTS) {
        await sb.from("drafts").update({ status: "approved" }).eq("id", draft.id);
      }
    }
    return { ok: false, reason: msg };
  }
}
