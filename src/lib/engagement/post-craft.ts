import { sanitizeForPrompt } from "@/lib/generate/sanitize";
import type { EngagementKnobs } from "@/lib/engagement/knobs";

export interface PostAngle { hook: string; source?: string }

export function buildEngagementPostPrompt(voiceSystem: string, angle: PostAngle, knobs: EngagementKnobs): string {
  return [
    voiceSystem,
    `Write an original X post from this angle: "${sanitizeForPrompt(angle.hook, 500)}".`,
    angle.source ? `Source (put any URL in a reply, NOT the post body): ${sanitizeForPrompt(angle.source, 500)}` : "",
    `Reach rules (X, researched):`,
    `- First line is the entire bet: a curiosity gap + a specific payoff. Out-of-network viewers see only line 1.`,
    `- Optimize for REPLIES and BOOKMARKS and dwell — never for likes. End on a real, specific question, not a CTA.`,
    `- No link in the post body (suppresses reach / link-in-reply instead). Specific numbers, tool names, dates outperform vague claims.`,
    `- One tweet by default; only a 5-8 tweet thread if there's a genuine sequence. Each post <=280 chars.`,
    knobs.goal === "leads" ? `Goal leads: position credibility; invite a reply that could become a DM.` : "",
    knobs.goal === "authority" ? `Goal authority: lead with original depth (a number, a mechanism, a counterexample).` : "",
    `Anti-AI-tell: no em dashes (—), no "delve"/"game-changer"/"revolutionary"/"it's worth noting". Lowercase sentence starts; first-person; one sentence per line for multi-line.`,
    `Return exactly this JSON: {"posts": ["..."], "suggestedVisual": "..."} (suggestedVisual optional).`,
  ].filter(Boolean).join("\n\n");
}
