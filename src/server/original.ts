"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateStructured, generateText } from "@/lib/generate";
import { AngleList, OriginalDraft, type Angle, WeeklyAngleList, WeeklyPost, WeeklyPostPlan } from "@/lib/schemas";
import { buildAnglesPrompt, buildOriginalFromAnglePrompt, buildVoiceSystemFromSpec, buildCiscoContextBlock, buildWorldResearchPrompt, buildCrossRefSynthesisPrompt, buildWeeklyDraftPrompt, buildAlgorithmRulesBlock } from "@/lib/voice-prompt";
import { readHandoff } from "@/lib/handoff-reader";
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

export async function generateWeeklyPosts(profileId: string, journalEntry?: string): Promise<WeeklyPostPlan> {
  const sb = await supabaseServer();

  // Step 1: Load context
  const { data: profile, error } = await sb
    .from("profiles")
    .select("handle, voice_spec, content_pillars")
    .eq("id", profileId)
    .single();
  if (error || !profile) throw new Error("profile not found");

  const handoffText = await readHandoff();
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const ciscoContext = buildCiscoContextBlock(
    { handle: profile.handle, voice_spec: profile.voice_spec, content_pillars: profile.content_pillars as string[] },
    handoffText,
    journalEntry
  );
  const voiceSystem = buildVoiceSystemFromSpec({ handle: profile.handle, voice_spec: profile.voice_spec });

  // Step 2: Parallel research
  const [xTopics, github, news] = await Promise.all([
    generateText(buildWorldResearchPrompt("x-topics", date), { research: true }),
    generateText(buildWorldResearchPrompt("github", date), { research: true }),
    generateText(buildWorldResearchPrompt("news", date), { research: true }),
  ]);

  // Step 3: Synthesis
  const synthesis = await generateStructured(
    WeeklyAngleList,
    buildCrossRefSynthesisPrompt(ciscoContext, { xTopics, github, news }, date)
  );
  if (!synthesis.data) throw new Error("could not find angles — try again");

  // Step 4: Draft in parallel
  const draftResults = await Promise.all(
    synthesis.data.angles.map((angle) =>
      generateStructured(
        OriginalDraft,
        buildWeeklyDraftPrompt(voiceSystem, angle, buildAlgorithmRulesBlock(angle.format))
      )
    )
  );

  // Step 5: Assemble plan
  const posts: WeeklyPost[] = synthesis.data.angles.map((angle, i) => ({
    format: angle.format,
    hook: angle.hook,
    posts: draftResults[i].data?.posts ?? ["(draft failed — regenerate)"],
    context: angle.connection,
    source: angle.source,
    sourceDate: angle.sourceDate,
    suggestedVisual: draftResults[i].data?.suggestedVisual,
  }));

  revalidatePath("/compose");
  return { weekOf: date, posts };
}
