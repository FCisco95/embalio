import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { generateStructured } from "@/lib/generate";
import { gateTrend } from "@/lib/credibility/gate";
import { embedTexts, relevanceFromVectors } from "@/lib/embeddings";
import { TopicBoardReport, type TopicCandidate } from "@/lib/schemas";
import { buildTopicBoardPrompt, type WarehouseTweetLine } from "@/lib/voice-prompt";
import { heatForTopic } from "./heat";
import { scoreTopic } from "./score";

const BOARD_TTL_MS = 2 * 3600_000;
const WAREHOUSE_WINDOW_MS = 48 * 3600_000;

function freshestSourceAgeHours(t: TopicCandidate, nowMs: number): number | null {
  const ages = t.sources
    .map((s) => Date.parse(s.published_at))
    .filter((ms) => Number.isFinite(ms))
    .map((ms) => (nowMs - ms) / 3600_000);
  return ages.length > 0 ? Math.min(...ages) : null;
}

async function generateReport(prompt: string): Promise<TopicBoardReport> {
  let r: { data: TopicBoardReport | null };
  try {
    r = await generateStructured(TopicBoardReport, prompt, { research: true, attempts: 3 });
  } catch {
    r = { data: null };
  }
  if (!r.data && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      r = await generateStructured(TopicBoardReport, prompt, { backend: "gemini", attempts: 2 });
    } catch {
      r = { data: null };
    }
  }
  if (!r.data) throw new Error("topic board generation failed (claude + fallback)");
  return r.data;
}

/**
 * Full P2 pipeline: warehouse-grounded generation → credibility gate → embed →
 * heat → score → persist. Worker + local only; the app NEVER calls this on request.
 */
export async function generateTopicBoard(
  sb: SupabaseClient<Database>,
  profileId: string,
): Promise<number> {
  const { data: profile, error } = await sb
    .from("profiles")
    .select("content_pillars, niche_description")
    .eq("id", profileId)
    .single();
  if (error || !profile) throw new Error("profile not found");
  const pillars = (profile.content_pillars ?? []) as string[];
  const niche = (profile.niche_description ?? "") as string;

  const now = Date.now();
  const { data: hot } = await sb
    .from("signal_tweets")
    .select("author_handle, text, url, tweet_created_at")
    .gte("tweet_created_at", new Date(now - WAREHOUSE_WINDOW_MS).toISOString())
    .order("author_followers", { ascending: false })
    .limit(25);
  const warehouseLines: WarehouseTweetLine[] = (hot ?? []).map((t) => ({
    handle: t.author_handle,
    text: t.text,
    url: t.url,
    createdAt: t.tweet_created_at,
  }));

  const date = new Date(now).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const report = await generateReport(buildTopicBoardPrompt(pillars, date, warehouseLines));

  const verdicts = await Promise.all(
    report.topics.map((t) =>
      gateTrend(pillars, niche, { topic: t.topic, why_now: t.why_now, angle: t.angle, source: t.sources[0]?.url }),
    ),
  );
  const kept = report.topics
    .map((t, i) => ({ t, v: verdicts[i] }))
    .filter((x) => x.v.keep);
  if (kept.length === 0) throw new Error("all topics gate-dropped — board not written");

  const vectors = await embedTexts([
    `${niche} ${pillars.join(" ")}`,
    ...kept.map((x) => `${x.t.topic} ${x.t.why_now}`),
  ]);
  const heats = await Promise.all(kept.map((x) => heatForTopic(sb, x.t.topic)));

  const generatedAt = new Date(now).toISOString();
  const rows = kept.map((x, i) => {
    const heat = heats[i];
    const scored = scoreTopic({
      nicheFit01: relevanceFromVectors(vectors[0], vectors[i + 1]),
      heat,
      credibilityKept: true,
      freshestSourceAgeHours: freshestSourceAgeHours(x.t, now),
      kind: x.t.kind,
    });
    return {
      profile_id: profileId,
      topic: x.t.topic,
      angle: x.v.angle || x.t.angle,
      score: scored.score,
      why: {
        ...scored.why,
        window: scored.window,
        kind: x.t.kind,
        why_now: x.t.why_now,
        reason: x.v.reason,
        heat_recent: heat.recent,
        heat_prior: heat.prior,
      } as unknown as Json,
      sources: x.t.sources as unknown as Json,
      generated_at: generatedAt,
      expires_at: new Date(now + BOARD_TTL_MS).toISOString(),
      status: "fresh",
    };
  });

  const { error: expireErr } = await sb
    .from("topic_history")
    .update({ status: "expired" })
    .eq("profile_id", profileId)
    .eq("status", "fresh");
  if (expireErr) throw new Error(expireErr.message);
  const { error: insErr } = await sb.from("topic_history").insert(rows);
  if (insErr) throw new Error(insErr.message);
  return rows.length;
}
