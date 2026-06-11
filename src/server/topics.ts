"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { dispatchTopicRefresh } from "@/lib/topics/dispatch";
import { draftFromTrend } from "@/server/trends";
import type { GatedTrend } from "@/server/credibility";

export type TopicBoardState = "fresh" | "cached" | "briefing" | "stale" | "empty";

export interface TopicRowView {
  id: string;
  topic: string;
  angle: string;
  score: number;
  why: Record<string, unknown>;
  sources: { url: string; title?: string; published_at?: string }[];
  generated_at: string;
}

export interface TopicBoardView {
  state: TopicBoardState;
  generatedAt: string | null;
  topics: TopicRowView[];
}

const TTL_MS = 2 * 3600_000;
const REFRESH_AFTER_MS = 60 * 60_000;
const STALE_WINDOW_MS = 48 * 3600_000;

type RawRow = {
  id: string; topic: string; angle: string | null; score: number | null;
  why: unknown; sources: unknown; generated_at: string | null;
};

function toView(r: RawRow): TopicRowView | null {
  if (!r.generated_at) return null; // no timestamp → no render, hard rule
  return {
    id: r.id,
    topic: r.topic,
    angle: r.angle ?? "",
    score: r.score ?? 0,
    why: (r.why ?? {}) as Record<string, unknown>,
    sources: Array.isArray(r.sources) ? (r.sources as TopicRowView["sources"]) : [],
    generated_at: r.generated_at,
  };
}

/** Latest insert batch only (rows share one generated_at per board write). */
function latestBatch(rows: TopicRowView[]): TopicRowView[] {
  if (rows.length === 0) return rows;
  const newest = rows[0].generated_at;
  return rows.filter((r) => r.generated_at === newest);
}

/**
 * Freshness chain (spec QA #3/#4): fresh <2h → cached + silent background refresh
 * after 60min → today's research_briefings (low-confidence) → ≤48h board with
 * stale banner → labeled empty. Never empty-render, never unlabeled-stale.
 * Read-only against topic_history: phone open NEVER triggers live generation.
 */
export async function getTopicBoard(profileId: string): Promise<TopicBoardView> {
  const sb = await supabaseServer();
  const now = Date.now();

  const { data: freshRaw } = await sb
    .from("topic_history")
    .select("id, topic, angle, score, why, sources, generated_at")
    .eq("profile_id", profileId)
    .eq("status", "fresh")
    .gte("generated_at", new Date(now - TTL_MS).toISOString())
    .order("generated_at", { ascending: false });
  const fresh = latestBatch(((freshRaw ?? []) as RawRow[]).map(toView).filter((r): r is TopicRowView => r !== null));

  if (fresh.length > 0) {
    const ageMs = now - Date.parse(fresh[0].generated_at);
    if (ageMs > REFRESH_AFTER_MS) void dispatchTopicRefresh().catch(() => {});
    return { state: ageMs > REFRESH_AFTER_MS ? "cached" : "fresh", generatedAt: fresh[0].generated_at, topics: fresh };
  }

  const today = new Date(now).toISOString().slice(0, 10);
  const { data: briefing } = await sb
    .from("research_briefings")
    .select("topics, date")
    .eq("profile_id", profileId)
    .eq("date", today)
    .maybeSingle();
  if (briefing && Array.isArray(briefing.topics) && briefing.topics.length > 0) {
    const topics = (briefing.topics as unknown[]).map((t, i) => {
      const obj = typeof t === "string" ? { topic: t } : (t as Record<string, unknown>);
      return {
        id: `briefing-${i}`,
        topic: String(obj.topic ?? obj.title ?? "untitled"),
        angle: String(obj.angle ?? ""),
        score: 0,
        why: {},
        sources: [],
        generated_at: `${today}T00:00:00Z`,
      };
    });
    return { state: "briefing", generatedAt: `${today}T00:00:00Z`, topics };
  }

  const { data: staleRaw } = await sb
    .from("topic_history")
    .select("id, topic, angle, score, why, sources, generated_at")
    .eq("profile_id", profileId)
    .gte("generated_at", new Date(now - STALE_WINDOW_MS).toISOString())
    .order("generated_at", { ascending: false });
  const stale = latestBatch(((staleRaw ?? []) as RawRow[]).map(toView).filter((r): r is TopicRowView => r !== null));
  if (stale.length > 0) return { state: "stale", generatedAt: stale[0].generated_at, topics: stale };

  return { state: "empty", generatedAt: null, topics: [] };
}

/** One-tap Draft this: topic row → existing draftFromTrend → sign-off queue (drafts table). */
export async function draftFromTopicRow(profileId: string, topic: TopicRowView) {
  const gated: GatedTrend = {
    trend: {
      topic: topic.topic,
      why_now: String(topic.why.why_now ?? ""),
      angle: topic.angle,
      source: topic.sources[0]?.url,
    },
    angle: topic.angle,
    reason: String(topic.why.reason ?? ""),
  };
  return draftFromTrend(profileId, gated);
}
