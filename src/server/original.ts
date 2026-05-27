"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { AngleList, OriginalDraft, type Angle } from "@/lib/schemas";
import { buildAnglesPrompt, buildOriginalFromAnglePrompt, buildVoiceSystemFromSpec } from "@/lib/voice-prompt";
import { revalidatePath } from "next/cache";

export async function proposeAnglesForPillars(pillars: string[]): Promise<Angle[]> {
  const r = await generateStructured(AngleList, buildAnglesPrompt(pillars), { research: true });
  if (!r.data) throw new Error("could not research angles — try again");
  return r.data.angles;
}

export async function draftFromAngle(voiceSystem: string, angle: Angle): Promise<OriginalDraft> {
  const r = await generateStructured(OriginalDraft, buildOriginalFromAnglePrompt(voiceSystem, angle));
  if (!r.data) throw new Error("could not draft this angle — try again");
  return r.data;
}

export async function composeOriginalForProfile(profileId: string, angle: Angle) {
  const sb = await supabaseServer();
  const { data: profile, error } = await sb.from("profiles").select("handle, voice_spec").eq("id", profileId).single();
  if (error || !profile) throw new Error("profile not found");
  const voiceSystem = buildVoiceSystemFromSpec({ handle: profile.handle, voice_spec: profile.voice_spec });
  const draft = await draftFromAngle(voiceSystem, angle);
  const body = draft.posts.join("\n\n");
  const { data, error: insErr } = await sb.from("drafts").insert({
    profile_id: profileId, kind: "original", body, suggested_visual: draft.suggestedVisual,
    model_used: process.env.GEN_BACKEND ?? "subscription",
  }).select().single();
  if (insErr) throw new Error(insErr.message);
  revalidatePath("/compose");
  return { draft, saved: data };
}

export async function getProfilePillars(profileId: string): Promise<string[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("profiles").select("content_pillars").eq("id", profileId).single();
  return data?.content_pillars ?? [];
}
