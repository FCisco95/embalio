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
    `Informative and specific — no generic filler. 1 post, or 2-5 for a short thread only if it genuinely needs it; each <=280 chars.`,
    `Return exactly this JSON shape (posts is an array of plain strings):`,
    `{"posts": ["..."], "suggestedVisual": "..."}  ("suggestedVisual" optional.)`,
  ].filter(Boolean).join("\n");
}
