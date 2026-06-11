"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { parseAnalyticsCsv, CsvHeaderError, type RejectedRow } from "@/lib/kpis/csv";
import { computeKpis, computeFollowerStat, type FollowerStat } from "@/lib/kpis/aggregate";
import type { KpiSummary } from "@/lib/kpis/schemas";

export type ImportResult =
  | { ok: true; imported: number; rejected: RejectedRow[] }
  | { ok: false; error: string };

const WINDOW_DAYS = 30;
// Snapshots need extra reach: the 7d-delta baseline can sit a week behind an
// already-lagging dataThrough.
const SNAPSHOT_WINDOW_DAYS = 45;
const sinceDate = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/**
 * Fail-loud CSV import — the ONLY source for profile visits + new follows.
 * Returns a result union instead of throwing: Next.js masks server-action
 * error messages in production and the header-mismatch message IS the feature.
 */
export async function importAnalyticsCsv(profileId: string, csvText: string): Promise<ImportResult> {
  if (!profileId) return { ok: false, error: "no profile" };
  // Client-callable with attacker-influenced input — bound the work before
  // parsing. X's real export is a few hundred KB at worst.
  const MAX_CSV_BYTES = 2 * 1024 * 1024;
  if (csvText.length > MAX_CSV_BYTES) {
    return { ok: false, error: `CSV is too large (${Math.round(csvText.length / 1024)} KB; limit ${MAX_CSV_BYTES / 1024} KB).` };
  }
  let parsed: ReturnType<typeof parseAnalyticsCsv>;
  try {
    parsed = parseAnalyticsCsv(csvText);
  } catch (e) {
    if (e instanceof CsvHeaderError) return { ok: false, error: e.message };
    return { ok: false, error: String(e) };
  }
  if (parsed.rows.length === 0) {
    return {
      ok: false,
      error:
        parsed.rejected.length > 0
          ? `every row was rejected (first: line ${parsed.rejected[0].line} — ${parsed.rejected[0].reason})`
          : "CSV has no data rows",
    };
  }
  const sb = await supabaseServer();
  const importedAt = new Date().toISOString();
  const { error } = await sb.from("analytics_daily").upsert(
    parsed.rows.map((r) => ({ profile_id: profileId, ...r, imported_at: importedAt })),
    { onConflict: "profile_id,date" },
  );
  if (error) return { ok: false, error: error.message };
  await logActivity(sb, profileId, "csv_imported", {
    meta: { imported: parsed.rows.length, rejected: parsed.rejected.length },
  });
  revalidatePath("/performance");
  // The drill-downs are separate page segments — revalidating /performance
  // alone leaves them serving the pre-import data.
  revalidatePath("/performance/[card]", "page");
  revalidatePath("/");
  return { ok: true, imported: parsed.rows.length, rejected: parsed.rejected };
}

/** KPI aggregate for the card grid + drill-downs. Pure math lives in @/lib/kpis. */
export async function getKpis(profileId: string): Promise<KpiSummary> {
  const sb = await supabaseServer();
  const { data: analytics, error: analyticsError } = await sb
    .from("analytics_daily")
    .select("date, profile_visits, new_follows, imported_at")
    .eq("profile_id", profileId)
    .gte("date", sinceDate(WINDOW_DAYS))
    .order("date", { ascending: true });
  if (analyticsError) throw new Error(analyticsError.message);
  const { data: snapshots, error: snapshotsError } = await sb
    .from("follower_snapshots")
    .select("snapshot_date, followers, captured_at")
    .eq("profile_id", profileId)
    .gte("snapshot_date", sinceDate(SNAPSHOT_WINDOW_DAYS))
    .order("snapshot_date", { ascending: true });
  if (snapshotsError) throw new Error(snapshotsError.message);
  return computeKpis({ analytics: (analytics ?? []) as Parameters<typeof computeKpis>[0]["analytics"], snapshots: (snapshots ?? []) as Parameters<typeof computeKpis>[0]["snapshots"] });
}

/** Light fetch for the home follower star card. */
export async function getFollowerStat(profileId: string): Promise<FollowerStat | null> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("follower_snapshots")
    .select("snapshot_date, followers, captured_at")
    .eq("profile_id", profileId)
    .gte("snapshot_date", sinceDate(SNAPSHOT_WINDOW_DAYS))
    .order("snapshot_date", { ascending: true });
  if (error) throw new Error(error.message);
  return computeFollowerStat((data ?? []) as Parameters<typeof computeFollowerStat>[0]);
}
