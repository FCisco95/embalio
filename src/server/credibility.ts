"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { gateTrend } from "@/lib/credibility/gate";
import type { Trend } from "@/lib/schemas";

export interface GatedTrend {
  trend: Trend;
  angle: string;
  reason: string;
}

/** Run the credibility gate over a list of trends; return only the keepers. */
export async function gateTrends(profileId: string, trends: Trend[]): Promise<GatedTrend[]> {
  const sb = await supabaseServer();
  const { data: profile } = await sb
    .from("profiles")
    .select("content_pillars, niche_description")
    .eq("id", profileId)
    .single();
  if (!profile) throw new Error("profile not found");

  const pillars = ((profile.content_pillars ?? []) as string[]);
  const niche = ((profile.niche_description ?? "") as string);

  const judged = await Promise.all(
    trends.map(async (trend) => ({ trend, v: await gateTrend(pillars, niche, trend) })),
  );
  return judged
    .filter((x) => x.v.keep)
    .map((x) => ({ trend: x.trend, angle: x.v.angle || x.trend.angle, reason: x.v.reason }));
}
