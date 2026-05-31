"use server";
import { supabaseService } from "@/lib/supabase/server";
import { synthesizePersona, savePersona } from "@/server/persona";
import { recommendTargets } from "@/server/target-queue";
import { answersToInterview, normHandle } from "@/lib/setup-logic";
import type { SetupAnswers } from "@/lib/setup-steps";
import type { PersonaSynthesis, TargetQueue } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

export async function getSetupProfileId(): Promise<string> {
  const fixed = process.env.FIXED_PROFILE_ID;
  if (fixed) return fixed;
  const sb = supabaseService();
  const { data } = await sb.from("profiles").select("id").order("created_at").limit(1).maybeSingle();
  if (data?.id) return data.id;
  const { data: created, error } = await sb
    .from("profiles")
    .insert({ handle: "new-account", voice_corpus: [] })
    .select("id")
    .single();
  if (error || !created) throw new Error("could not create a profile for setup");
  return created.id;
}

export interface SetupPreview {
  synth: PersonaSynthesis;
  targets: TargetQueue;
}

export async function buildSetupPreview(a: SetupAnswers): Promise<SetupPreview> {
  const interview = answersToInterview(a);
  const synth = await synthesizePersona(interview);
  let targets: TargetQueue = { targets: [], generatedAt: "" };
  try {
    targets = await recommendTargets({
      existingHandles: [],
      contentPillars: synth.contentPillars,
      northStarMetric: interview.northStarMetric ?? null,
    });
  } catch {
    // recommendations are best-effort; setup must proceed without them
  }
  return { synth, targets };
}

export async function finalizeSetup(
  profileId: string,
  payload: { answers: SetupAnswers; voiceSpec: string; contentPillars: string[]; seedHandles: string[] },
): Promise<void> {
  const a = payload.answers;
  const interview = answersToInterview(a);

  const sb = supabaseService();
  const { error: upErr } = await sb
    .from("profiles")
    .update({
      handle: normHandle(a.handle),
      niche_description: a.pillars.join(", "),
      voice_corpus: a.voiceCorpus ?? [],
      voice_notes: a.voiceMethod === "tags" ? a.voiceTags.join(", ") : "",
    })
    .eq("id", profileId);
  if (upErr) throw new Error(upErr.message);

  await savePersona(profileId, {
    voiceSpec: payload.voiceSpec,
    goals: interview.goals,
    contentPillars: payload.contentPillars,
    answers: interview,
    seedAccounts: payload.seedHandles,
    northStarMetric: interview.northStarMetric,
    premiumAccount: a.premium,
  });

  revalidatePath("/");
}
