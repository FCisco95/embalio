import { supabaseService } from "@/lib/supabase/server";
import { DEFAULT_WINDOW_DAYS } from "@/lib/gate/expiry";
import {
  computeScorecard,
  type GateScorecard,
  type ScorecardAlert,
  type VisitDay,
} from "@/lib/gate/scorecard";

export interface GateScorecardResult extends GateScorecard {
  windowDays: number;
  /** newest analytics date in window, or null — drives a staleness hint in the UI. */
  dataThrough: string | null;
}

/** One acted alert awaiting (or already carrying) a manual reply outcome. */
export interface ActedAlertRow {
  id: string;
  author_handle: string;
  tweet_text: string;
  tweet_url: string;
  /** Window anchor — the scorecard filters on created_at, not sent_at. */
  created_at: string;
  sent_at: string | null;
  reply_impressions: number | null;
  author_median_reply_impressions: number | null;
  author_reply_back: boolean | null;
}

/**
 * Recent ACTED alerts for the manual outcome-capture list on the scorecard page.
 * Newest send first. Throws on read error (house style for reads).
 */
export async function listRecentActedAlerts(
  profileId: string,
  opts?: { windowDays?: number; limit?: number },
): Promise<ActedAlertRow[]> {
  const windowDays = opts?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const limit = opts?.limit ?? 50;
  const sb = supabaseService();
  const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const { data, error } = await sb
    .from("sniper_alerts")
    .select(
      "id, author_handle, tweet_text, tweet_url, created_at, sent_at, reply_impressions, author_median_reply_impressions, author_reply_back",
    )
    .eq("profile_id", profileId)
    .eq("status", "acted")
    .gte("created_at", cutoff)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listing acted alerts failed: ${error.message}`);
  return (data ?? []) as ActedAlertRow[];
}

/**
 * Read the GATE-2 dogfood scorecard for a profile: decided sniper alerts +
 * daily profile visits over a rolling window, reduced to the judged metrics.
 * Throws on a DB read error (mirrors getKpis — a fake all-null card would lie).
 */
export async function getGateScorecard(
  profileId: string,
  opts?: { windowDays?: number },
): Promise<GateScorecardResult> {
  const windowDays = opts?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const sb = supabaseService();
  const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const { data: alerts, error } = await sb
    .from("sniper_alerts")
    .select("status, skip_reason, reply_impressions, author_median_reply_impressions, author_reply_back, sent_at")
    .eq("profile_id", profileId)
    .in("status", ["acted", "dismissed"])
    .gte("created_at", cutoff);
  if (error) throw new Error(`gate scorecard alerts read failed: ${error.message}`);

  const { data: visits, error: vErr } = await sb
    .from("analytics_daily")
    .select("date, profile_visits")
    .eq("profile_id", profileId)
    .gte("date", cutoff.slice(0, 10))
    .order("date", { ascending: true });
  if (vErr) throw new Error(`gate scorecard visits read failed: ${vErr.message}`);

  const visitDays = (visits ?? []) as VisitDay[];
  const dataThrough = visitDays.length ? visitDays[visitDays.length - 1].date : null;
  return {
    ...computeScorecard((alerts ?? []) as ScorecardAlert[], visitDays),
    windowDays,
    dataThrough,
  };
}
