"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { PersonaSynthesis } from "@/lib/schemas";
import { buildSynthesisPrompt } from "@/lib/voice-prompt";
import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/supabase/types";

export interface InterviewAnswers {
  niche: string;
  goals: string;
  tone: string;
  doDont?: string;
  admired?: string;
  northStarMetric?: string;
  premiumAccount?: boolean;
  // Engagement-engine context (capture-now, wire-later — persisted in onboarding_answers jsonb)
  archetype?: string;
  archetypeDetail?: string;
  angle?: string;
  zoneOfGenius?: string;
  motive?: string;
  platforms?: string[];
  formats?: string[];
  replyPlaybook?: string;
  inspirations?: string[];
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
  northStarMetric?: string; premiumAccount?: boolean;
}) {
  // Normalize handles (lowercase, strip @) and deduplicate before sending to the
  // save_persona RPC which atomically updates the profile + upserts seed_targets.
  const seedHandles = [
    ...new Set(
      input.seedAccounts
        .map((h) => h.trim().replace(/^@+/, "").toLowerCase())
        .filter(Boolean),
    ),
  ];

  const sb = await supabaseServer();
  const { error } = await sb.rpc("save_persona", {
    p_profile_id: profileId,
    p_voice_spec: input.voiceSpec,
    p_goals: input.goals,
    p_content_pillars: input.contentPillars,
    p_onboarding_answers: input.answers as unknown as Json,
    p_seed_handles: seedHandles,
  });
  if (error) throw new Error(error.message);

  if (input.northStarMetric !== undefined || input.premiumAccount !== undefined) {
    const sb2 = await supabaseServer();
    await sb2.from("profiles").update({
      ...(input.northStarMetric !== undefined ? { north_star_metric: input.northStarMetric } : {}),
      ...(input.premiumAccount !== undefined ? { premium_account: input.premiumAccount } : {}),
    }).eq("id", profileId);
  }

  revalidatePath("/profiles");
}
