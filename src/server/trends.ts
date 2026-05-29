"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { TrendReport } from "@/lib/schemas";
import { buildTrendRadarPrompt } from "@/lib/voice-prompt";

export async function generateTrendRadar(profileId: string): Promise<TrendReport> {
  const sb = await supabaseServer();
  const { data: profile, error } = await sb
    .from("profiles")
    .select("content_pillars")
    .eq("id", profileId)
    .single();
  if (error || !profile) throw new Error("profile not found");

  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const pillars = profile.content_pillars as string[];
  const r = await generateStructured(TrendReport, buildTrendRadarPrompt(pillars, date), { research: true });
  if (!r.data) throw new Error("could not generate trend radar — try again");
  return r.data;
}
