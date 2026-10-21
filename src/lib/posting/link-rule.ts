/**
 * Reach rule: a URL never rides in a main tweet body (X down-ranks link posts).
 * A trailing link is lifted into `drafts.link_url` and posted as reply 1.
 * Pure: no I/O.
 */

const URL_ANYWHERE = /(?:https?:\/\/|www\.)\S+/i;
// Body ends with a URL (optionally followed by sentence punctuation).
const TRAILING_URL = /^([\s\S]*?)\s*(https?:\/\/\S*?)[.,;:!?)"']*$/i;

export function bodyHasUrl(text: string): boolean {
  return URL_ANYWHERE.test(text);
}

export function extractTrailingLink(body: string): { text: string; link_url: string | null } {
  const trimmed = body.trim();
  const m = TRAILING_URL.exec(trimmed);
  if (!m) return { text: body, link_url: null };
  const text = m[1].trimEnd();
  // Another URL still in the body: leave it for the caller to refuse.
  if (bodyHasUrl(text)) return { text: body, link_url: null };
  return { text, link_url: m[2] };
}
