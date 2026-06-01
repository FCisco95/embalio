import { frameUntrusted, sanitizeForPrompt, UNTRUSTED_DATA_NOTICE } from "@/lib/generate/sanitize";
import type { EngagementKnobs, EngagementGoal } from "@/lib/engagement/knobs";

export interface ReplyTarget {
  authorHandle: string;
  post: string;
  reason: string;
}

const GOAL_EMPHASIS: Record<EngagementGoal, string> = {
  leads: "Goal: inbound leads. Position as a credible practitioner; end with a genuine question or offer to help. No sales pitch.",
  reach: "Goal: reach. Add a take saveable/quotable enough that others want to reply to YOU, not just agree.",
  authority: "Goal: authority. Bring depth — original data, a precise mechanism, or a counterexample.",
  followers: "Goal: followers. Be a sharp peer; a small specific insight that earns the profile click.",
  general: "Goal: steady growth. Add genuine, specific value.",
};

const SCENARIO_RECIPES = [
  "supportive — affirm in half a sentence, then add a fact/mechanism/example the post did not have.",
  "contrarian — disagree on substance with evidence, stay warm (never dunk). This best earns the author's reply.",
  "witty — one sharp ON-TOPIC line that reframes the post. No generic memes.",
  "technical — the precise practitioner detail/gotcha/number only an expert knows.",
  "question — a specific question that proves you read it and that the author will enjoy answering.",
].join("\n- ");

export function buildEngagementReplyPrompt(
  voiceSystem: string,
  target: ReplyTarget,
  knobs: EngagementKnobs,
): string {
  return [
    voiceSystem,
    UNTRUSTED_DATA_NOTICE,
    `OBJECTIVE: write a reply engineered to make the original author reply BACK to you — that is the highest-value signal on X (~150× a like). Aim for a response, not applause.`,
    GOAL_EMPHASIS[knobs.goal],
    knobs.replyPlaybook ? `The owner's hard reply rules (obey strictly):\n${sanitizeForPrompt(knobs.replyPlaybook, 1000)}` : "",
    `Reply to this post by ${sanitizeForPrompt(target.authorHandle, 100)} (${sanitizeForPrompt(target.reason, 200)}):\n${frameUntrusted(target.post)}`,
    `First, classify the post into ONE engagement scenario, then write the reply using that scenario's recipe:\n- ${SCENARIO_RECIPES}`,
    `Hard rules:\n- Standalone value: the reply must make sense even if nobody read the original.\n- Be specific (a number, example, named experience). Concise: 1-2 sentences.\n- NEVER open with or use slop: "great post", "this 🔥", "well said", "100%", "so true", bare emoji, or restating their point.\n- If you have nothing genuinely valuable to add, set skip:true.`,
    `Return exactly this JSON: {"reply": "...", "scenario": "supportive"|"contrarian"|"witty"|"technical"|"question", "skip": false} or {"skip": true}.`,
  ].filter(Boolean).join("\n\n");
}
