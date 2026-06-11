import type { SignalSource } from "@/lib/signals/types";

/** Slot for Grok live search — filled when the xAI integration lands. */
export function makeGrokSource(): SignalSource {
  return {
    id: "grok",
    async pullAuthorTweets() { throw new Error("grok source not implemented yet"); },
    async pullTweetMetrics() { throw new Error("grok source not implemented yet"); },
  };
}
