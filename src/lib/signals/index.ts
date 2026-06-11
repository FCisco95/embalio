import { makeApifySource } from "@/lib/signals/apify-source";
import { makeTwitterapiSource } from "@/lib/signals/twitterapi-source";
import { makeGrokSource } from "@/lib/signals/grok-source";
import type { SignalSource } from "@/lib/signals/types";

export type { SignalSource, SignalTweet, SignalSourceId } from "@/lib/signals/types";

export function getSignalSource(): SignalSource {
  const key = process.env.SIGNAL_SOURCE ?? "apify";
  if (key === "apify") return makeApifySource();
  if (key === "twitterapi") return makeTwitterapiSource();
  if (key === "grok") return makeGrokSource();
  throw new Error(`unknown SIGNAL_SOURCE: ${key}`);
}
