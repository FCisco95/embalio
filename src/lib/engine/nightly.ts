// Pure helpers for the nightly drafts job (scripts/nightly-drafts.ts).
// No I/O and no @/lib/supabase/server import: scripts/*.ts run outside Next.
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

export const MAX_BODY_STANDARD = 280;
export const MAX_BODY_PREMIUM = 4000;
export const DUPLICATE_THRESHOLD = 0.6;
export const DEFAULT_MAX_DRAFTS = 3;
export const QUEUE_WINDOW_HOURS = 20;

export const NightlyDraftItemSchema = z.object({
  body: z.string().min(1),
  angle: z.string(),
  rationale: z.string(),
  link_url: z.string().nullable(),
  suggested_hour_lisbon: z.number().int().min(6).max(22),
});
export const NightlyDraftsSchema = z.array(NightlyDraftItemSchema).min(1).max(3);
export type NightlyDraftItem = z.infer<typeof NightlyDraftItemSchema>;

// --- validation -------------------------------------------------------------

const wordSet = (s: string): Set<string> =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean),
  );

/** Word-set Jaccard similarity after lowercasing and stripping punctuation. */
export function jaccard(a: string, b: string): number {
  const A = wordSet(a);
  const B = wordSet(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function isNearDuplicate(body: string, others: string[]): boolean {
  return others.some((o) => jaccard(body, o) >= DUPLICATE_THRESHOLD);
}

/** A URL never rides in a draft body; links go to link_url. */
export function containsUrl(body: string): boolean {
  return /https?:\/\/|www\./i.test(body);
}

export interface RejectedItem {
  item: NightlyDraftItem;
  reason: string;
}

export function validateDraftItems(
  items: NightlyDraftItem[],
  opts: { premium: boolean; doNotRephrase: string[] },
): { accepted: NightlyDraftItem[]; rejected: RejectedItem[] } {
  const limit = opts.premium ? MAX_BODY_PREMIUM : MAX_BODY_STANDARD;
  const accepted: NightlyDraftItem[] = [];
  const rejected: RejectedItem[] = [];
  for (const item of items) {
    const reason = rejectionReason(item, limit, [...opts.doNotRephrase, ...accepted.map((a) => a.body)]);
    if (reason) rejected.push({ item, reason });
    else accepted.push(item);
  }
  return { accepted, rejected };
}

function rejectionReason(item: NightlyDraftItem, limit: number, seen: string[]): string | null {
  if (item.body.length > limit) return `length ${item.body.length} > ${limit}`;
  if (containsUrl(item.body)) return "url in body";
  if (!item.angle.trim()) return "empty angle";
  if (!item.rationale.trim()) return "empty rationale";
  if (isNearDuplicate(item.body, seen)) return "near-duplicate of existing text";
  return null;
}

// --- scheduling (Europe/Lisbon, no date library) ----------------------------

const lisbonFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Lisbon",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function lisbonParts(ms: number): { y: number; m: number; d: number; h: number; offsetMs: number } {
  const floored = Math.floor(ms / 1000) * 1000;
  const p: Record<string, number> = {};
  for (const part of lisbonFmt.formatToParts(new Date(floored))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return { y: p.year, m: p.month, d: p.day, h: p.hour, offsetMs: asUtc - floored };
}

/** UTC instant of `hour:00` on the given Lisbon calendar date (day may overflow). */
function lisbonWallToUtc(y: number, m: number, d: number, hour: number): number {
  const guess = Date.UTC(y, m - 1, d, hour);
  let t = guess - lisbonParts(guess).offsetMs;
  const off2 = lisbonParts(t).offsetMs;
  t = guess - off2; // re-evaluate once so a DST boundary between guess and t settles
  return t;
}

/**
 * Today (Lisbon) at `hour`:00 as a UTC ISO string; if that instant is not in the
 * future, the same hour tomorrow (Lisbon).
 */
export function computeScheduledAt(hour: number, now: Date): string {
  const { y, m, d } = lisbonParts(now.getTime());
  let t = lisbonWallToUtc(y, m, d, hour);
  if (t <= now.getTime()) t = lisbonWallToUtc(y, m, d + 1, hour);
  return new Date(t).toISOString();
}

// --- insert payload ---------------------------------------------------------

export type DraftInsert = Database["public"]["Tables"]["drafts"]["Insert"];

export function buildDraftInsert(item: NightlyDraftItem, profile: { id: string }, now: Date): DraftInsert {
  return {
    profile_id: profile.id,
    kind: "original",
    status: "draft",
    body: item.body.trim(),
    angle: item.angle.trim(),
    rationale: item.rationale.trim(),
    link_url: item.link_url,
    scheduled_at: computeScheduledAt(item.suggested_hour_lisbon, now),
    model_used: "claude-subscription",
  };
}

// --- job plumbing -----------------------------------------------------------

export function isEligibleProfile(p: { voice_spec: string | null; content_pillars: string[] | null }): boolean {
  return !!p.voice_spec?.trim() || (p.content_pillars?.length ?? 0) > 0;
}

export function clampMax(n: number | undefined): number {
  if (n === undefined || !Number.isFinite(n)) return DEFAULT_MAX_DRAFTS;
  return Math.min(3, Math.max(1, Math.trunc(n)));
}

export interface NightlyArgs {
  profile: string | undefined;
  dryRun: boolean;
  max: number;
}

export function parseNightlyArgs(argv: string[]): NightlyArgs {
  const valueOf = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const rawMax = valueOf("--max");
  return {
    profile: valueOf("--profile") || undefined,
    dryRun: argv.includes("--dry-run"),
    max: clampMax(rawMax === undefined ? undefined : Number(rawMax)),
  };
}
