"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { computeStreak } from "@/lib/streak";
export async function getStreak(profileId: string): Promise<number> {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("posts").select("posted_at").eq("profile_id", profileId);
  if (error || !data) return 0;
  return computeStreak(data.map((r: { posted_at: string }) => r.posted_at), new Date());
}
