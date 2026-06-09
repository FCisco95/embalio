# Daily Nudge + Telegram Callback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the two remaining locked Phase-1b pieces — a loss-framed daily nudge and the (currently dead) Telegram Posted/Skip callback — on `feat/nudge-telegram-callback`.

**Architecture:** Mirrors Phase 1a — pure logic in `src/lib/**` under unit test, thin server seams in `src/server/**`, `CRON_SECRET`-gated routes for local triggers. Nudge state + the getUpdates cursor live in a new additive `retention jsonb` column on `profiles`. The Telegram callback reuses sibling-owned `markRepliedQuick`/`dismissCandidate` from `posts.ts` (import only — never edit that file).

**Tech Stack:** Next.js 16 (App Router, server actions), Supabase, Vitest, the existing `@/lib/telegram` + `@/lib/cron-auth`.

**Spec:** `docs/superpowers/specs/2026-06-09-streak-nudge-telegram-callback-design.md`

**Coordination invariants (do not violate):**
- Never edit `src/server/posts.ts`, `src/components/shell/*`, streak/reward/radar/engage files. Import `markRepliedQuick`, `dismissCandidate` from `posts.ts`.
- `getStreak(profileId): Promise<number>` is a read-only contract.
- `types.ts` edits are additive to `profiles` only; leave `posts.tweet_url` nullable.

---

### Task 1: Migration + types reflection for `retention`

**Files:**
- Create: `supabase/migrations/20260609_profiles_retention.sql`
- Modify: `src/lib/supabase/types.ts` (the `profiles` Row/Insert/Update only)

- [ ] **Step 1: Write the migration**

```sql
-- Additive: per-profile retention bookkeeping (nudge state + Telegram getUpdates cursor).
alter table profiles
  add column if not exists retention jsonb not null default '{}'::jsonb;
```

- [ ] **Step 2: Apply it to the live DB**

Apply via the Supabase MCP `apply_migration` (name `profiles_retention`, project `vzxpakxjnuaesfxihyvl`) — the DDL is additive and safe. If the MCP is unavailable, leave it for the owner and note it in the final report.

- [ ] **Step 3: Reflect into `types.ts` (additive)**

In `src/lib/supabase/types.ts`, in the `profiles` table types, add `retention: Json` to `Row`, and `retention?: Json` to `Insert` and `Update`. Do not touch any other table. (Find the `profiles:` block; add the field beside the existing jsonb columns like `growth_plan`.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no errors).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260609_profiles_retention.sql src/lib/supabase/types.ts
git commit -m "feat(retention): add profiles.retention jsonb (nudge state + tg offset)"
```

---

### Task 2: Local-date helper

**Files:**
- Create: `src/lib/retention/date.ts`
- Test: `src/lib/retention/date.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { localDate, isSameLocalDay } from "@/lib/retention/date";

describe("localDate", () => {
  it("formats a Date as server-local YYYY-MM-DD", () => {
    expect(localDate(new Date(2026, 5, 9, 23, 59))).toBe("2026-06-09");
    expect(localDate(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
  it("isSameLocalDay ignores time of day", () => {
    expect(isSameLocalDay(new Date(2026, 5, 9, 1), new Date(2026, 5, 9, 23))).toBe(true);
    expect(isSameLocalDay(new Date(2026, 5, 9), new Date(2026, 5, 10))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/retention/date.test.ts`
Expected: FAIL ("Failed to resolve import" / `localDate` is not a function).

- [ ] **Step 3: Write minimal implementation**

```ts
/** Server-local calendar day as 'YYYY-MM-DD' (matches the coach's isToday boundary). */
export function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return localDate(a) === localDate(b);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/retention/date.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/retention/date.ts src/lib/retention/date.test.ts
git commit -m "feat(retention): local-date helper"
```

---

### Task 3: Nudge engine (pure `evaluateNudge`)

**Files:**
- Create: `src/lib/nudge.ts`
- Test: `src/lib/nudge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { evaluateNudge, DEFAULT_NUDGE, type NudgeState, type NudgeSignals } from "@/lib/nudge";

const sig = (over: Partial<NudgeSignals> = {}): NudgeSignals => ({
  today: "2026-06-09", yesterday: "2026-06-08", hour: 9,
  hadActionToday: false, hadActionYesterday: false, streakCurrent: 0, ...over,
});

describe("evaluateNudge", () => {
  it("sends a gentle starter when no streak yet", () => {
    const r = evaluateNudge(DEFAULT_NUDGE, sig({ streakCurrent: 0 }));
    expect(r.send).toBe(true);
    expect(r.text).toMatch(/streak going/i);
    expect(r.nudge.lastSentDate).toBe("2026-06-09");
  });

  it("loss-frames once the streak is >= 2", () => {
    const r = evaluateNudge(DEFAULT_NUDGE, sig({ streakCurrent: 12 }));
    expect(r.text).toMatch(/12-day streak/);
  });

  it("does not send before sendHour", () => {
    const r = evaluateNudge(DEFAULT_NUDGE, sig({ hour: 8 }));
    expect(r.send).toBe(false);
  });

  it("does not send twice in a day", () => {
    const prev: NudgeState = { ...DEFAULT_NUDGE, lastSentDate: "2026-06-09" };
    expect(evaluateNudge(prev, sig()).send).toBe(false);
  });

  it("does not nag once the user has acted today", () => {
    const r = evaluateNudge(DEFAULT_NUDGE, sig({ hadActionToday: true }));
    expect(r.send).toBe(false);
  });

  it("counts an ignore when yesterday's nudge produced no action", () => {
    const prev: NudgeState = { ...DEFAULT_NUDGE, lastSentDate: "2026-06-08", consecutiveIgnored: 0 };
    const r = evaluateNudge(prev, sig({ hadActionYesterday: false }));
    expect(r.nudge.consecutiveIgnored).toBe(1);
  });

  it("silently opts out after the 5th ignore", () => {
    const prev: NudgeState = { ...DEFAULT_NUDGE, lastSentDate: "2026-06-08", consecutiveIgnored: 4 };
    const r = evaluateNudge(prev, sig({ hadActionYesterday: false }));
    expect(r.nudge.optedOut).toBe(true);
    expect(r.send).toBe(false);
  });

  it("re-opts-in and resets the counter on any real action", () => {
    const prev: NudgeState = { ...DEFAULT_NUDGE, optedOut: true, consecutiveIgnored: 7 };
    const r = evaluateNudge(prev, sig({ hadActionToday: true }));
    expect(r.nudge.optedOut).toBe(false);
    expect(r.nudge.consecutiveIgnored).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/nudge.test.ts`
Expected: FAIL (cannot resolve `@/lib/nudge`).

- [ ] **Step 3: Write minimal implementation**

```ts
export interface NudgeState {
  lastSentDate: string | null;
  consecutiveIgnored: number;
  optedOut: boolean;
  sendHour: number;
}

export const DEFAULT_NUDGE: NudgeState = {
  lastSentDate: null, consecutiveIgnored: 0, optedOut: false, sendHour: 9,
};

export interface NudgeSignals {
  today: string;             // localDate(now)
  yesterday: string;         // localDate(now - 1 day)
  hour: number;              // now.getHours()
  hadActionToday: boolean;
  hadActionYesterday: boolean;
  streakCurrent: number;
}

export interface NudgeResult { nudge: NudgeState; send: boolean; text?: string }

const OPT_OUT_AFTER = 5;

/**
 * The whole nudge policy in one pure pass: accrue an ignore for an unanswered
 * prior-day nudge, re-opt-in on any real action, then decide today's single
 * loss-framed send. Returns the next state (lastSentDate stamped when send=true)
 * so the seam can persist it unconditionally.
 */
export function evaluateNudge(prev: NudgeState, s: NudgeSignals): NudgeResult {
  let nudge: NudgeState = { ...prev };

  // 1. Lazy ignore accounting — a nudge sent yesterday that drew no action.
  if (nudge.lastSentDate === s.yesterday && !s.hadActionYesterday) {
    nudge.consecutiveIgnored += 1;
    if (nudge.consecutiveIgnored >= OPT_OUT_AFTER) nudge.optedOut = true;
  }

  // 2. Reward action: any real action re-opts-in and resets the counter.
  if (s.hadActionToday) {
    nudge.consecutiveIgnored = 0;
    nudge.optedOut = false;
  }

  // 3. Decide today's single send.
  const send =
    s.hour >= nudge.sendHour &&
    nudge.lastSentDate !== s.today &&
    !nudge.optedOut &&
    !s.hadActionToday;

  if (!send) return { nudge, send: false };

  const text =
    s.streakCurrent >= 2
      ? `🔥 Don't lose your ${s.streakCurrent}-day streak — one reply keeps it alive.`
      : `One post or reply today gets your streak going.`;

  nudge = { ...nudge, lastSentDate: s.today };
  return { nudge, send: true, text };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/nudge.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nudge.ts src/lib/nudge.test.ts
git commit -m "feat(nudge): pure evaluateNudge — gate, frame, opt-out, re-opt-in"
```

---

### Task 4: Telegram callback parser (pure)

**Files:**
- Create: `src/lib/telegram-callback.ts`
- Test: `src/lib/telegram-callback.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseCallback } from "@/lib/telegram-callback";

describe("parseCallback", () => {
  it("parses a posted payload", () => {
    expect(parseCallback("posted:abc-123")).toEqual({ action: "posted", candidateId: "abc-123" });
  });
  it("parses a skip payload", () => {
    expect(parseCallback("skip:xyz")).toEqual({ action: "skip", candidateId: "xyz" });
  });
  it("returns null for anything else", () => {
    expect(parseCallback("regen:1")).toBeNull();
    expect(parseCallback("posted:")).toBeNull();
    expect(parseCallback("garbage")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/telegram-callback.test.ts`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write minimal implementation**

```ts
export interface ParsedCallback { action: "posted" | "skip"; candidateId: string }

/** Parse the inline-button payloads runPulse already emits: `posted:<id>` / `skip:<id>`. */
export function parseCallback(data: string): ParsedCallback | null {
  const m = /^(posted|skip):(.+)$/.exec(data);
  if (!m) return null;
  return { action: m[1] as "posted" | "skip", candidateId: m[2] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/telegram-callback.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram-callback.ts src/lib/telegram-callback.test.ts
git commit -m "feat(telegram): pure parseCallback for posted/skip payloads"
```

---

### Task 5: Telegram getUpdates + answerCallbackQuery

**Files:**
- Modify: `src/lib/telegram.ts` (append new exports; do not change `sendTelegram`)
- Modify: `src/lib/telegram.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing test (append to `src/lib/telegram.test.ts`)**

```ts
import { getTelegramUpdates, answerCallbackQuery } from "./telegram";

function updatesResponse(result: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve({ ok: true, result }) } as unknown as Response;
}

describe("getTelegramUpdates", () => {
  it("returns callback queries and the next offset", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(updatesResponse([
      { update_id: 41, callback_query: { id: "q1", data: "posted:c1", message: { message_id: 7, chat: { id: 555 } } } },
      { update_id: 42, message: { text: "ignored non-callback" } },
    ]));
    const r = await getTelegramUpdates(0, { fetchImpl });
    expect(r.nextOffset).toBe(43);
    expect(r.callbacks).toEqual([{ id: "q1", data: "posted:c1", messageId: 7, chatId: 555 }]);
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toContain("/bot123:ABC/getUpdates");
    expect(url).toContain("offset=0");
  });

  it("keeps the same offset when there are no updates", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(updatesResponse([]));
    const r = await getTelegramUpdates(99, { fetchImpl });
    expect(r.nextOffset).toBe(99);
    expect(r.callbacks).toEqual([]);
  });
});

describe("answerCallbackQuery", () => {
  it("posts the callback id and optional toast text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve("{}") } as unknown as Response);
    await answerCallbackQuery("q1", "✅ Logged", { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:ABC/answerCallbackQuery");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ callback_query_id: "q1", text: "✅ Logged" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/telegram.test.ts`
Expected: FAIL (`getTelegramUpdates` is not a function).

- [ ] **Step 3: Write minimal implementation (append to `src/lib/telegram.ts`)**

```ts
export interface TelegramCallback { id: string; data: string; messageId: number; chatId: number }
export interface TelegramUpdatesResult { callbacks: TelegramCallback[]; nextOffset: number }

interface RawUpdate {
  update_id: number;
  callback_query?: { id: string; data?: string; message?: { message_id: number; chat: { id: number } } };
}

/**
 * Pull pending updates via long-poll getUpdates (timeout=0 = immediate return).
 * Returns only callback_query updates plus the offset to pass next time
 * (highest update_id + 1) so each update is processed exactly once.
 */
export async function getTelegramUpdates(
  offset: number,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<TelegramUpdatesResult> {
  const { token } = config();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(`${API_BASE}/bot${token}/getUpdates?offset=${offset}&timeout=0`, { method: "GET" });
  if (!res.ok) throw new Error(`Telegram getUpdates failed (${res.status})`);
  const json = (await res.json()) as { result?: RawUpdate[] };
  const callbacks: TelegramCallback[] = [];
  let nextOffset = offset;
  for (const u of json.result ?? []) {
    nextOffset = u.update_id + 1;
    const cq = u.callback_query;
    if (cq?.data && cq.message) {
      callbacks.push({ id: cq.id, data: cq.data, messageId: cq.message.message_id, chatId: cq.message.chat.id });
    }
  }
  return { callbacks, nextOffset };
}

/** Acknowledge a tapped inline button (clears the button's loading spinner + optional toast). */
export async function answerCallbackQuery(
  id: string,
  text?: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<void> {
  const { token } = config();
  const fetchImpl = opts.fetchImpl ?? fetch;
  await fetchImpl(`${API_BASE}/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ callback_query_id: id, text }),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/telegram.test.ts`
Expected: PASS (existing `sendTelegram` tests + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram.ts src/lib/telegram.test.ts
git commit -m "feat(telegram): getTelegramUpdates + answerCallbackQuery (getUpdates transport)"
```

---

### Task 6: Nudge seam — `runNudge`

**Files:**
- Create: `src/server/nudge.ts`
- Test: `src/server/nudge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendTelegram = vi.fn();
const getStreak = vi.fn();
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => sendTelegram(...a) }));
vi.mock("@/server/streak", () => ({ getStreak: (...a: unknown[]) => getStreak(...a) }));

const profileRow = { data: { retention: {} } as Record<string, unknown> | null };
const postsRows = { data: [] as Array<{ posted_at: string | null }> };
const updateSpy = vi.fn();

function makeFrom() {
  return (table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve(profileRow) }) }),
        update: (vals: unknown) => ({ eq: () => { updateSpy(vals); return Promise.resolve({ error: null }); } }),
      };
    }
    // posts
    return { select: () => ({ eq: () => Promise.resolve(postsRows) }) };
  };
}
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ from: makeFrom() }) }));

import { runNudge } from "@/server/nudge";

beforeEach(() => {
  sendTelegram.mockReset();
  getStreak.mockReset().mockResolvedValue(0);
  updateSpy.mockReset();
  profileRow.data = { retention: { nudge: { lastSentDate: null, consecutiveIgnored: 0, optedOut: false, sendHour: 0 } } };
  postsRows.data = [];
});

describe("runNudge", () => {
  it("sends and stamps lastSentDate when the gate passes", async () => {
    const r = await runNudge("p1");
    expect(r.sent).toBe(true);
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalled();
  });

  it("does not send when an action already happened today", async () => {
    postsRows.data = [{ posted_at: new Date().toISOString() }];
    const r = await runNudge("p1");
    expect(r.sent).toBe(false);
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("fails safe (no throw) on a telegram error", async () => {
    sendTelegram.mockRejectedValue(new Error("boom"));
    const r = await runNudge("p1");
    expect(r.sent).toBe(false);
    expect(r.error).toContain("boom");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/nudge.test.ts`
Expected: FAIL (cannot resolve `@/server/nudge`).

- [ ] **Step 3: Write minimal implementation**

```ts
"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendTelegram } from "@/lib/telegram";
import { getStreak } from "@/server/streak";
import { evaluateNudge, DEFAULT_NUDGE, type NudgeState } from "@/lib/nudge";
import { localDate } from "@/lib/retention/date";

export async function runNudge(profileId: string): Promise<{ sent: boolean; error?: string }> {
  try {
    const sb = await supabaseServer();
    const { data: profile } = await sb.from("profiles").select("retention").eq("id", profileId).single();
    const retention = (profile?.retention ?? {}) as { nudge?: Partial<NudgeState> };
    const prev: NudgeState = { ...DEFAULT_NUDGE, ...(retention.nudge ?? {}) };

    const now = new Date();
    const today = localDate(now);
    const yDate = new Date(now);
    yDate.setDate(yDate.getDate() - 1);
    const yesterday = localDate(yDate);

    const { data: posts } = await sb.from("posts").select("posted_at").eq("profile_id", profileId);
    const days = new Set(
      (posts ?? [])
        .map((p: { posted_at: string | null }) => p.posted_at)
        .filter((d): d is string => d != null)
        .map((iso) => localDate(new Date(iso))),
    );

    const streakCurrent = await getStreak(profileId);

    const result = evaluateNudge(prev, {
      today, yesterday, hour: now.getHours(),
      hadActionToday: days.has(today), hadActionYesterday: days.has(yesterday), streakCurrent,
    });

    if (result.send && result.text) await sendTelegram(result.text);

    await sb.from("profiles").update({ retention: { ...retention, nudge: result.nudge } }).eq("id", profileId);
    return { sent: result.send };
  } catch (err) {
    console.error("runNudge failed:", String(err).slice(0, 200));
    return { sent: false, error: String(err).slice(0, 200) };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/nudge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/nudge.ts src/server/nudge.test.ts
git commit -m "feat(nudge): runNudge seam — posts/streak read, send, persist, fail-safe"
```

---

### Task 7: Nudge route

**Files:**
- Create: `src/app/api/nudge/route.ts`

- [ ] **Step 1: Write the implementation**

```ts
import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { runNudge } from "@/server/nudge";

// Cloud-safe (no claude). Self-guards on sendHour, so an hourly local trigger
// lands at most one send/day. Not in vercel.json yet — fired by a local scheduler.
const PROFILE_ID = process.env.FIXED_PROFILE_ID!;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  const result = await runNudge(PROFILE_ID);
  return NextResponse.json({ ok: !result.error, ...result });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/nudge/route.ts
git commit -m "feat(nudge): cron-auth /api/nudge route"
```

---

### Task 8: Callback drain seam — `applyCallback` + `drainTelegramUpdates`

**Files:**
- Create: `src/server/telegram-poll.ts`
- Test: `src/server/telegram-poll.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const markRepliedQuick = vi.fn();
const dismissCandidate = vi.fn();
const getTelegramUpdates = vi.fn();
const answerCallbackQuery = vi.fn();
vi.mock("@/server/posts", () => ({
  markRepliedQuick: (...a: unknown[]) => markRepliedQuick(...a),
  dismissCandidate: (...a: unknown[]) => dismissCandidate(...a),
}));
vi.mock("@/lib/telegram", () => ({
  getTelegramUpdates: (...a: unknown[]) => getTelegramUpdates(...a),
  answerCallbackQuery: (...a: unknown[]) => answerCallbackQuery(...a),
}));

const candRow = { data: { status: "surfaced" } as Record<string, unknown> | null };
const draftRows = { data: [{ id: "d1", body: "great reply" }] as Array<Record<string, unknown>> };
const profileRow = { data: { retention: { telegram: { offset: 0 } } } as Record<string, unknown> | null };
const updateSpy = vi.fn();

function makeFrom() {
  return (table: string) => {
    if (table === "candidates") {
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve(candRow) }) }) };
    }
    if (table === "drafts") {
      return { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve(draftRows) }) }) }) }) };
    }
    // profiles
    return {
      select: () => ({ eq: () => ({ single: () => Promise.resolve(profileRow) }) }),
      update: (vals: unknown) => ({ eq: () => { updateSpy(vals); return Promise.resolve({ error: null }); } }),
    };
  };
}
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ from: makeFrom() }) }));

import { applyCallback, drainTelegramUpdates } from "@/server/telegram-poll";

beforeEach(() => {
  markRepliedQuick.mockReset();
  dismissCandidate.mockReset();
  getTelegramUpdates.mockReset();
  answerCallbackQuery.mockReset();
  updateSpy.mockReset();
  candRow.data = { status: "surfaced" };
  draftRows.data = [{ id: "d1", body: "great reply" }];
  profileRow.data = { retention: { telegram: { offset: 0 } } };
});

describe("applyCallback", () => {
  it("posted → logs the reply via markRepliedQuick", async () => {
    await applyCallback("p1", { action: "posted", candidateId: "c1" });
    expect(markRepliedQuick).toHaveBeenCalledWith("p1", { draftId: "d1", candidateId: "c1", reply: "great reply" });
  });
  it("skip → dismisses the candidate", async () => {
    await applyCallback("p1", { action: "skip", candidateId: "c1" });
    expect(dismissCandidate).toHaveBeenCalledWith("c1");
  });
  it("is idempotent — already-resolved candidate is a no-op", async () => {
    candRow.data = { status: "engaged" };
    await applyCallback("p1", { action: "posted", candidateId: "c1" });
    expect(markRepliedQuick).not.toHaveBeenCalled();
  });
});

describe("drainTelegramUpdates", () => {
  it("applies each callback and advances the offset", async () => {
    getTelegramUpdates.mockResolvedValue({
      callbacks: [{ id: "q1", data: "posted:c1", messageId: 1, chatId: 5 }],
      nextOffset: 43,
    });
    const r = await drainTelegramUpdates("p1");
    expect(r.applied).toBe(1);
    expect(markRepliedQuick).toHaveBeenCalled();
    expect(answerCallbackQuery).toHaveBeenCalledWith("q1", expect.any(String));
    expect(updateSpy).toHaveBeenCalledWith({ retention: { telegram: { offset: 43 } } });
  });
  it("fails safe on a telegram error", async () => {
    getTelegramUpdates.mockRejectedValue(new Error("net down"));
    const r = await drainTelegramUpdates("p1");
    expect(r.applied).toBe(0);
    expect(r.error).toContain("net down");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/telegram-poll.test.ts`
Expected: FAIL (cannot resolve `@/server/telegram-poll`).

- [ ] **Step 3: Write minimal implementation**

```ts
"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { getTelegramUpdates, answerCallbackQuery } from "@/lib/telegram";
import { parseCallback, type ParsedCallback } from "@/lib/telegram-callback";
import { markRepliedQuick, dismissCandidate } from "@/server/posts";

/** Apply one parsed tap. Idempotent: only a still-surfaced candidate is acted on. */
export async function applyCallback(profileId: string, c: ParsedCallback): Promise<void> {
  const sb = await supabaseServer();
  const { data: cand } = await sb.from("candidates").select("status").eq("id", c.candidateId).single();
  if (!cand || cand.status !== "surfaced") return;

  if (c.action === "skip") {
    await dismissCandidate(c.candidateId);
    return;
  }
  // posted → reuse the candidate's latest reply draft as a URL-less reply log.
  const { data: drafts } = await sb
    .from("drafts").select("id, body")
    .eq("candidate_id", c.candidateId).eq("kind", "reply")
    .order("created_at", { ascending: false }).limit(1);
  const draft = drafts?.[0];
  if (!draft) return;
  await markRepliedQuick(profileId, { draftId: draft.id as string, candidateId: c.candidateId, reply: draft.body as string });
}

/** Drain pending Telegram taps since the stored offset and apply them once each. */
export async function drainTelegramUpdates(profileId: string): Promise<{ applied: number; error?: string }> {
  try {
    const sb = await supabaseServer();
    const { data: profile } = await sb.from("profiles").select("retention").eq("id", profileId).single();
    const retention = (profile?.retention ?? {}) as { telegram?: { offset: number } };
    const offset = retention.telegram?.offset ?? 0;

    const { callbacks, nextOffset } = await getTelegramUpdates(offset);
    let applied = 0;
    for (const cb of callbacks) {
      const parsed = parseCallback(cb.data);
      if (!parsed) continue;
      await applyCallback(profileId, parsed);
      await answerCallbackQuery(cb.id, parsed.action === "posted" ? "✅ Logged" : "⏭️ Skipped");
      applied++;
    }

    if (nextOffset !== offset) {
      await sb.from("profiles").update({ retention: { ...retention, telegram: { offset: nextOffset } } }).eq("id", profileId);
    }
    return { applied };
  } catch (err) {
    console.error("drainTelegramUpdates failed:", String(err).slice(0, 200));
    return { applied: 0, error: String(err).slice(0, 200) };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/telegram-poll.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/telegram-poll.ts src/server/telegram-poll.test.ts
git commit -m "feat(telegram): drainTelegramUpdates + applyCallback (posted→markRepliedQuick, skip→dismiss)"
```

---

### Task 9: Telegram poll route

**Files:**
- Create: `src/app/api/telegram/poll/route.ts`

- [ ] **Step 1: Write the implementation**

```ts
import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { drainTelegramUpdates } from "@/server/telegram-poll";

// Cloud-safe getUpdates drain. Hit ~every minute by a local scheduler while
// dogfooding. We never setWebhook (mutually exclusive with getUpdates).
const PROFILE_ID = process.env.FIXED_PROFILE_ID!;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  const result = await drainTelegramUpdates(PROFILE_ID);
  return NextResponse.json({ ok: !result.error, ...result });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/telegram/poll/route.ts
git commit -m "feat(telegram): cron-auth /api/telegram/poll route"
```

---

### Task 10: Integration — trigger docs + full verification

**Files:**
- Modify: `docs/HANDOFF.md` (add a "Phase 1b nudge + Telegram callback" trigger note)

- [ ] **Step 1: Document the local triggers**

In `docs/HANDOFF.md`, add a short note: while `npm run dev` is up, a local scheduler hits, with `Authorization: Bearer $CRON_SECRET`:
- `GET /api/telegram/poll` every ~1 min (drains Posted/Skip taps).
- `GET /api/nudge` hourly (route self-guards on `sendHour`).
No new env vars beyond the already-set `TELEGRAM_*` and `CRON_SECRET`.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all green (the merged 394 + the new ~22 nudge/telegram/callback tests), 1 pre-existing skip.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` then `npx next build`
Expected: both clean. (Stop the dev server first if running — `next build` clashes with dev on `.next`.)

- [ ] **Step 4: Commit**

```bash
git add docs/HANDOFF.md
git commit -m "docs(retention): local trigger note for nudge + telegram poll"
```

- [ ] **Step 5: Finish the branch**

Use `superpowers:finishing-a-development-branch` to integrate `feat/nudge-telegram-callback`.

---

## Notes for the implementer

- **Reuse, do not reinvent:** `markRepliedQuick`/`dismissCandidate` already do the DB work for a logged reply / a dismissed candidate. The callback's only job is to map a tap to the right one.
- **Idempotency matters:** Telegram can re-deliver an update before the offset advances; `applyCallback` guards on `status === "surfaced"`.
- **Cloud-safe routes:** `nudge` and `telegram-poll` must not import anything that shells `claude` — keep them on `sendTelegram`/`getTelegramUpdates` + Supabase only.
- **Server-local dates:** the nudge uses `localDate` (matches the coach's `isToday`); the sibling streak uses UTC. That divergence is intentional and isolated — do not "unify" it here.
```
