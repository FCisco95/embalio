import { supabaseService } from "@/lib/supabase/server";
import { makeApify, pullTweets, type CandidateInput } from "@/lib/apify";
import { embedText, embedTexts, relevanceFromVectors } from "@/lib/embeddings";
import { compositeScore } from "@/lib/scoring";
import { draftReply } from "@/lib/drafting";
import type { Json } from "@/lib/supabase/types";

const TOP_N = 10;
const MAX_PER_HANDLE = 20;

export interface RankedCandidate extends CandidateInput {
  score_relevance: number;
  score_velocity: number;
  score_recency: number;
  score_composite: number;
}

// pure: score + sort + slice. relevanceOf injected for testability.
export function rankCandidates(
  cands: CandidateInput[],
  relevanceOf: (c: CandidateInput) => number,
  topN: number,
): RankedCandidate[] {
  const scored = cands.map((c) => {
    const ageHours = (Date.now() - new Date(c.metrics_snapshot.createdAt).getTime()) / 3600_000;
    const likesPerHour = c.metrics_snapshot.likes / Math.max(1, ageHours);
    const s = compositeScore({ relevance: relevanceOf(c), likesPerHour, ageHours });
    return { ...c, score_relevance: s.relevance, score_velocity: s.velocity, score_recency: s.recency, score_composite: s.composite };
  });
  return scored.sort((a, b) => b.score_composite - a.score_composite).slice(0, topN);
}

// orchestration: pull → embed → rank → store candidates → draft replies for top N
export async function refreshTargetsForProfile(profileId: string): Promise<number> {
  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", profileId).single();
  if (!profile) return 0;
  const { data: targets } = await sb.from("seed_targets")
    .select("handle").eq("profile_id", profileId).eq("active", true).not("handle", "is", null);
  const handles = (targets ?? []).map((t) => t.handle!).filter(Boolean);
  if (handles.length === 0) return 0;

  const raw = await pullTweets(makeApify(), process.env.APIFY_TWEET_SCRAPER_ACTOR!, { handles, maxPerHandle: MAX_PER_HANDLE });
  if (raw.length === 0) return 0;

  const voiceVec = await embedText([profile.niche_description, ...profile.voice_corpus].filter(Boolean).join(" "));
  const tweetVecs = await embedTexts(raw.map((r) => r.tweet_text));
  const relevanceById = new Map(raw.map((r, i) => [r.source_tweet_id, relevanceFromVectors(voiceVec, tweetVecs[i])]));

  const ranked = rankCandidates(raw, (c) => relevanceById.get(c.source_tweet_id) ?? 0, TOP_N);

  await sb.from("candidates").upsert(
    ranked.map((c) => ({
      profile_id: profileId, source_tweet_id: c.source_tweet_id, author_handle: c.author_handle,
      tweet_text: c.tweet_text, tweet_url: c.tweet_url,
      metrics_snapshot: c.metrics_snapshot as unknown as Json,
      score_relevance: c.score_relevance, score_velocity: c.score_velocity,
      score_recency: c.score_recency, score_composite: c.score_composite, status: "surfaced",
    })),
    { onConflict: "profile_id,source_tweet_id", ignoreDuplicates: true },
  );

  for (const c of ranked) {
    const { data: cand } = await sb.from("candidates").select("id")
      .eq("profile_id", profileId).eq("source_tweet_id", c.source_tweet_id).single();
    if (!cand) continue;
    const { count } = await sb.from("drafts").select("id", { count: "exact", head: true }).eq("candidate_id", cand.id);
    if ((count ?? 0) > 0) continue;
    const voiceProfile = {
      handle: profile.handle,
      niche_description: profile.niche_description,
      voice_corpus: profile.voice_corpus,
      voice_notes: profile.voice_notes,
    };
    const d = await draftReply(voiceProfile, c.tweet_text);
    await sb.from("drafts").insert({
      profile_id: profileId, kind: "reply", candidate_id: cand.id,
      body: d.body, suggested_visual: d.suggestedVisual, model_used: d.model_used,
    });
  }
  return ranked.length;
}
