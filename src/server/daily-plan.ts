import { supabaseService } from "@/lib/supabase/server";
import { getDailyAssignment } from "@/server/coach";
import { getTopicBoard } from "@/server/topics";
import { buildDailyPlan, type DailyPlanItem } from "@/lib/coach/daily-plan";

export interface DailyPlanView {
  items: DailyPlanItem[];
}

/** Match GATE-2's scorecard window (gate.ts) — older un-outcomed alerts no longer feed it, so don't nag. */
const OUTCOME_WINDOW_DAYS = 45;

/**
 * Aggregation for the home checklist: existing assignment + topic board reads
 * (the board read may kick off its own background refresh), plus two tiny
 * selects (pending outcome count, newest analytics date). Writes nothing
 * itself; no new tables, no P4/P6 touch.
 */
export async function getDailyPlan(profileId: string): Promise<DailyPlanView> {
  const sb = supabaseService();
  const outcomeCutoff = new Date(Date.now() - OUTCOME_WINDOW_DAYS * 86_400_000).toISOString();

  // The three reads below are independent; the assignment then reuses the topic
  // board's top pick as its angle. That keeps live trend research (two LLM
  // calls) OFF the home-page request path — it was the dominant cost in an ~8s
  // render. One extra serial DB read is a fair trade.
  const [boardResult, pendingResult, analyticsResult] = await Promise.all([
    getTopicBoard(profileId).catch(() => ({ state: "empty" as const, generatedAt: null, topics: [] })),
    sb
      .from("sniper_alerts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("status", "acted")
      .gte("created_at", outcomeCutoff)
      .is("reply_impressions", null),
    sb
      .from("analytics_daily")
      .select("date")
      .eq("profile_id", profileId)
      .order("date", { ascending: false })
      .limit(1),
  ]);

  const top = boardResult.topics[0] ?? null;
  const assignment = await getDailyAssignment(profileId, {
    liveTrends: false,
    topAngle: top ? { hook: top.angle || top.topic } : null,
  });
  const items = buildDailyPlan({
    assignment,
    topTopic: top ? { id: top.id, topic: top.topic, angle: top.angle, score: top.score } : null,
    pendingOutcomes: pendingResult.count ?? 0,
    analyticsDataThrough: analyticsResult.data?.[0]?.date ?? null,
    todayIso: new Date().toISOString().slice(0, 10),
  });
  return { items };
}
