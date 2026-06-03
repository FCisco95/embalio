"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { TargetQueue } from "@/lib/schemas";
import { buildTargetFinderPrompt } from "@/lib/voice-prompt";

function today(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Core: recommend accounts from pillars + north-star, no DB access. */
export async function recommendTargets(input: {
  existingHandles: string[];
  contentPillars: string[];
  northStarMetric: string | null;
  date?: string;
}): Promise<TargetQueue> {
  const r = await generateStructured(
    TargetQueue,
    buildTargetFinderPrompt(input.existingHandles, input.contentPillars, input.northStarMetric, input.date ?? today()),
    { research: true },
  );
  if (!r.data) throw new Error("could not generate target queue — try again");
  return r.data;
}

/** Thin wrapper: read pillars/north-star + existing handles for a profile, then recommend. */
export async function generateTargetQueue(profileId: string): Promise<TargetQueue> {
  const sb = await supabaseServer();
  const { data: profile, error } = await sb
    .from("profiles")
    .select("handle, content_pillars, north_star_metric")
    .eq("id", profileId)
    .single();
  if (error || !profile) throw new Error("profile not found");

  const { data: seedRows } = await sb
    .from("seed_targets")
    .select("handle")
    .eq("profile_id", profileId)
    .eq("active", true)
    .limit(20);

  const existingHandles = (seedRows ?? []).map((r) => r.handle).filter(Boolean) as string[];
  return recommendTargets({
    existingHandles,
    contentPillars: profile.content_pillars as string[],
    northStarMetric: profile.north_star_metric ?? null,
  });
}
