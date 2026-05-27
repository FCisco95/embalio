import { generateStructured } from "@/lib/generate";
import { DraftOutput } from "@/lib/schemas";
import {
  buildVoiceSystem, buildVoiceSystemFromSpec, buildReplyPrompt, buildOriginalPrompt, type VoiceProfile,
} from "@/lib/voice-prompt";

export interface DraftResult extends DraftOutput { model_used: string }

type Profile = VoiceProfile & { voice_spec?: string | null };

function systemFor(p: Profile): string {
  return p.voice_spec ? buildVoiceSystemFromSpec({ handle: p.handle, voice_spec: p.voice_spec }) : buildVoiceSystem(p);
}

async function run(profile: Profile, userPrompt: string): Promise<DraftResult> {
  const prompt = `${systemFor(profile)}\n\n${userPrompt}\n\nReturn JSON: { "body": string (<=280), "suggestedVisual"?: string }.`;
  const r = await generateStructured(DraftOutput, prompt);
  if (!r.data) throw new Error("model did not return a valid draft");
  return { ...r.data, model_used: process.env.GEN_BACKEND ?? "subscription" };
}

export function draftReply(profile: Profile, targetTweet: string): Promise<DraftResult> {
  return run(profile, buildReplyPrompt(targetTweet));
}
export function draftOriginal(profile: Profile, topic: string): Promise<DraftResult> {
  return run(profile, buildOriginalPrompt(topic));
}
