import { TweetUrl } from "@/lib/schemas";

// True only when the poster returned a real tweet status URL we can track.
export function isConfirmedTweetUrl(url: string): boolean {
  return TweetUrl.safeParse(url).success;
}
