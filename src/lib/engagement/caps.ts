// Engagement Playbook hard caps (enforced, not coached): <=50/day, <=20/hr,
// <=3 to the same account/day, no links in replies, no near-identical replies.
// Semantics (owner decision 2026-06-23): a cap blocks when the count of prior
// acted sends in the window is >= the cap (i.e. up to `cap` are allowed, the next
// is refused). Pure: the server layer supplies `recent` (acted sends in last 24h).

const DAY = 86_400_000;
const HOUR = 3_600_000;
export const CAPS = { perDay: 50, perHour: 20, perAccountPerDay: 3, nearDupThreshold: 0.8 };

export type CapBlock = "daily" | "hourly" | "per_account" | "link" | "near_duplicate";

export interface SentAction {
  authorHandle: string;
  sentAt: number; // epoch ms
  replyText: string;
}
export interface CapInput {
  now: number;
  draft: string;
  targetHandle: string;
  recent: SentAction[]; // acted sends, last 24h, same profile
}
export interface CapVerdict {
  ok: boolean;
  blocks: CapBlock[];
}

const LINK_RE = /(https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|io|net|org|co|app|dev|xyz|ai|gg)\b)/i;
export function hasLink(text: string): boolean {
  return LINK_RE.test(text);
}

const words = (t: string): Set<string> =>
  new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean));

/** Jaccard overlap of word sets, 0..1. */
export function similarity(a: string, b: string): number {
  const A = words(a), B = words(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

const norm = (h: string): string => h.replace(/^@+/, "").toLowerCase();

export function checkCaps(i: CapInput): CapVerdict {
  const blocks: CapBlock[] = [];
  const dayCut = i.now - DAY;
  const hourCut = i.now - HOUR;
  const inDay = i.recent.filter((r) => r.sentAt > dayCut);

  if (inDay.length >= CAPS.perDay) blocks.push("daily");
  if (inDay.filter((r) => r.sentAt > hourCut).length >= CAPS.perHour) blocks.push("hourly");
  if (inDay.filter((r) => norm(r.authorHandle) === norm(i.targetHandle)).length >= CAPS.perAccountPerDay)
    blocks.push("per_account");
  if (hasLink(i.draft)) blocks.push("link");
  if (inDay.some((r) => similarity(i.draft, r.replyText) >= CAPS.nearDupThreshold))
    blocks.push("near_duplicate");

  return { ok: blocks.length === 0, blocks };
}
