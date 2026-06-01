import { sanitizeForPrompt } from "@/lib/generate/sanitize";

export interface GrowthPlanPromptInput {
  handle: string;
  archetypeLabel: string;        // "Developer / Builder"
  voiceSpec: string;             // from PersonaSynthesis
  pillars: string[];
  angle: string;                 // the user's edge
  goalNarrative: string;         // "build authority in AI agents"
  northStarTarget: string;       // "2,000 engaged followers"
  dailyReplyTarget: number;      // from knobsFromProfile
  targets: { handle: string; reason: string }[];
}

export function buildGrowthPlanPrompt(i: GrowthPlanPromptInput): string {
  const accounts = i.targets.length
    ? i.targets.map((t) => `- ${sanitizeForPrompt(t.handle, 60)}: ${sanitizeForPrompt(t.reason, 200)}`).join("\n")
    : "(none recommended — leave whoToWatch empty)";
  return [
    `You are writing a personalized 90-day X growth plan for @${sanitizeForPrompt(i.handle, 60)} — a ${sanitizeForPrompt(i.archetypeLabel, 60)}.`,
    `Their voice spec (write the plan IN this voice where prose appears):\n${sanitizeForPrompt(i.voiceSpec, 1200)}`,
    `Their content pillars: ${i.pillars.map((p) => sanitizeForPrompt(p, 40)).join(", ") || "(unspecified)"}.`,
    `Their edge (why follow THEM): ${sanitizeForPrompt(i.angle, 400) || "(unspecified)"}.`,
    `Their goal narrative: ${sanitizeForPrompt(i.goalNarrative, 200)}. North-star target: ${sanitizeForPrompt(i.northStarTarget, 120)}.`,
    `Their capacity supports about ${i.dailyReplyTarget} strategic replies/day — ground the "rhythm" section in that (e.g. "${i.dailyReplyTarget}/day strategic replies", plus a realistic original-post + thread cadence).`,
    `Accounts to watch (rewrite each "why" as a sharp one-liner about why THIS account matters FOR THEM — do NOT invent follower counts or "x your size" multiples; we have no follower data):\n${accounts}`,
    `The plan must optimize for the engine's law: replies engineered to make the author reply back, posts built for replies + bookmarks + dwell — never for likes. "embalioDoes" should say, in plain terms, what Embalio does for them daily (scans, drafts in-voice replies built for the author's reply-back, pings their phone, tracks reach). "firstMoves" = 2-3 concrete starting actions.`,
    `Return EXACTLY this JSON (no markdown): {"archetypeLabel": "...", "headline": "@handle · goal → target", "voiceSummary": "...", "voiceTags": ["..."], "pillars": ["..."], "edge": "...", "whoToWatch": [{"handle": "...", "why": "..."}], "rhythm": [{"count": "5/day", "label": "strategic replies"}], "northStar": {"metric": "...", "detail": "..."}, "embalioDoes": ["..."], "firstMoves": ["..."]}.`,
  ].join("\n\n");
}
