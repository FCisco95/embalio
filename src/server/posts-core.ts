import "server-only";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Plain module (NOT a Server Action file): these take a client, so they must not be callable as
// Server Actions. src/server/posts.ts wraps them with the cookie-bound (RLS) client;
// src/server/telegram-poll.ts (cron, no session) passes the service client after scoping
// the candidate lookup to its profile.

export async function dismissCandidateCore(sb: SupabaseClient<Database>, candidateId: string): Promise<void> {
  const { error } = await sb.from("candidates").update({ status: "dismissed" }).eq("id", candidateId);
  if (error) throw new Error(error.message);
  revalidatePath("/board");
  revalidatePath("/engage");
}

/**
 * One-tap "Done" for the dead-time engage loop: log that a reply was sent WITHOUT
 * requiring its URL. Inserts a reply draft (if not already one) + a URL-less post
 * so the coach's repliesDoneToday count ticks. URL can be backfilled via markPosted
 * later for the metrics loop. See spec section 12 (one-tap Done, URL optional).
 */
export async function markRepliedQuickCore(
  sb: SupabaseClient<Database>,
  profileId: string,
  input: { draftId?: string; candidateId?: string; reply: string },
): Promise<void> {
  const body = input.reply.trim();
  if (!profileId) throw new Error("no profile");
  if (!body) throw new Error("empty reply");

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
