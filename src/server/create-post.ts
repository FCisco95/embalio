"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { OriginalDraft } from "@/lib/schemas";
import { buildVoiceSystemFromSpec } from "@/lib/voice-prompt";
import { buildEngagementPostPrompt } from "@/lib/engagement/post-craft";
import { knobsFromProfile } from "@/lib/engagement/knobs";
import { generateTrendRadar } from "@/server/trends";

export async function findHotTopics(profileId: string) {
  const report = await generateTrendRadar(profileId);
  return report.trends;
}

export async function draftPostFromAngle(profileId: string, hook: string, source?: string) {
  const sb = await supabaseServer();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", profileId).single();
  if (!profile) throw new Error("profile not found");
  const knobs = knobsFromProfile(profile);
  const voiceSystem = buildVoiceSystemFromSpec(profile);
  const r = await generateStructured(OriginalDraft, buildEngagementPostPrompt(voiceSystem, { hook, source }, knobs));
  if (!r.data) throw new Error("could not draft post — try again");
  return r.data;
}
