import type { InterviewAnswers } from "@/server/persona";
import type { StepDef, SetupAnswers, ChapterId } from "@/lib/setup-steps";

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
  const clean = (s: string) => (s.trim() ? s.trim() : undefined);
  const arr = (xs: string[]) => (xs.length ? xs : undefined);
  return {
    niche: a.pillars.join(", "),
    goals: goal,
    tone: a.voiceMethod === "tags" ? a.voiceTags.join(", ") : "",
    northStarMetric: clean(a.goalTarget) ?? goal,
    premiumAccount: a.premium,
    archetype: a.archetype || undefined,
    archetypeDetail: clean(a.archetypeDetail),
    angle: clean(a.angle),
    zoneOfGenius: clean(a.zoneOfGenius),
    motive: clean(a.motive),
    platforms: arr(a.platforms),
    formats: arr(a.formats),
    replyPlaybook: clean(a.replyPlaybook),
    inspirations: arr(a.inspirations),
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

export interface Interstitial { title: string; body: string }

const ARCHETYPE_LABEL: Record<string, string> = {
  dev: "developer / builder", founder: "founder / operator",
  creator: "creator / educator", trader: "trader / investor", protocol: "project / protocol",
};

const GOAL_MIRROR: Record<string, string> = {
  followers: "so I'll prioritize peer-tier accounts and replies that earn the profile click.",
  reach: "so I'll prioritize larger rising posts and write for the repost-and-reply, not the like.",
  leads: "so I'll favor question- and DM-able posts and position you as the credible practitioner.",
  authority: "so I'll favor depth — technical replies that bring the precise detail others miss.",
};

/** A short reflective screen shown after a chapter, mirroring the answer back. */
export function interstitialFor(chapter: ChapterId, a: SetupAnswers): Interstitial | null {
  if (chapter === "you" && a.archetype) {
    return {
      title: "Got it.",
      body: `You're a ${ARCHETYPE_LABEL[a.archetype] ?? a.archetype} — I'll tune what "good engagement" means to that.`,
    };
  }
  if (chapter === "goal") {
    const key = a.goalOpen?.trim() ? "" : a.goal;
    const mirror = GOAL_MIRROR[key];
    if (mirror) return { title: "That changes the play.", body: `Goal: ${a.goal} — ${mirror}` };
    if (a.goalOpen?.trim()) return { title: "That changes the play.", body: `Goal: ${a.goalOpen.trim()} — I'll point the engine at exactly that.` };
  }
  if (chapter === "niche" && a.angle.trim()) {
    return { title: "That's your edge.", body: "Every draft will lean on it instead of saying what everyone else says." };
  }
  return null;
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
