// Manual-send URL builders. NO API write: these open X's first-party composer;
// the human taps Post. Verified-live 2026: intent/post + in_reply_to threads as a
// reply; x.com/<user>/status/<id> is intercepted by the native app.
// `in_reply_to` is absent from X's formal param reference (deprecation risk) — the
// caller feature-flags between this and the status-URL fallback.

const stripAt = (h: string): string => h.replace(/^@+/, "");

/** One-tap reply: opens the native composer pre-threaded under the target tweet. */
export function buildReplyIntentUrl(tweetId: string, authorHandle: string, draft: string): string {
  const text = encodeURIComponent(`@${stripAt(authorHandle)} ${draft}`);
  return `https://x.com/intent/post?in_reply_to=${encodeURIComponent(tweetId)}&text=${text}`;
}

/** Fallback: open the exact tweet (native app intercepts); human taps Reply + pastes. */
export function buildStatusUrl(authorHandle: string, tweetId: string): string {
  return `https://x.com/${stripAt(authorHandle)}/status/${encodeURIComponent(tweetId)}`;
}
