"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { TweetUrl, PostMetrics } from "@/lib/schemas";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";

export async function markPosted(draftId: string, tweetUrl: string) {
  const parsed = TweetUrl.safeParse(tweetUrl);
  if (!parsed.success) throw new Error("Invalid tweet URL");
  const sb = await supabaseServer();
  const { data: draft, error } = await sb.from("drafts").select("*").eq("id", draftId).single();
  if (error || !draft) throw new Error("draft not found");

  const { error: postErr } = await sb.from("posts").insert({
    profile_id: draft.profile_id, draft_id: draft.id, tweet_url: parsed.data,
  });
  if (postErr && postErr.code !== "23505") throw new Error(postErr.message);

  await sb.from("drafts").update({ status: "posted" }).eq("id", draftId);
  if (draft.candidate_id) await sb.from("candidates").update({ status: "engaged" }).eq("id", draft.candidate_id);
  await logActivity(sb, draft.profile_id, draft.kind === "reply" ? "reply_posted" : "post_published", { refId: draftId, meta: { tweet_url: parsed.data } });
  revalidatePath("/performance");
}

export async function listPerformance(profileId: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("posts")
    .select("*, drafts(body, kind, candidate_id)")
    .eq("profile_id", profileId).order("posted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listPendingDrafts(profileId: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("drafts")
    .select("id, body, kind, suggested_visual, status, created_at")
    .eq("profile_id", profileId)
    .in("status", ["draft", "approved"])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Manually record real engagement numbers for a post. This is the single seam
// the X API will later replace — same `posts.metrics` shape, different source.
export async function updatePostMetrics(postId: string, metrics: unknown) {
  const parsed = PostMetrics.safeParse(metrics);
  if (!parsed.success) throw new Error("invalid metrics");
  const sb = await supabaseServer();
  const { error } = await sb.from("posts")
    .update({ metrics: parsed.data, last_scraped_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw new Error(error.message);
  revalidatePath("/performance");
  revalidatePath("/");
}

// Persist a generated post/reply into the sign-off queue (status 'draft').
// Reuses the same insert shape as composeOriginal so it surfaces in pending.
export async function saveDraftToQueue(
  profileId: string,
  input: { kind: "original" | "reply"; body: string; suggested_visual?: string },
) {
  const body = input.body.trim();
  if (!profileId) throw new Error("no profile");
  if (!body) throw new Error("empty draft");
  const sb = await supabaseServer();
  const { data, error } = await sb.from("drafts").insert({
    profile_id: profileId, kind: input.kind, body,
    suggested_visual: input.suggested_visual,
  }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data.id as string;
}

export async function dismissCandidate(candidateId: string) {
  const sb = await supabaseServer();
  const { error } = await sb.from("candidates").update({ status: "dismissed" }).eq("id", candidateId);
  if (error) throw new Error(error.message);
  revalidatePath("/board");
  revalidatePath("/engage");
}

/**
 * One-tap "Done" for the dead-time engage loop: log that a reply was sent WITHOUT
 * requiring its URL. Inserts a reply draft (if not already one) + a URL-less post
 * so the coach's repliesDoneToday count ticks. URL can be backfilled via markPosted
 * later for the metrics loop. See spec §12 (one-tap Done, URL optional).
 */
export async function markRepliedQuick(
  profileId: string,
  input: { draftId?: string; candidateId?: string; reply: string },
): Promise<void> {
  const body = input.reply.trim();
  if (!profileId) throw new Error("no profile");
  if (!body) throw new Error("empty reply");
  const sb = await supabaseServer();

  let draftId = input.draftId;
  if (!draftId) {
    const { data, error } = await sb.from("drafts").insert({
      profile_id: profileId, kind: "reply", body, candidate_id: input.candidateId ?? null,
    }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "draft insert failed");
    draftId = data.id as string;
  }

  const { error: postErr } = await sb.from("posts").insert({
    profile_id: profileId, draft_id: draftId, tweet_url: null,
  });
  if (postErr && postErr.code !== "23505") throw new Error(postErr.message);

  await sb.from("drafts").update({ status: "posted" }).eq("id", draftId);
  if (input.candidateId) await sb.from("candidates").update({ status: "engaged" }).eq("id", input.candidateId);
  await logActivity(sb, profileId, "reply_posted", { refId: draftId, meta: { via: "quick" } });
  revalidatePath("/engage");
  revalidatePath("/");
}
