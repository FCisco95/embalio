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
