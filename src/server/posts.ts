"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { TweetUrl } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

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
    .select("id, body, kind, suggested_visual, created_at")
    .eq("profile_id", profileId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function dismissCandidate(candidateId: string) {
  const sb = await supabaseServer();
  await sb.from("candidates").update({ status: "dismissed" }).eq("id", candidateId);
  revalidatePath("/board");
}
