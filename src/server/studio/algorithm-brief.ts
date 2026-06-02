import { supabaseService } from "@/lib/supabase/server";
import { AlgorithmBrief } from "@/lib/studio/schemas";
import type { Json } from "@/lib/supabase/types";

export interface BriefRow {
  brief: AlgorithmBrief;
  researched_at: string;
}

/** Most recent brief for the profile, or null. */
export async function getAlgorithmBrief(profileId: string): Promise<BriefRow | null> {
  const sb = supabaseService();
  const { data } = await sb
    .from("algorithm_briefs")
    .select("brief, researched_at")
    .eq("profile_id", profileId)
    .order("researched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const parsed = AlgorithmBrief.safeParse(data.brief);
  if (!parsed.success) return null;
  return { brief: parsed.data, researched_at: data.researched_at };
}

/**
 * Return the cached brief if within the freshness window; otherwise run `research`
 * and cache it. On research failure, fall back to the stale cache if one exists,
 * else rethrow. `now` is injectable for tests.
 */
export async function runAlgorithmBrief(
  profileId: string,
  research: () => Promise<AlgorithmBrief>,
  opts: { freshnessDays?: number; now?: Date } = {},
): Promise<{ brief: AlgorithmBrief; researched_at: string; stale: boolean }> {
  const now = opts.now ?? new Date();
  const windowMs = (opts.freshnessDays ?? 7) * 24 * 60 * 60 * 1000;
  const latest = await getAlgorithmBrief(profileId);
  if (latest && now.getTime() - new Date(latest.researched_at).getTime() < windowMs) {
    return { ...latest, stale: false };
  }
  try {
    const fresh = await research();
    const researched_at = now.toISOString();
    const sb = supabaseService();
    const { error } = await sb
      .from("algorithm_briefs")
      .insert({ profile_id: profileId, brief: fresh as unknown as Json, researched_at })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { brief: fresh, researched_at, stale: false };
  } catch (err) {
    if (latest) return { ...latest, stale: true };
    throw err;
  }
}
