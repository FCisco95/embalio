import type { InterviewAnswers } from "@/server/persona";
import type { StepDef, SetupAnswers } from "@/lib/setup-steps";

const GOAL_TO_NORTHSTAR: Record<string, string> = {
  followers: "grow followers",
  reach: "grow reach / impressions",
  leads: "generate inbound leads / clients",
  authority: "build authority in the niche",
};

export function normHandle(h: string): string {
  return h.trim().replace(/^@+/, "").toLowerCase();
}

export function answersToInterview(a: SetupAnswers): InterviewAnswers {
  const goal = a.goalOpen?.trim() || GOAL_TO_NORTHSTAR[a.goal] || a.goal;
  return {
    niche: a.pillars.join(", "),
    goals: goal,
    tone: a.voiceMethod === "tags" ? a.voiceTags.join(", ") : "",
    northStarMetric: goal,
    premiumAccount: a.premium,
  };
}

export function needsSetup(
  p: { voice_spec?: string | null; content_pillars?: string[] | null } | null | undefined,
): boolean {
  if (!p) return true;
  const hasVoice = !!(p.voice_spec && p.voice_spec.trim());
  const hasPillars = Array.isArray(p.content_pillars) && p.content_pillars.length > 0;
  return !(hasVoice && hasPillars);
}

export function curatedSeedHandles(opts: {
  recommended: string[];
  toggledOff: string[];
  added: string[];
}): string[] {
  const off = new Set(opts.toggledOff.map(normHandle));
  const kept = opts.recommended.map(normHandle).filter((h) => h && !off.has(h));
  const added = opts.added.map(normHandle).filter(Boolean);
  return [...new Set([...kept, ...added])];
}

/** Pure step-completion check. Fixes the goalOpen bug: a custom goal counts. */
export function stepComplete(step: StepDef, a: SetupAnswers): boolean {
  if (step.optional || !step.required) return true;
  if (step.id === "goal") {
    return a.goal.trim().length > 0 || !!a.goalOpen?.trim();
  }
  const v = (a as unknown as Record<string, unknown>)[step.id];
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "boolean") return true; // a toggle always carries a value
  return typeof v === "string" ? v.trim().length > 0 : Boolean(v);
}
