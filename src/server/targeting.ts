import { supabaseService } from "@/lib/supabase/server";
import { makeApify, pullTweets, type CandidateInput } from "@/lib/apify";
import { embedText, embedTexts, relevanceFromVectors } from "@/lib/embeddings";
import { compositeScore } from "@/lib/scoring";
import { knobsFromProfile } from "@/lib/engagement/knobs";
import { buildEngagementReplyPrompt } from "@/lib/engagement/reply-craft";
import { buildVoiceSystem } from "@/lib/voice-prompt";
import { generateStructured } from "@/lib/generate";
import { ReplyDraft } from "@/lib/schemas";
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
  ownerFollowerEstimate?: number,
): RankedCandidate[] {
  const scored = cands.map((c) => {
    const ageHours = (Date.now() - new Date(c.metrics_snapshot.createdAt).getTime()) / 3600_000;
    const likesPerHour = c.metrics_snapshot.likes / Math.max(1, ageHours);
    const s = compositeScore({
      relevance: relevanceOf(c),
      likesPerHour,
      ageHours,
      authorFollowers: c.metrics_snapshot.authorFollowers,
      ownerFollowerEstimate,
      replyCount: c.metrics_snapshot.replies,
    });
    return { ...c, score_relevance: s.relevance, score_velocity: s.velocity, score_recency: s.recency, score_composite: s.composite };
  });
  return scored.sort((a, b) => b.score_composite - a.score_composite).slice(0, topN);
}

/**
 * Scan + score: pull tweets → embed → rank → upsert top-N candidates.
 *
 * Cloud-safe — uses only Apify + OpenAI embeddings + pure scoring, no `claude`.
 * This is the unattended cron path: surfaces fresh reply opportunities while the
 * owner's machine is off. Returns the number of candidates surfaced.
 */
export async function scanTargetsForProfile(profileId: string): Promise<number> {
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

  const knobs = knobsFromProfile(profile);
  const ranked = rankCandidates(raw, (c) => relevanceById.get(c.source_tweet_id) ?? 0, TOP_N, knobs.ownerFollowerEstimate);

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

  return ranked.length;
}

/**
 * Pre-draft replies for surfaced-but-undrafted candidates via `claude`.
 *
 * LOCAL-only — depends on `claude -p` and cannot run on Vercel. Generation lives
 * here; the interactive reply queue (`generateReplyQueue`) is the richer on-demand
 * path. Returns the number of new drafts written.
 */
export async function draftRepliesForProfile(profileId: string, limit = TOP_N): Promise<number> {
  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", profileId).single();
  if (!profile) return 0;
  const { data: cands } = await sb.from("candidates")
    .select("id, tweet_text, author_handle").eq("profile_id", profileId).eq("status", "surfaced")
    .order("score_composite", { ascending: false }).limit(limit);

  const knobs = knobsFromProfile(profile);
  const voiceSystem = buildVoiceSystem({
    handle: profile.handle,
    niche_description: profile.niche_description,
    voice_corpus: profile.voice_corpus,
    voice_notes: profile.voice_notes,
  });
  let drafted = 0;
  for (const c of cands ?? []) {
    const { count } = await sb.from("drafts").select("id", { count: "exact", head: true }).eq("candidate_id", c.id);
    if ((count ?? 0) > 0) continue;
    const prompt = buildEngagementReplyPrompt(voiceSystem, { authorHandle: c.author_handle, post: c.tweet_text, reason: "surfaced opportunity" }, knobs);
    const r = await generateStructured(ReplyDraft, prompt);
    if (!r.data || r.data.skip || !r.data.reply) continue;
    await sb.from("drafts").insert({
      profile_id: profileId, kind: "reply", candidate_id: c.id,
      body: r.data.reply, model_used: process.env.GEN_BACKEND ?? "subscription",
      engagement_scenario: r.data.scenario ?? null,
    });
    drafted++;
  }
  return drafted;
}

/** Local full run: scan for opportunities, then pre-draft replies for them. */
export async function refreshTargetsForProfile(profileId: string): Promise<number> {
  const surfaced = await scanTargetsForProfile(profileId);
  if (surfaced > 0) await draftRepliesForProfile(profileId);
  return surfaced;
}

