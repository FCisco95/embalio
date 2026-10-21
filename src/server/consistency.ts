import { supabaseServer } from "@/lib/supabase/server";
import { computeConsistency, type ConsistencyResult } from "@/lib/gate/consistency";

const DAY_MS = 86_400_000;

type DraftEmbed = { kind: string } | { kind: string }[] | null;

/** An own post with no draft (imported) counts; a post whose draft is a reply never does. */
const isOriginal = (d: DraftEmbed): boolean => {
  const kind = Array.isArray(d) ? d[0]?.kind : d?.kind;
  return kind === undefined || kind === "original";
};

/**
 * Consistency gate for one account (a publish day = a posts row with a tweet URL whose draft, if any, is an
 * ORIGINAL: reply logs and reply drafts never count), read through the session client so RLS
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
    .select("posted_at, drafts(kind)")
    .eq("profile_id", profileId)
    .gte("posted_at", since)
    .not("tweet_url", "is", null);
  if (error) throw new Error(`consistency read failed: ${error.message}`);

  return computeConsistency(
    (data ?? []).filter((r) => isOriginal(r.drafts as DraftEmbed)).map((r) => r.posted_at),
    now,
    days,
  );
}
