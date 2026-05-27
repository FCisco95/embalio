export interface VoiceProfile {
  handle: string;
  niche_description: string | null;
  voice_corpus: string[];
  voice_notes: string | null;
}

export function buildVoiceSystem(p: VoiceProfile): string {
  const examples = p.voice_corpus.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return [
    `You write X (Twitter) posts as the account ${p.handle}.`,
    `Niche: ${p.niche_description ?? "general"}.`,
    p.voice_notes ? `Style guardrails: ${p.voice_notes}` : "",
    `Match the voice of these example posts exactly — cadence, casing, vocabulary:`,
    examples,
    `Never use hashtags unless the examples do. Never fabricate facts. Output must fit in one tweet (<=280 chars).`,
  ].filter(Boolean).join("\n\n");
}

export function buildReplyPrompt(targetTweet: string): string {
  return `Write a reply to this tweet that adds genuine value (a take, a question, or data), in the account's voice:\n\n"""${targetTweet}"""\n\nAlso suggest one visual that would strengthen the reply (a recommendation or an image-generation prompt), or omit if none fits.`;
}

export function buildOriginalPrompt(topic: string): string {
  return `Write an original post about: ${topic}\n\nIn the account's voice. Also suggest one visual (recommendation or image prompt) that would strengthen it, or omit if none fits.`;
}

import type { Angle } from "@/lib/schemas";

export function buildVoiceSystemFromSpec(p: { handle: string; voice_spec: string | null }): string {
  return [
    `You write X (Twitter) posts as the account ${p.handle}.`,
    `Follow this brand-voice spec exactly:`,
    p.voice_spec ?? "(no voice spec yet — be clear, specific, and non-generic)",
    `Never use hashtags unless the spec says to. Never fabricate facts. Each post must be <=280 chars.`,
  ].join("\n\n");
}

export function buildSynthesisPrompt(a: {
  niche: string; goals: string; tone: string; doDont?: string; admired?: string;
}): string {
  return [
    `Synthesize a reusable X brand-voice spec from this onboarding interview.`,
    `Niche: ${a.niche}`,
    `Goals/audience: ${a.goals}`,
    `Desired tone/style: ${a.tone}`,
    a.doDont ? `Do/Don't: ${a.doDont}` : "",
    a.admired ? `Admired accounts: ${a.admired}` : "",
    `Produce a concrete voiceSpec (casing, length, emoji/hashtag policy, cadence of ideas, what to avoid),`,
    `content pillars, seed accounts (@handles worth engaging in this niche, researched), and 2-3 sample posts in the voice.`,
    `Return exactly this JSON shape, where every array is an array of PLAIN STRINGS (not objects):`,
    `{"voiceSpec": "...", "contentPillars": ["..."], "seedAccounts": ["@handle"], "samplePosts": ["...", "..."]}`,
  ].filter(Boolean).join("\n");
}

export function buildAnglesPrompt(pillars: string[]): string {
  return [
    `Research the web for recent (last 7 days) developments across these niche pillars: ${pillars.join(", ")}.`,
    `Propose 3-5 distinct post angles. "experiment" = suggest a concrete thing to test and post about.`,
    `Write hooks as plain, direct sentences. No em dashes (—). No colons as drama. No "discover", "dive into", "explore", "game-changer", or hype words. Sound like a dev texting a peer, not a newsletter subject line.`,
    `Return exactly this JSON shape:`,
    `{"angles": [{"mode": "news-insight" | "experiment" | "build-in-public", "hook": "one line", "source": "https://..."}]}`,
    `("source" optional; include it when the angle is based on a web finding.)`,
  ].join("\n");
}

export function buildOriginalFromAnglePrompt(voiceSystem: string, angle: Angle): string {
  return [
    voiceSystem,
    ``,
    `Write an original X post for this angle (mode: ${angle.mode}): "${angle.hook}".`,
    angle.source ? `Source: ${angle.source}` : "",
    `Informative and specific. No generic filler. 1 post, or 2-5 for a short thread only if it genuinely needs it; each <=280 chars.`,
    `Capitalization: capitalize the first word of each sentence and each new line. Keep everything else lowercase except proper nouns, model names, repo names, and acronyms.`,
    `Anti-AI-tell rules: no em dashes (—), no "delve", "dive into", "explore", "tapestry", "game-changer", "revolutionary", "it's worth noting", "in conclusion". No rhetorical questions as hooks. Write like a human dev texting a peer — concrete, no performance.`,
    `Return exactly this JSON shape (posts is an array of plain strings):`,
    `{"posts": ["..."], "suggestedVisual": "..."}  ("suggestedVisual" optional.)`,
  ].filter(Boolean).join("\n");
}

import type { WeeklyAngle } from "@/lib/schemas";

export function buildCiscoContextBlock(
  profile: { handle: string; voice_spec: string | null; content_pillars: string[] },
  handoffText: string,
  journalEntry?: string
): string {
  return [
    `You are generating content for ${profile.handle}.`,
    `Voice spec: ${profile.voice_spec ?? "(none yet — be lowercase, concrete, first-person)"}`,
    `Content pillars: ${profile.content_pillars.join(", ")}`,
    `Current projects and context:\n${handoffText}`,
    journalEntry ? `What ${profile.handle} is working on this week: ${journalEntry}` : "",
  ].filter(Boolean).join("\n\n");
}

export function buildWorldResearchPrompt(thread: "x-topics" | "github" | "news", date: string): string {
  if (thread === "x-topics") {
    return `Search X/Twitter for the most discussed topics in AI, developer tools, and crypto right now. Today is ${date}. Only include posts from the last 48 hours — skip anything older. For each topic give: the subject, approximate engagement level (viral/high/medium), 1-2 representative post excerpts, and the date. Return 3-5 topics as plain text.`;
  }
  if (thread === "github") {
    return `Fetch https://github.com/trending and https://github.com/trending?since=weekly. Today is ${date}. Filter for repos related to: AI tools, agentic workflows, LLMs, developer infrastructure, crypto/web3 tooling. For each relevant repo give: name, star count, one-sentence description, and why a builder in AI/agentic/crypto might care. Return 3-5 repos as plain text.`;
  }
  return `Search for major tech announcements, model releases, pricing changes, and developer-relevant news from the last 48 hours. Today is ${date}. Focus on: Anthropic, OpenAI, AI tooling, developer infrastructure, crypto/web3. For each item give: headline, date, source URL, and a one-sentence summary. Return 3-5 items as plain text.`;
}

export function buildCrossRefSynthesisPrompt(
  ciscoContext: string,
  research: { xTopics: string; github: string; news: string },
  date: string
): string {
  return [
    ciscoContext,
    `---`,
    `Today is ${date}. Here is what is happening in the world right now:`,
    `X/Twitter hot topics:\n${research.xTopics}`,
    `GitHub trending:\n${research.github}`,
    `Tech news:\n${research.news}`,
    `---`,
    `Find 3-5 post angles for this week. One per format: quick-take, experiment, tool-find, observation, reaction.`,
    `Rules:`,
    `- Only propose an angle if the connection to this person is real, not forced.`,
    `- For "reaction": only include if this person directly uses or has experience with the thing discussed. Skip and add a second "observation" if not.`,
    `- For "tool-find": only include if a GitHub repo genuinely overlaps their work.`,
    `- Never pad to hit 5 — 3 strong angles beats 5 weak ones.`,
    `Return exactly this JSON shape:`,
    `{"angles": [{"format": "quick-take"|"experiment"|"tool-find"|"observation"|"reaction", "hook": "one line", "connection": "why this fits this person specifically", "source": "https://..." (optional), "sourceDate": "May 27, 2026" (optional)}]}`,
  ].filter(Boolean).join("\n\n");
}

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  "quick-take": `Write a quick-take post. 1-3 sentences max. No setup. State the opinion directly. Under 200 chars preferred.`,
  "experiment": `Write an experiment post. Structure: what I tried → what happened → what I learned. 4-8 sentences, one per line. End with one genuine question that invites replies ("anyone else hit this?" or "what do you use for X?").`,
  "tool-find": `Write a tool-find post about this repo/tool. Structure: what it is (one sentence) → what I find interesting about it specifically → what I'd use it for. 3-5 sentences. Must reference my specific context, not generic "useful for developers".`,
  "observation": `Write an observation post. Pattern I've noticed while building → what it means → my take. Use confident labeling ("that's not a coincidence, that's X"). Qualify honestly before the punch. Use a pivot question ("but for [your audience]?") to reframe if it fits. 4-8 sentences, one per line.`,
  "reaction": `Write a reaction post. Structure: before state → trigger/event → now state → numbers/proof if available. Narrative arc, one sentence per line. Suggest a suggestedVisual if there is a screenshot or metric I could attach.`,
};

export function buildWeeklyDraftPrompt(
  voiceSystem: string,
  angle: Pick<WeeklyAngle, "format" | "hook" | "source" | "sourceDate">,
  algorithmRules: string
): string {
  return [
    voiceSystem,
    `Write a post for this angle (format: ${angle.format}): "${angle.hook}"`,
    angle.source ? `Source: ${angle.source}${angle.sourceDate ? ` (${angle.sourceDate})` : ""}` : "",
    FORMAT_INSTRUCTIONS[angle.format] ?? "",
    algorithmRules,
    `Anti-AI-tell rules: no em dashes (—), no "delve", "game-changer", "revolutionary", "it's worth noting", "in conclusion". No rhetorical questions as hooks. Write like a builder texting a peer.`,
    `Voice rules: lowercase sentence starts. first-person ("I ran X" not "X has been shown to"). one sentence per line for multi-line posts. specific over vague — name the tool, the number, the date. real numbers when available. max 1 emoji, only if genuinely earned.`,
    `Return exactly this JSON: {"posts": ["..."], "suggestedVisual": "..."} (suggestedVisual optional.)`,
  ].filter(Boolean).join("\n\n");
}

export function buildAlgorithmRulesBlock(_format: string): string {
  return "";
}

export function buildSeedScanPrompt(handles: string[], date: string): string {
  return [
    `Search X/Twitter for recent posts from these accounts: ${handles.join(", ")}.`,
    `Today is ${date}. Only include posts from the last 24 hours — skip anything older.`,
    `For each post found, give: author handle, the post text, approximate like count, post date/time, and post URL if available.`,
    `Focus on posts that ask questions, make technical claims, share data, or make statements that a builder in AI/dev/crypto could add genuine technical information to.`,
    `Return as plain text, one post per section.`,
  ].join("\n");
}

export function buildReplyFilterPrompt(scannedPosts: string, ciscoContext: string): string {
  return [
    ciscoContext,
    `---`,
    `Here are recent posts from seed accounts:\n${scannedPosts}`,
    `---`,
    `Select 3-5 posts worth replying to. A post is worth replying to if:`,
    `1. This person has direct technical knowledge about the topic`,
    `2. The reply would add information the original post did not have`,
    `3. The post has engagement potential (asking a question, making a claim, inviting discussion)`,
    `4. The post is recent (less than 24h old)`,
    `Skip posts that are: pure reshares, opinions with no technical hook, or topics this person has no specific knowledge about.`,
    `Return exactly this JSON:`,
    `{"opportunities": [{"targetHandle": "@handle", "targetPost": "the post text", "targetUrl": "url or empty string", "targetLikes": 0, "postedAt": "date string", "reason": "one sentence: why reply here"}]}`,
  ].filter(Boolean).join("\n\n");
}

export function buildReplyDraftPrompt(
  voiceSystem: string,
  opportunity: { targetHandle: string; targetPost: string; reason: string }
): string {
  return [
    voiceSystem,
    `Draft a reply to this post by ${opportunity.targetHandle}:\n"${opportunity.targetPost}"`,
    `Reply rules:`,
    `- Start with the core technical fact. No "great question", no wind-up, no restating what they said.`,
    `- Second sentence explains the implication of that fact, or gives a contrast.`,
    `- Stop at 2-4 sentences. Do not list multiple reasons.`,
    `- If you have nothing genuinely technical or specific to add, return {"skip": true} instead.`,
    `- Never sycophantic openers. Never summarize the original post. Add information it did not have.`,
    `Return exactly this JSON: {"reply": "...", "skip": false} or {"skip": true}`,
  ].filter(Boolean).join("\n\n");
}
