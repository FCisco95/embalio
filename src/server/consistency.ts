import { supabaseServer } from "@/lib/supabase/server";
import { computeConsistency, type ConsistencyResult } from "@/lib/gate/consistency";

const DAY_MS = 86_400_000;

/**
 * Consistency gate for one account, read through the session client so RLS
 * scopes it to the signed-in user. Throws on a read error: a fake all-zero card
 * would claim the gate is failing for the wrong reason.
 */
export async function getConsistencyGate(profileId: string, days = 30): Promise<ConsistencyResult> {
  const now = new Date();
  // Start of the oldest UTC day in the window, so the query and the day strip agree.
  const since = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * DAY_MS,
  ).toISOString();

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("posts")
    .select("posted_at")
    .eq("profile_id", profileId)
    .gte("posted_at", since);
  if (error) throw new Error(`consistency read failed: ${error.message}`);

  return computeConsistency((data ?? []).map((r) => r.posted_at), now, days);
}
