import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Default rolling-retention window for the third-party `signal_tweets`
 * warehouse, in days. GDPR LIA R1 storage-limitation bound (Art. 5(1)(e)).
 * Env-overridable via SIGNAL_RETENTION_DAYS.
 */
export const RETENTION_DAYS_DEFAULT = 90;

/**
 * Resolve the active retention window in days. Reads SIGNAL_RETENTION_DAYS on
 * every call (so tests can vary it); honours it only when it parses to a
 * finite integer > 0, otherwise falls back to RETENTION_DAYS_DEFAULT.
 */
export function retentionDays(): number {
  const n = parseInt(process.env.SIGNAL_RETENTION_DAYS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : RETENTION_DAYS_DEFAULT;
}

/**
 * Pure: the ISO timestamp `days` before `now`. Rows whose `first_seen_at`
 * predates this cutoff are expired. Does not mutate `now`.
 */
export function retentionCutoffIso(now: Date, days: number = retentionDays()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/**
 * Hard-delete every `signal_tweets` row first collected before the retention
 * cutoff (snapshots cascade via FK). Fails LOUD — throws on supabase error so
 * the cron route can surface a non-200 to GitHub Actions (unlike the
 * fire-and-forget `warehouseTweets`). Returns rows deleted + the cutoff used.
 */
export async function purgeExpiredSignals(
  sb: SupabaseClient<Database>,
  opts?: { now?: Date; days?: number },
): Promise<{ deleted: number; cutoff: string }> {
  const now = opts?.now ?? new Date();
  const days = opts?.days ?? retentionDays();
  const cutoff = retentionCutoffIso(now, days);
  const { data, error } = await sb
    .from("signal_tweets")
    .delete()
    .lt("first_seen_at", cutoff)
    .select("id");
  if (error) throw new Error(`[retention] purge failed: ${error.message}`);
  return { deleted: data?.length ?? 0, cutoff };
}
