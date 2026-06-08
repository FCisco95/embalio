"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { computeStreak } from "@/lib/streak";
export async function getStreak(profileId: string): Promise<number> {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("posts").select("posted_at").eq("profile_id", profileId);
  if (error || !data) return 0;
  // Guard against null/absent posted_at (DB default normally fills it; a seeded or
  // legacy row could be null and new Date(null) would corrupt the day key to 1970).
  const dates = data
    .map((r: { posted_at: string | null }) => r.posted_at)
    .filter((d): d is string => d != null);
  return computeStreak(dates, new Date());
}
