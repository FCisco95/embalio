import type { SignalSource } from "@/lib/signals/types";

/** Slot for twitterapi.io — filled when revenue funds the upgrade (spec decision 12). */
export function makeTwitterapiSource(): SignalSource {
  return {
    id: "twitterapi",
    async pullAuthorTweets() { throw new Error("twitterapi source not implemented yet"); },
    async pullTweetMetrics() { throw new Error("twitterapi source not implemented yet"); },
  };
}
