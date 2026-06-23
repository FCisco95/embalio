"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { postTweetViaAdsPower } from "@/lib/posting/x-poster";
import { isConfirmedTweetUrl } from "@/lib/posting/outcome";
import { revalidatePath } from "next/cache";

export async function getPostingAccount(profileId: string) {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("posting_accounts")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  return data;
}

export async function setPostingAccount(
  profileId: string,
  adspowerUserId: string,
) {
  const sb = await supabaseServer();
  // RLS ensures the caller owns profileId.
  const { error } = await sb
    .from("posting_accounts")
    .upsert(
      { profile_id: profileId, adspower_user_id: adspowerUserId, active: true },
      { onConflict: "profile_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/profiles");
}

export async function approveDraft(draftId: string) {
  const sb = await supabaseServer();
  // RLS-scoped: only the owner's draft is visible.
  const { data: draft, error } = await sb
    .from("drafts")
    .select("id, status")
    .eq("id", draftId)
    .single();
  if (error || !draft) throw new Error("draft not found");
  if (draft.status === "posted") throw new Error("draft already posted");
  const { error: updErr } = await sb
    .from("drafts")
    .update({ status: "approved" })
    .eq("id", draftId);
  if (updErr) throw new Error(updErr.message);
  return { ok: true as const };
}

export async function postDraft(draftId: string) {
  const sb = await supabaseServer();
  // RLS-scoped: only the owner's draft is visible.
  const { data: draft, error } = await sb
    .from("drafts")
    .select("*")
    .eq("id", draftId)
    .single();
  if (error || !draft) throw new Error("draft not found");
  // Idempotency: never re-post a draft that already went out.
  if (draft.status === "posted") throw new Error("draft already posted");
  // Human approval gate: injected/garbled content must be explicitly approved
  // before it can reach X. A draft is only postable once approveDraft() ran.
  if (draft.status !== "approved") throw new Error("draft must be approved before posting");
  // ToS: replies are sent by the human in X's own UI. Embalio never posts a reply
  // via automation. Studio originals (kind != 'reply') are unaffected (follow-up).
  if (draft.kind === "reply") {
    throw new Error("reply drafts are manual-send only — open the X composer and post by hand");
  }
  // Never paste an empty body into the X composer.
  if (!draft.body || !draft.body.trim()) throw new Error("draft body is empty");

  const { data: account } = await sb
    .from("posting_accounts")
    .select("*")
    .eq("profile_id", draft.profile_id)
    .eq("active", true)
    .maybeSingle();
  if (!account) throw new Error("AdsPower posting not configured for this profile");

  // The partial unique index on posting_jobs(draft_id) where status in
  // ('running','succeeded') rejects a concurrent/duplicate attempt here.
  const { data: job, error: jobErr } = await sb
    .from("posting_jobs")
    .insert({
      profile_id: draft.profile_id,
      draft_id: draft.id,
      method: "adspower",
      status: "running",
      attempts: 1,
    })
    .select()
    .single();
  if (jobErr) throw new Error(jobErr.code === "23505" ? "a post for this draft is already in progress" : jobErr.message);
  if (!job) throw new Error("failed to create posting_job");

  // Track whether AdsPower executed the post so the catch block can distinguish
  // "tweet never sent → safe to retry" from "tweet live but state sync failed →
  // must not retry, needs manual reconciliation".
  let tweetSent = false;
  try {
    const { url } = await postTweetViaAdsPower(
      account.adspower_user_id,
      draft.body,
    );
    tweetSent = true;
    if (isConfirmedTweetUrl(url)) {
      const { error: postErr } = await sb.from("posts").insert({
        profile_id: draft.profile_id,
        draft_id: draft.id,
        tweet_url: url,
      });
      if (postErr && postErr.code !== "23505") throw new Error(postErr.message);

      const { error: draftErr } = await sb
        .from("drafts")
        .update({ status: "posted" })
        .eq("id", draft.id);
      if (draftErr) throw new Error(draftErr.message);

      if (draft.candidate_id) {
        const { error: candErr } = await sb
          .from("candidates")
          .update({ status: "engaged" })
          .eq("id", draft.candidate_id);
        if (candErr) throw new Error(candErr.message);
      }

      const { error: jobSuccErr } = await sb
        .from("posting_jobs")
        .update({
          status: "succeeded",
          result_url: url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      if (jobSuccErr) throw new Error(jobSuccErr.message);

      revalidatePath("/performance");
      return { ok: true as const, url };
    }
    // Posted action ran but we couldn't capture a confirmed tweet URL.
    // Use needs_manual_confirmation (not failed) so the idempotency index blocks
    // auto-retry until the operator reconciles the outcome manually.
    await sb
      .from("posting_jobs")
      .update({
        status: "needs_manual_confirmation",
        error: "could not confirm posted tweet URL",
        result_url: url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { ok: false as const, error: "could not confirm posted tweet URL", url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // If AdsPower already fired, the tweet may be live — use needs_manual_confirmation
    // so the idempotency index blocks auto-retry and forces manual reconciliation.
    // If AdsPower never ran, 'failed' is correct and safe to retry.
    const catchStatus = tweetSent ? "needs_manual_confirmation" : "failed";
    await sb
      .from("posting_jobs")
      .update({ status: catchStatus, error: msg, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    throw new Error(msg);
  }
}
