"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { knobsFromProfile } from "@/lib/engagement/knobs";
import { fitBadge, freshnessLabel, type FitBadge } from "@/lib/engagement/present";
import { refreshTargetsForProfile } from "@/server/targeting";
import { revalidatePath } from "next/cache";

export interface EngageItem {
  candidateId: string;
  authorHandle: string;
  post: string;
  url: string;
  score: number;
  reply: string | null;
  scenario: string | null;
  fit: FitBadge;
  freshness: string;
  replies: number;
  draftId: string | null;
}

export async function getEngageQueue(profileId: string): Promise<EngageItem[]> {
  const sb = await supabaseServer();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", profileId).single();
  if (!profile) return [];
  const knobs = knobsFromProfile(profile);

  const { data: cands } = await sb
    .from("candidates")
    .select("id, author_handle, tweet_text, tweet_url, score_composite, metrics_snapshot")
    .eq("profile_id", profileId)
    .eq("status", "surfaced")
    .order("score_composite", { ascending: false })
    .limit(10);

  const now = Date.now();
  const items: EngageItem[] = [];
  for (const c of cands ?? []) {
    const { data: drafts } = await sb
      .from("drafts")
      .select("id, body, engagement_scenario")
      .eq("candidate_id", c.id)
      .eq("kind", "reply")
      .order("created_at", { ascending: false })
      .limit(1);
    const m = (c.metrics_snapshot ?? {}) as { authorFollowers?: number; replies?: number; createdAt?: string };
    items.push({
      candidateId: c.id,
      authorHandle: c.author_handle,
      post: c.tweet_text,
      url: c.tweet_url,
      score: Math.round((c.score_composite ?? 0) * 100),
      reply: drafts?.[0]?.body ?? null,
      scenario: drafts?.[0]?.engagement_scenario ?? null,
      fit: fitBadge(m.authorFollowers ?? 0, knobs.ownerFollowerEstimate),
      freshness: freshnessLabel(m.createdAt ?? new Date(now).toISOString(), now),
      replies: m.replies ?? 0,
      draftId: drafts?.[0]?.id ?? null,
    });
  }
  return items;
}

export async function dismissCandidate(candidateId: string): Promise<void> {
  const sb = await supabaseServer();
  await sb.from("candidates").update({ status: "dismissed" }).eq("id", candidateId);
  revalidatePath("/engage");
}

/** Local-only: re-scan + re-draft (claude). Returns surfaced count. */
export async function scanNow(profileId: string): Promise<number> {
  const n = await refreshTargetsForProfile(profileId);
  revalidatePath("/engage");
  return n;
}
