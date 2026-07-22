/**
 * Manual sniper mode — the owner pastes a tweet URL while browsing X (zero
 * Apify). Pure helpers only: URL → id/handle, and manual-entry fields →
 * TargetScoreInputs so the same targetScore() judges manual and polled
 * targets identically. Unknown fields default to score.ts's neutral values
 * (0 followers → sizeFit 1 / followback 0.5; age 0 → full recency — the
 * owner is looking at the tweet right now).
 */
import type { TargetScoreInputs } from "./score";

export interface ParsedTweetUrl {
  tweetId: string;
  authorHandle: string;
}

const TWEET_URL_RE =
  /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d+)(?:\/|\?|#|$)/i;

/** x.com / twitter.com status URL → id + handle; null when unrecognized (incl. handle-less /i/… links). */
export function parseTweetUrl(raw: string): ParsedTweetUrl | null {
  const m = TWEET_URL_RE.exec(raw.trim());
  if (!m) return null;
  const [, authorHandle, tweetId] = m;
  if (authorHandle.toLowerCase() === "i") return null; // x.com/i/status/<id> has no author handle
  return { tweetId, authorHandle };
}

export interface ManualTargetFields {
  ageMinutes?: number | null;
  replyCount?: number | null;
  authorFollowers?: number | null;
}

/** Manual-entry fields (all optional) → the exact input shape targetScore() expects. */
export function manualScoreInputs(
  fields: ManualTargetFields,
  relevance: number,
  ownerFollowers: number,
  bait: number,
): TargetScoreInputs {
  const ageMinutes = fields.ageMinutes ?? 0;
  const replyCount = fields.replyCount ?? 0;
  // Same velocity formula as pickAlerts (server/sniper.ts): 1-minute floor.
  const repliesPerHour = replyCount / Math.max(1 / 60, ageMinutes / 60);
  return {
    relevance,
    ageMinutes,
    replyCount,
    repliesPerHour,
    authorFollowers: fields.authorFollowers ?? 0,
    ownerFollowers,
    bait,
  };
}
