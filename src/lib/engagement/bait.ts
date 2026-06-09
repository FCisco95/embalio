/**
 * Heuristic bot/bait detector for reply targets. Returns a quality multiplier:
 * 1.0 = clean, substantive post; → 0 = engagement-farm / giveaway / choice-bait.
 * Text-only for v1 (the candidate snapshot has no author bio); author-signal
 * heuristics are a later enhancement. This is Embalio's "don't make me an
 * engagement bot" moat — see X Growth Engagement Playbook §3.
 */
const BAIT_PATTERNS: Array<{ re: RegExp; penalty: number }> = [
  { re: /\b(which|what)('?s| is| are)?\b.{0,40}\b(your )?(fav(ou?rite)?|pick|choice)\b/i, penalty: 0.55 }, // "X or Y, which's your fav?"
  { re: /\bdrop a?\s?(🔥|❤️|gm|comment|emoji)\b/i, penalty: 0.5 },
  { re: /\btag (a friend|someone|\d+)/i, penalty: 0.4 },
  { re: /\b(rt|retweet|repost)\b.{0,15}\b(follow|like)\b/i, penalty: 0.6 },
  { re: /\bfollow\b.{0,15}\b(rt|retweet|like|win)\b/i, penalty: 0.6 },
  { re: /\b(giveaway|airdrop|whitelist|free mint)\b/i, penalty: 0.6 },
  { re: /\b(comment|reply)\b.{0,12}\b(below|👇|if you)\b/i, penalty: 0.45 },
  { re: /\bwho('?s| is)?\s+with me\b/i, penalty: 0.35 },
];

export function baitScore(text: string): number {
  const t = (text ?? "").trim();
  if (!t) return 0.5; // unknown — neutral-ish, don't reward, don't hard-drop
  let score = 1;
  for (const { re, penalty } of BAIT_PATTERNS) {
    if (re.test(t)) score -= penalty;
  }
  // Emoji-spam signal: many emoji relative to length reads as farm content.
  const emoji = (t.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  if (emoji >= 4 && emoji / Math.max(1, t.length / 40) > 2) score -= 0.3;
  // Shout-y all-caps signal.
  const letters = t.replace(/[^a-z]/gi, "");
  if (letters.length > 20 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.5) score -= 0.2;
  return Math.max(0, Math.min(1, score));
}
