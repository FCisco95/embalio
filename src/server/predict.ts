"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { weeklyForecast } from "@/lib/predict/forecast";
import { projectTrajectory } from "@/lib/predict/trajectory";
import { summarizeBreakout } from "@/lib/predict/breakout";
import { avgDailyFollowsPerDay } from "@/lib/predict/rate";
import { buildPredictionRecord } from "@/lib/predict/persist";
import { scoreDraftBreakout } from "@/server/original";
import type { Trajectory, WeeklyForecast, BreakoutPrecheck } from "@/lib/predict/schemas";
import type { Json } from "@/lib/supabase/types";

const SNAPSHOT_WINDOW_DAYS = 45;
const HORIZON_DAYS = 14;
const sinceDate = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

async function readSnapshots(sb: Awaited<ReturnType<typeof supabaseServer>>, profileId: string) {
  const { data, error } = await sb
    .from("follower_snapshots")
    .select("snapshot_date, followers, captured_at")
    .eq("profile_id", profileId)
    .gte("snapshot_date", sinceDate(SNAPSHOT_WINDOW_DAYS))
    .order("snapshot_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as { snapshot_date: string; followers: number; captured_at?: string | null }[];
}

// analytics_daily.new_follows feeds the sparse-data fallback rate (AC#1/#3 input).
async function readDailyFollows(sb: Awaited<ReturnType<typeof supabaseServer>>, profileId: string) {
  const { data, error } = await sb
    .from("analytics_daily")
    .select("date, new_follows")
    .eq("profile_id", profileId)
    .gte("date", sinceDate(SNAPSHOT_WINDOW_DAYS))
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as { date: string; new_follows: number }[];
}

export type ForecastBundle =
  | { ok: true; trajectory: Trajectory | null; forecast: WeeklyForecast | null }
  | { ok: false; error: string };

/** Trajectory + weekly forecast for the /performance card. Persists both receipts. Never throws. */
export async function getForecastBundle(profileId: string): Promise<ForecastBundle> {
  if (!profileId) return { ok: false, error: "no profile" };
  try {
    const sb = await supabaseServer();
    const [snaps, daily] = await Promise.all([readSnapshots(sb, profileId), readDailyFollows(sb, profileId)]);
    const now = Date.now();
    const fallback = avgDailyFollowsPerDay(daily);
    const trajectory = projectTrajectory(snaps, HORIZON_DAYS, now, fallback);
    const forecast = weeklyForecast(snaps, now, fallback);
    const rows = [
      trajectory && buildPredictionRecord("trajectory", trajectory, now, HORIZON_DAYS),
      forecast && buildPredictionRecord("weekly_forecast", forecast, now, 7),
    ].filter(Boolean).map((r) => ({ profile_id: profileId, ...r!, value_json: r!.value_json as Json }));
    if (rows.length) await sb.from("predictions").insert(rows);
    return { ok: true, trajectory, forecast };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export type BreakoutResult = { ok: true; precheck: BreakoutPrecheck } | { ok: false; error: string };

/** AC#4: call the existing prompt -> 0-100 -> persist. Never throws. */
export async function precheckBreakout(profileId: string, draft: string): Promise<BreakoutResult> {
  if (!profileId) return { ok: false, error: "no profile" };
  try {
    const raw = await scoreDraftBreakout(draft);
    const precheck = summarizeBreakout(raw);
    const sb = await supabaseServer();
    const rec = buildPredictionRecord("breakout", precheck, Date.now(), 30);
    await sb.from("predictions").insert({ profile_id: profileId, ...rec, value_json: rec.value_json as Json });
    return { ok: true, precheck };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
