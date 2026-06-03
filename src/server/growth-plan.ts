"use server";
import { supabaseService, supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { GrowthPlan } from "@/lib/schemas";
import { buildGrowthPlanPrompt } from "@/lib/growth-plan/prompt";
import { knobsFromProfile } from "@/lib/engagement/knobs";
import type { Json } from "@/lib/supabase/types";
import type { SetupAnswers } from "@/lib/setup-steps";
import type { PersonaSynthesis, TargetQueue } from "@/lib/schemas";

const ARCHETYPE_LABEL: Record<string, string> = {
  dev: "Developer / Builder", founder: "Founder / Operator",
  creator: "Creator / Educator", trader: "Trader / Investor", protocol: "Project / Protocol",
};

export async function generateGrowthPlan(
  answers: SetupAnswers,
  synth: PersonaSynthesis,
  targets: TargetQueue,
): Promise<GrowthPlan> {
  // Capacity → daily reply target via the Plan A knob mapping (account_size/capacity columns
  // aren't written until finalize, so map straight off the answers here).
  const knobs = knobsFromProfile({
    account_size: answers.accountSize || null,
    daily_capacity: answers.capacity || null,
    north_star_metric: answers.goal || answers.goalTarget || null,
    reply_playbook: answers.replyPlaybook || null,
  });
  const prompt = buildGrowthPlanPrompt({
    handle: answers.handle.replace(/^@+/, ""),
    archetypeLabel: ARCHETYPE_LABEL[answers.archetype] ?? "Builder",
    voiceSpec: synth.voiceSpec,
    pillars: synth.contentPillars,
    angle: answers.angle,
    goalNarrative: answers.goalOpen?.trim() || answers.goal,
    northStarTarget: answers.goalTarget,
    dailyReplyTarget: knobs.dailyReplyTarget,
    targets: targets.targets.map((t) => ({ handle: t.handle, reason: t.reason })),
  });
  const r = await generateStructured(GrowthPlan, prompt);
  if (!r.data) throw new Error("could not craft your growth plan — try again");
  return r.data;
}

export async function saveGrowthPlan(profileId: string, plan: GrowthPlan): Promise<void> {
  const sb = supabaseService();
  const { error } = await sb.from("profiles").update({ growth_plan: plan as unknown as Json }).eq("id", profileId);
  if (error) throw new Error(error.message);
}

export async function getGrowthPlan(profileId: string): Promise<GrowthPlan | null> {
  const sb = await supabaseServer();
  const { data } = await sb.from("profiles").select("growth_plan").eq("id", profileId).single();
  const raw = data?.growth_plan;
  if (!raw) return null;
  const parsed = GrowthPlan.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
