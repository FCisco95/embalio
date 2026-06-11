"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { knobsFromProfile } from "@/lib/engagement/knobs";
import { fitBadge, freshnessLabel, isFresh, type FitBadge } from "@/lib/engagement/present";
import { scanTargetsForProfile, draftSingleCandidate } from "@/server/targeting";
import { revalidatePath } from "next/cache";

export interface EngageItem {
  candidateId: string;
  profileId: string;
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
    .limit(50);

  const now = Date.now();
  // Freshness gate: a dead-time queue must never show stale posts. Drop anything
  // outside the window, THEN take the top 10 by score (fetch 50 so fresh-but-
  // lower-score candidates aren't buried under stale high-score ones).
  const fresh = (cands ?? [])
    .filter((c) => isFresh((c.metrics_snapshot as { createdAt?: string } | null)?.createdAt, now))
    .slice(0, 10);
  const items: EngageItem[] = [];
  for (const c of fresh) {
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
      profileId,
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

/**
 * Surface-only scan (Apify + score, NO claude) — fast, fills the queue in ~10s.
 * Drafting is lazy/per-card (`draftReplyFor`) so a scan never blocks on 10
 * sequential claude calls. Returns surfaced count.
 */
export async function scanNow(profileId: string): Promise<number> {
  const n = await scanTargetsForProfile(profileId);
  revalidatePath("/engage");
  return n;
}

/** Draft a reply for ONE card on demand (local claude). Returns the reply text or null. */
export async function draftReplyFor(profileId: string, candidateId: string): Promise<string | null> {
  const reply = await draftSingleCandidate(profileId, candidateId);
  revalidatePath("/engage");
  return reply;
}
