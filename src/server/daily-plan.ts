import { supabaseService } from "@/lib/supabase/server";
import { getDailyAssignment } from "@/server/coach";
import { getTopicBoard } from "@/server/topics";
import { buildDailyPlan, type DailyPlanItem } from "@/lib/coach/daily-plan";

export interface DailyPlanView {
  items: DailyPlanItem[];
}

/**
 * Read-only aggregation for the home checklist: existing assignment + topic
 * board reads, plus two tiny selects (pending outcome count, newest analytics
 * date). No new tables, no writes, no P4/P6 touch.
 */
export async function getDailyPlan(profileId: string): Promise<DailyPlanView> {
  const sb = supabaseService();

  const [assignment, boardResult, pendingResult, analyticsResult] = await Promise.all([
    getDailyAssignment(profileId),
    getTopicBoard(profileId).catch(() => ({ state: "empty" as const, generatedAt: null, topics: [] })),
    sb
      .from("sniper_alerts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("status", "acted")
      .is("reply_impressions", null),
    sb
      .from("analytics_daily")
      .select("date")
      .eq("profile_id", profileId)
      .order("date", { ascending: false })
      .limit(1),
  ]);

  const top = boardResult.topics[0] ?? null;
  const items = buildDailyPlan({
    assignment,
    topTopic: top ? { id: top.id, topic: top.topic, angle: top.angle, score: top.score } : null,
    pendingOutcomes: pendingResult.count ?? 0,
    analyticsDataThrough: analyticsResult.data?.[0]?.date ?? null,
    todayIso: new Date().toISOString().slice(0, 10),
  });
  return { items };
}
