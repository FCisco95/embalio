"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { PersonaSynthesis } from "@/lib/schemas";
import { buildSynthesisPrompt } from "@/lib/voice-prompt";
import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/supabase/types";

export interface InterviewAnswers {
  niche: string; goals: string; tone: string; doDont?: string; admired?: string;
}

// Research + synthesize the persona (web tools enabled for seed-account suggestions).
export async function synthesizePersona(a: InterviewAnswers): Promise<PersonaSynthesis> {
  const r = await generateStructured(PersonaSynthesis, buildSynthesisPrompt(a), { research: true });
  if (!r.data) throw new Error("could not synthesize a voice spec — try again");
  return r.data;
}

export async function getPersona(profileId: string) {
  const sb = await supabaseServer();
  const { data } = await sb.from("profiles")
    .select("handle, voice_spec, goals, content_pillars, onboarding_answers").eq("id", profileId).single();
  return data;
}

export async function savePersona(profileId: string, input: {
  voiceSpec: string; goals: string; contentPillars: string[]; answers: InterviewAnswers; seedAccounts: string[];
}) {
  const sb = await supabaseServer();
  const { error } = await sb.from("profiles").update({
    voice_spec: input.voiceSpec, goals: input.goals,
    content_pillars: input.contentPillars, onboarding_answers: input.answers as unknown as Json,
  }).eq("id", profileId);
  if (error) throw new Error(error.message);
  for (const handle of input.seedAccounts) {
    const h = handle.trim();
    if (h) await sb.from("seed_targets").insert({ profile_id: profileId, handle: h });
  }
  revalidatePath("/profiles");
}
