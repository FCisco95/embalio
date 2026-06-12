"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { getWeekStart } from "@/lib/weekly-activity";

export interface WeeklyActivity {
  postsThisWeek: number;
  repliesThisWeek: number;
  bioOptimized: boolean;
  pinnedOptimized: boolean;
}

export async function getWeeklyActivity(profileId: string): Promise<WeeklyActivity> {
  const sb = await supabaseServer();
  const weekStart = getWeekStart(new Date()).toISOString();

  const [postsResult, repliesResult, profileResult] = await Promise.all([
    sb
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .gte("posted_at", weekStart),
    sb
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .in("kind", ["reply_posted", "sniper_alert_acted"])
      .gte("created_at", weekStart),
    sb
      .from("profiles")
      .select("bio_optimized, pinned_optimized")
      .eq("id", profileId)
      .single(),
  ]);

  if (postsResult.error) console.error("[weekly-activity] posts query failed:", postsResult.error.message);
  if (repliesResult.error) console.error("[weekly-activity] replies query failed:", repliesResult.error.message);
  if (profileResult.error) console.error("[weekly-activity] profile query failed:", profileResult.error.message);

  return {
    postsThisWeek: postsResult.error ? 0 : (postsResult.count ?? 0),
    repliesThisWeek: repliesResult.error ? 0 : (repliesResult.count ?? 0),
    bioOptimized: profileResult.data?.bio_optimized ?? false,
    pinnedOptimized: profileResult.data?.pinned_optimized ?? false,
  };
}
