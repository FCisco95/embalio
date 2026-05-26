import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { DraftOutput } from "@/lib/schemas";
import { MODELS } from "@/lib/models";
import {
  buildVoiceSystem,
  buildReplyPrompt,
  buildOriginalPrompt,
  type VoiceProfile,
} from "@/lib/voice-prompt";

export interface DraftResult extends DraftOutput {
  model_used: string;
}

async function run(profile: VoiceProfile, userPrompt: string): Promise<DraftResult> {
  const { object } = await generateObject({
    model: anthropic(MODELS.draft),
    schema: DraftOutput,
    system: {
      role: "system",
      content: buildVoiceSystem(profile),
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    messages: [{ role: "user", content: userPrompt }],
  });
  return { ...object, model_used: MODELS.draft };
}

export function draftReply(profile: VoiceProfile, targetTweet: string): Promise<DraftResult> {
  return run(profile, buildReplyPrompt(targetTweet));
}

export function draftOriginal(profile: VoiceProfile, topic: string): Promise<DraftResult> {
  return run(profile, buildOriginalPrompt(topic));
}
