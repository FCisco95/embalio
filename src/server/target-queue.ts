"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { TargetQueue } from "@/lib/schemas";
import { buildTargetFinderPrompt } from "@/lib/voice-prompt";

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
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const r = await generateStructured(
    TargetQueue,
    buildTargetFinderPrompt(
      existingHandles,
      profile.content_pillars as string[],
      profile.north_star_metric ?? null,
      date
    ),
    { research: true }
  );
  if (!r.data) throw new Error("could not generate target queue — try again");
  return r.data;
}
