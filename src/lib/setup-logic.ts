import type { InterviewAnswers } from "@/server/persona";
import type { SetupAnswers } from "@/lib/setup-steps";

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
