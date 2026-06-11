import { AnalyticsDay } from "./schemas";

export interface RejectedRow {
  line: number; // 1-based — matches what a spreadsheet shows
  reason: string;
  raw: string;
}

export interface CsvParseResult {
  rows: AnalyticsDay[];
  rejected: RejectedRow[];
}

/** Header problem = the whole file is refused (spec: column renames fail loudly). */
export class CsvHeaderError extends Error {}

const REQUIRED = ["date", "profile_visits", "new_follows"] as const;

// normalized header → canonical column. X renames export columns quarterly;
// extend this map when it does — never silently guess a column's meaning.
const HEADER_ALIASES: Record<string, string> = {
  date: "date",
  "profile visits": "profile_visits",
  "new follows": "new_follows",
  follows: "new_follows",
  unfollows: "unfollows",
  impressions: "impressions",
  engagements: "engagements",
  likes: "likes",
  replies: "replies",
  reposts: "reposts",
  retweets: "reposts",
  bookmarks: "bookmarks",
  shares: "shares",
};

const normalizeHeader = (h: string) => h.replace(/^﻿/, "").trim().toLowerCase().replace(/\s+/g, " ");

/** Split one CSV line honoring double-quoted cells ("" = escaped quote). Null on unbalanced quotes. */
export function splitCsvLine(line: string): string[] | null {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  if (inQuotes) return null;
  out.push(cur);
  return out;
}

/**
 * "Sat, Jun 6, 2026" | "2026-06-06" → "2026-06-06". Uses local date fields,
 * never toISOString() — UTC conversion can shift the day in TZs ahead of UTC.
 */
export function normalizeCsvDate(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return Number.isFinite(Date.parse(`${t}T00:00:00Z`)) ? t : null;
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Header-tolerant, fail-loud parser for X's native account-analytics CSV.
 * Header issues throw CsvHeaderError (whole file refused); bad rows land in
 * `rejected` with line + reason (reported loudly upstream, never dropped
 * silently). Limitation: cells cannot contain newlines — X's export never
 * does, and an unbalanced quote rejects the row rather than corrupting it.
 */
export function parseAnalyticsCsv(text: string): CsvParseResult {
  const lines = text.split(/\r\n|\n|\r/);
  const headerIdx = lines.findIndex((l) => l.trim() !== "");
  if (headerIdx === -1) throw new CsvHeaderError("CSV is empty");
  const headerCells = splitCsvLine(lines[headerIdx]);
  if (!headerCells) throw new CsvHeaderError("CSV header has unbalanced quotes");

  const colFor = new Map<number, string>();
  const taken = new Set<string>();
  for (let i = 0; i < headerCells.length; i++) {
    const canonical = HEADER_ALIASES[normalizeHeader(headerCells[i])];
    if (canonical && !taken.has(canonical)) { colFor.set(i, canonical); taken.add(canonical); }
  }
  const missing = REQUIRED.filter((k) => !taken.has(k));
  if (missing.length > 0) {
    throw new CsvHeaderError(
      `CSV is missing required column(s): ${missing.join(", ")}. ` +
        `Found headers: ${headerCells.map(normalizeHeader).join(" | ")}. ` +
        `X may have renamed its export columns — update HEADER_ALIASES in src/lib/kpis/csv.ts.`,
    );
  }

  const rows: AnalyticsDay[] = [];
  const rejected: RejectedRow[] = [];
  const seenDates = new Set<string>();
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === "") continue;
    const line = i + 1;
    const cells = splitCsvLine(raw);
    if (!cells) { rejected.push({ line, reason: "unbalanced quotes", raw }); continue; }

    const rec: Record<string, string> = {};
    for (const [idx, key] of colFor) rec[key] = (cells[idx] ?? "").trim();

    const date = normalizeCsvDate(rec.date ?? "");
    if (!date) { rejected.push({ line, reason: `unparseable date "${rec.date ?? ""}"`, raw }); continue; }
    if (seenDates.has(date)) { rejected.push({ line, reason: `duplicate date ${date}`, raw }); continue; }

    // Empty optional cells are dropped (→ undefined); an empty REQUIRED cell
    // is also dropped so the schema rejects with the field name in the reason.
    const candidate: Record<string, unknown> = { date };
    for (const key of Object.keys(rec)) {
      if (key !== "date" && rec[key] !== "") candidate[key] = rec[key];
    }
    const parsed = AnalyticsDay.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      rejected.push({ line, reason: `${issue.path.join(".")}: ${issue.message}`, raw });
      continue;
    }
    seenDates.add(date);
    rows.push(parsed.data);
  }
  return { rows, rejected };
}
