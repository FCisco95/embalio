# P2 Topic Board + Step-Zero Deploy/Cron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the P2 scored topic board (`/topics` route, pure scorer, freshness pipeline, zero-spend GH Actions refresh worker) — preceded by step-zero infrastructure: Vercel Hobby deploy + GH Actions signal crons, which unblock the frozen warehouse (278 rows, no scheduler) and phone-PWA dogfood.

**Architecture:** Core topic logic lives in `src/lib/topics/` with an injected `SupabaseClient<Database>` and zero `next/*` imports, so the GH Actions worker (`scripts/refresh-topics.ts` via tsx) and the Next app share one code path. Thin `"use server"` wrappers in `src/server/topics.ts` serve the app. The phone NEVER triggers live LLM generation — it reads `topic_history` written by the scheduled worker (claude CLI on `CLAUDE_CODE_OAUTH_TOKEN`, Gemini fallback). Freshness chain: fresh (<2h) → cached + background `workflow_dispatch` → today's `research_briefings` (low-confidence label) → ≤48h-old board (stale banner) → labeled empty state. Never empty, never unlabeled-stale.

**Tech Stack:** Next.js App Router + Tauri shell, Supabase (project `vzxpakxjnuaesfxihyvl`), Vitest, zod, Vercel AI SDK (OpenAI embeddings, Gemini fallback), Apify SignalSource, GitHub Actions, Vercel Hobby.

**Verified context (2026-06-11):**
- Repo `C:\Users\joao_\Desktop\projects\embalio`, trunk `main` @ 6252676, remote `github.com/FCisco95/embalio`, baseline 442 passed / 1 skipped. **Every task gate: ≥442 green.**
- `topic_history` table exists (migration `20260611_signal_warehouse.sql`): `profile_id, topic, angle, score, why jsonb, sources jsonb, generated_at, expires_at, status` (default `'fresh'`).
- Cron routes exist + `cronAuthError` (CRON_SECRET bearer) — but NO deployment, NO `.github/`. Warehouse frozen since 06-11 00:43.
- `gh` CLI authed (FCisco95), `vercel` CLI installed. `GEN_BACKEND` env: `subscription` (claude CLI) | `gemini`.
- Key signatures (verbatim, do not re-derive):
  - `relevanceFromVectors(a: number[], b: number[]): number` — `src/lib/embeddings.ts:12`; `embedTexts(texts: string[]): Promise<number[][]>` — line 21.
  - `gateTrend(pillars: string[], niche: string, trend: Trend): Promise<CredibilityVerdict>` — `src/lib/credibility/gate.ts:6` (DB-free; fails safe keep=false).
  - `generateStructured<T>(schema, prompt, opts?, runner?): Promise<{data: T} | {data: null; raw: string}>` — `src/lib/generate/index.ts:43`. `opts: { research?: boolean; backend?: "subscription"|"gemini"; attempts?: number }`.
  - `draftFromTrend(profileId: string, gated: GatedTrend)` — `src/server/trends.ts:33`; `GatedTrend = { trend: Trend; angle: string; reason: string }`; `Trend = { topic, why_now, angle, source? }` (`src/lib/schemas.ts:116`).
  - `buildTrendRadarPrompt(pillars: string[], date: string): string` — `src/lib/voice-prompt.ts:203`.
  - `supabaseService()` — `src/lib/supabase/server.ts` (service role; do NOT import this file from the worker — it also exports cookie-based `supabaseServer`; worker builds its own client).
  - Test mocking convention: `vi.mock("@/lib/supabase/server", ...)` with chainable objects (see `src/server/credibility.test.ts`).

---

## Task 0: Vercel Hobby deploy (infra — run in MAIN session, not a subagent; may need interactive `vercel login`)

**Files:**
- Modify: `src/app/api/cron/targeting/route.ts` (add maxDuration)
- Modify: `src/app/api/cron/tracking/route.ts` (add maxDuration)
- Modify: `src/app/api/cron/follower-snapshot/route.ts` (add maxDuration)

- [ ] **Step 1: Add maxDuration to the three cron routes** (Apify scrapes can exceed Vercel's 60s default; 300s is the Hobby/fluid ceiling). At the top of each route file, after imports, add:

```typescript
export const maxDuration = 300;
```

- [ ] **Step 2: Run suite + commit**

Run: `npm test` → expect ≥442 passed.

```bash
git add src/app/api/cron
git commit -m "chore(crons): maxDuration 300s for Apify-bound cron routes"
```

- [ ] **Step 3: Link Vercel project**

Run: `vercel whoami` — if not logged in, user runs `! vercel login` interactively.
Run from repo root: `vercel link --yes` (creates project `embalio` under his account).

- [ ] **Step 4: Push production env vars** — values from `.env.local` (read names+values locally, never print values to chat):

For each of: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APIFY_TOKEN`, `APIFY_TWEET_SCRAPER_ACTOR`, `CRON_SECRET`, `FIXED_PROFILE_ID`, `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_POSTING_ENABLED`:

```bash
# PowerShell pattern, one per var (value piped, not echoed to scrollback):
(Get-Content .env.local | Where-Object { $_ -match '^VARNAME=' }) -replace '^VARNAME=','' | vercel env add VARNAME production
```

Plus one literal: `echo gemini | vercel env add GEN_BACKEND production` — Vercel has no claude CLI; Gemini path keeps Draft-this functional from the phone. If `GOOGLE_GENERATIVE_AI_API_KEY` is unavailable, Draft-this fails politely on Vercel until Cisco creates a free AI Studio key (flag as user TODO, do not block deploy).

- [ ] **Step 5: Deploy**

```bash
vercel deploy --prod
```

Capture the production URL (expect `https://embalio.vercel.app` or similar). Call it `$APP_URL`.

- [ ] **Step 6: Verify cron auth live**

```bash
curl -s -o /dev/null -w "%{http_code}" $APP_URL/api/cron/targeting
```
Expected: `401` (route live, auth enforced). Then with the real secret:
```bash
curl -s -H "Authorization: Bearer <CRON_SECRET>" $APP_URL/api/cron/follower-snapshot
```
Expected: `{"ok":true,"followers":<n>}` — proves Apify + Supabase wiring works in prod.

---

## Task 1: GH Actions signal crons (gate-(a) unblock)

**Files:**
- Create: `.github/workflows/signal-crons.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: signal-crons

on:
  schedule:
    - cron: "15 6-22/2 * * *"   # targeting + tracking, every 2h waking hours (UTC; Lisbon=UTC+1)
    - cron: "45 0 * * *"        # follower snapshot, daily 00:45 UTC
  workflow_dispatch: {}

jobs:
  ping:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: targeting
        if: github.event.schedule != '45 0 * * *'
        run: |
          code=$(curl -s -o /tmp/out -w "%{http_code}" -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "${{ vars.APP_BASE_URL }}/api/cron/targeting")
          cat /tmp/out; [ "$code" = "200" ]
      - name: tracking
        if: github.event.schedule != '45 0 * * *'
        run: |
          code=$(curl -s -o /tmp/out -w "%{http_code}" -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "${{ vars.APP_BASE_URL }}/api/cron/tracking")
          cat /tmp/out; [ "$code" = "200" ]
      - name: follower-snapshot
        if: github.event.schedule != '15 6-22/2 * * *'
        run: |
          code=$(curl -s -o /tmp/out -w "%{http_code}" -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "${{ vars.APP_BASE_URL }}/api/cron/follower-snapshot")
          cat /tmp/out; [ "$code" = "200" ]
```

(Note: on `workflow_dispatch`, `github.event.schedule` is empty → all three steps run. Intentional.)

- [ ] **Step 2: Set repo secret + variable**

```bash
# value read from .env.local, piped — not echoed:
(Get-Content .env.local | Where-Object { $_ -match '^CRON_SECRET=' }) -replace '^CRON_SECRET=','' | gh secret set CRON_SECRET --repo FCisco95/embalio
gh variable set APP_BASE_URL --repo FCisco95/embalio --body "<$APP_URL from Task 0>"
```

- [ ] **Step 3: Commit + push + manual trigger**

```bash
git add .github/workflows/signal-crons.yml
git commit -m "feat(infra): GH Actions scheduler for signal crons (targeting/tracking/follower-snapshot)"
git push origin main
gh workflow run signal-crons --repo FCisco95/embalio
gh run watch --repo FCisco95/embalio --exit-status
```
Expected: run green.

- [ ] **Step 4: Verify warehouse growing** — via Supabase MCP `execute_sql` on project `vzxpakxjnuaesfxihyvl`:

```sql
SELECT count(*) FROM signal_tweets;
```
Expected: > 278. **Gate (a) cleared.**

---

## Task 2: Topic zod schemas

**Files:**
- Modify: `src/lib/schemas.ts` (append after `TrendReport` block, line ~127)
- Test: `src/lib/topics/schemas.test.ts` (create dir `src/lib/topics/`)

- [ ] **Step 1: Check `topic_history` exists in `src/lib/supabase/types.ts`** — `grep -n "topic_history" src/lib/supabase/types.ts`. If absent, regenerate types via Supabase MCP `generate_typescript_types` (project `vzxpakxjnuaesfxihyvl`) and overwrite the generated section of that file. Commit separately if changed: `chore(db): regen types for signal warehouse tables`.

- [ ] **Step 2: Write failing test**

```typescript
// src/lib/topics/schemas.test.ts
import { describe, it, expect } from "vitest";
import { TopicCandidate, TopicBoardReport } from "@/lib/schemas";

const okSource = { url: "https://x.com/a/status/1", title: "launch post", published_at: "2026-06-11T08:00:00Z" };
const okTopic = { topic: "Claude Code workflows", why_now: "v5 shipped yesterday", angle: "my migration story", kind: "spike", sources: [okSource] };

describe("TopicCandidate", () => {
  it("accepts a sourced topic", () => {
    expect(TopicCandidate.parse(okTopic).sources).toHaveLength(1);
  });
  it("rejects sourceless topics (zero sources)", () => {
    expect(TopicCandidate.safeParse({ ...okTopic, sources: [] }).success).toBe(false);
  });
  it("rejects sources missing published_at", () => {
    const bad = { ...okTopic, sources: [{ url: okSource.url, title: "t" }] };
    expect(TopicCandidate.safeParse(bad).success).toBe(false);
  });
  it("rejects unknown kind", () => {
    expect(TopicCandidate.safeParse({ ...okTopic, kind: "viral" }).success).toBe(false);
  });
});

describe("TopicBoardReport", () => {
  it("requires 1-6 topics", () => {
    expect(TopicBoardReport.safeParse({ topics: [], generatedAt: "x" }).success).toBe(false);
    expect(TopicBoardReport.parse({ topics: [okTopic], generatedAt: "June 11, 2026" }).topics).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run to verify fail** — `npx vitest run src/lib/topics/schemas.test.ts` → FAIL (`TopicCandidate` not exported).

- [ ] **Step 4: Implement** — append to `src/lib/schemas.ts` after the `TrendReport` type exports (line ~127):

```typescript
// P2 topic board: every topic MUST carry dated sources — sourceless generation
// is rejected at the schema layer, which makes generateStructured retry.
export const TopicSource = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  published_at: z.string().min(1),
});
export const TopicCandidate = z.object({
  topic: z.string().min(1),
  why_now: z.string().min(1),
  angle: z.string().min(1),
  kind: z.enum(["spike", "durable"]),
  sources: z.array(TopicSource).min(1),
});
export const TopicBoardReport = z.object({
  topics: z.array(TopicCandidate).min(1).max(6),
  generatedAt: z.string(),
});
export type TopicSource = z.infer<typeof TopicSource>;
export type TopicCandidate = z.infer<typeof TopicCandidate>;
export type TopicBoardReport = z.infer<typeof TopicBoardReport>;
```

- [ ] **Step 5: Run tests** — `npx vitest run src/lib/topics/schemas.test.ts` → PASS; `npm test` → ≥442+5.

- [ ] **Step 6: Commit** — `git add src/lib/schemas.ts src/lib/topics/schemas.test.ts && git commit -m "feat(topics): zod schemas — dated sources required per topic"`

---

## Task 3: Heat from warehouse — `src/lib/topics/heat.ts`

**Files:**
- Create: `src/lib/topics/heat.ts`
- Test: `src/lib/topics/heat.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/topics/heat.test.ts
import { describe, it, expect, vi } from "vitest";
import { topicTerms, computeHeat, heatForTopic } from "./heat";

describe("topicTerms", () => {
  it("keeps significant lowercase tokens, drops stopwords + short words", () => {
    expect(topicTerms("The Claude Code v5 Agent Workflows")).toEqual(["claude", "code", "agent", "workflows"]);
  });
  it("caps at 6 terms and strips non-word chars", () => {
    const terms = topicTerms("alpha-beta gamma, delta epsilon zeta eta theta!");
    expect(terms.length).toBeLessThanOrEqual(6);
    for (const t of terms) expect(t).toMatch(/^[a-z0-9]+$/);
  });
});

describe("computeHeat", () => {
  it("zero activity → zero heat, not declining", () => {
    expect(computeHeat(0, 0)).toEqual({ heat01: 0, recent: 0, prior: 0, velocityRatio: 0, declining: false });
  });
  it("strong acceleration saturates heat", () => {
    const h = computeHeat(20, 2);
    expect(h.heat01).toBe(1);
    expect(h.velocityRatio).toBe(10);
    expect(h.declining).toBe(false);
  });
  it("declining when recent < prior", () => {
    expect(computeHeat(3, 9).declining).toBe(true);
  });
  it("heat01 stays in [0,1]", () => {
    expect(computeHeat(500, 1).heat01).toBeLessThanOrEqual(1);
    expect(computeHeat(1, 0).heat01).toBeGreaterThan(0);
  });
});

describe("heatForTopic", () => {
  it("counts recent (0-24h) vs prior (24-48h) matching signal_tweets", async () => {
    const calls: { gte: string; lt?: string }[] = [];
    const mkQuery = (count: number) => {
      const q: Record<string, unknown> = { count };
      const chain = {
        gte: vi.fn((_c: string, v: string) => { calls.push({ gte: v }); return chain; }),
        lt: vi.fn((_c: string, v: string) => { calls[calls.length - 1].lt = v; return chain; }),
        or: vi.fn(() => Promise.resolve({ count, error: null })),
      };
      return Object.assign(chain, q);
    };
    let call = 0;
    const sb = {
      from: vi.fn(() => ({
        select: vi.fn(() => mkQuery(call++ === 0 ? 8 : 2)),
      })),
    };
    const h = await heatForTopic(sb as never, "claude agents");
    expect(h.recent).toBe(8);
    expect(h.prior).toBe(2);
    expect(h.velocityRatio).toBe(4);
    expect(calls).toHaveLength(2);
  });
  it("returns zero heat when topic has no usable terms", async () => {
    const sb = { from: vi.fn() };
    const h = await heatForTopic(sb as never, "the of and");
    expect(h).toEqual(computeHeat(0, 0));
    expect(sb.from).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run src/lib/topics/heat.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```typescript
// src/lib/topics/heat.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface Heat {
  heat01: number;
  recent: number;
  prior: number;
  velocityRatio: number;
  declining: boolean;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "what", "when", "how",
  "why", "are", "was", "has", "have", "you", "your", "its", "new", "now",
]);

/** Significant search terms from a topic title: lowercase word tokens, len>3, no stopwords, max 6. */
export function topicTerms(topic: string): string[] {
  return topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, 6);
}

/** Pure heat from own-warehouse counts. Sanity-checks LLM "trending" claims against scraped reality. */
export function computeHeat(recent: number, prior: number): Heat {
  if (recent === 0 && prior === 0)
    return { heat01: 0, recent, prior, velocityRatio: 0, declining: false };
  const velocityRatio = prior === 0 ? recent : recent / prior;
  const volume = Math.min(recent / 10, 1);
  const accel = Math.min(velocityRatio / 4, 1);
  return {
    heat01: Math.min(1, 0.5 * volume + 0.5 * accel),
    recent,
    prior,
    velocityRatio,
    declining: recent < prior,
  };
}

async function countWindow(
  sb: SupabaseClient<Database>,
  terms: string[],
  fromIso: string,
  toIso: string | null,
): Promise<number> {
  let q = sb
    .from("signal_tweets")
    .select("id", { count: "exact", head: true })
    .gte("tweet_created_at", fromIso);
  if (toIso) q = q.lt("tweet_created_at", toIso);
  const { count } = await q.or(terms.map((t) => `text.ilike.%${t}%`).join(","));
  return count ?? 0;
}

/** Velocity of a topic inside OUR signal_tweets: last 24h vs the 24h before it. */
export async function heatForTopic(sb: SupabaseClient<Database>, topic: string): Promise<Heat> {
  const terms = topicTerms(topic);
  if (terms.length === 0) return computeHeat(0, 0);
  const now = Date.now();
  const h24 = new Date(now - 24 * 3600_000).toISOString();
  const h48 = new Date(now - 48 * 3600_000).toISOString();
  const [recent, prior] = await Promise.all([
    countWindow(sb, terms, h24, null),
    countWindow(sb, terms, h48, h24),
  ]);
  return computeHeat(recent, prior);
}
```

NOTE for implementer: the mock in the test chains `.gte().lt().or()` and `.gte().or()` — if the real supabase-js builder requires `.or()` before range filters, adapt implementation AND test together (chain order in supabase-js is free; `.or()` returns the builder, awaiting it executes). If `q.or(...)` typing fights `head: true`, cast the builder: `(q as unknown as { or: (s: string) => Promise<{ count: number | null }> })`.

- [ ] **Step 4: Run tests** — `npx vitest run src/lib/topics/heat.test.ts` → PASS. Full suite green.

- [ ] **Step 5: Commit** — `git add src/lib/topics/heat.ts src/lib/topics/heat.test.ts && git commit -m "feat(topics): warehouse heat — topic velocity from own signal_tweets"`

---

## Task 4: Pure scorer — `src/lib/topics/score.ts`

**Files:**
- Create: `src/lib/topics/score.ts`
- Test: `src/lib/topics/score.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/topics/score.test.ts
import { describe, it, expect } from "vitest";
import { scoreTopic, type ScoreInput } from "./score";
import { computeHeat } from "./heat";

const base: ScoreInput = {
  nicheFit01: 1,
  heat: computeHeat(20, 2), // heat01 = 1
  credibilityKept: true,
  freshestSourceAgeHours: 1,
  kind: "spike",
};

describe("scoreTopic", () => {
  it("perfect inputs → 100, react window", () => {
    const s = scoreTopic(base);
    expect(s.score).toBe(100);
    expect(s.window).toBe("react");
    expect(s.why).toEqual({ niche_fit: 35, heat: 30, credibility: 20, timing: 15 });
  });
  it("source <2h old → react window", () => {
    expect(scoreTopic({ ...base, heat: computeHeat(1, 1), freshestSourceAgeHours: 1.5 }).window).toBe("react");
  });
  it("source >48h old → saturated", () => {
    expect(scoreTopic({ ...base, freshestSourceAgeHours: 50 }).window).toBe("saturated");
  });
  it("declining warehouse velocity with real prior volume → saturated", () => {
    expect(scoreTopic({ ...base, heat: computeHeat(2, 8), freshestSourceAgeHours: 12 }).window).toBe("saturated");
  });
  it("mid-age, steady → verdict window", () => {
    expect(scoreTopic({ ...base, heat: computeHeat(3, 3), freshestSourceAgeHours: 12 }).window).toBe("verdict");
  });
  it("unparseable source date → verdict (never react)", () => {
    expect(scoreTopic({ ...base, heat: computeHeat(0, 0), freshestSourceAgeHours: null }).window).toBe("verdict");
  });
  it("not-kept credibility zeroes that component", () => {
    const s = scoreTopic({ ...base, credibilityKept: false });
    expect(s.why.credibility).toBe(0);
    expect(s.score).toBe(80);
  });
  it("score is clamped int 0-100", () => {
    const s = scoreTopic({ nicheFit01: 0, heat: computeHeat(0, 0), credibilityKept: false, freshestSourceAgeHours: null, kind: "durable" });
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(s.score)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run src/lib/topics/score.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```typescript
// src/lib/topics/score.ts
import type { Heat } from "./heat";

export type TimingWindow = "react" | "verdict" | "saturated";

export interface WhyChips {
  niche_fit: number;   // 0-35
  heat: number;        // 0-30
  credibility: number; // 0 or 20
  timing: number;      // 0-15
}

export interface ScoreInput {
  nicheFit01: number;                    // relevanceFromVectors output
  heat: Heat;                            // from heatForTopic
  credibilityKept: boolean;              // gateTrend verdict
  freshestSourceAgeHours: number | null; // min source age; null = unparseable dates
  kind: "spike" | "durable";
}

export interface TopicScore {
  score: number; // 0-100 int
  window: TimingWindow;
  why: WhyChips;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Timing window: react (<2h news or strong fresh acceleration) /
 * verdict (24-48h take) / saturated (old or dying in our own warehouse data).
 */
function timingWindow(input: ScoreInput): TimingWindow {
  const age = input.freshestSourceAgeHours;
  const { heat } = input;
  if (age !== null && age > 48) return "saturated";
  if (heat.declining && heat.prior >= 5) return "saturated";
  if (age !== null && age <= 2) return "react";
  if (!heat.declining && heat.velocityRatio >= 3 && heat.recent >= 5) return "react";
  return "verdict";
}

const TIMING_VALUE: Record<TimingWindow, number> = { react: 1, verdict: 0.6, saturated: 0.2 };

/** Pure 0-100 scorer: niche fit 35 + heat 30 + credibility 20 + timing 15. */
export function scoreTopic(input: ScoreInput): TopicScore {
  const window = timingWindow(input);
  const why: WhyChips = {
    niche_fit: Math.round(35 * clamp01(input.nicheFit01)),
    heat: Math.round(30 * clamp01(input.heat.heat01)),
    credibility: input.credibilityKept ? 20 : 0,
    timing: Math.round(15 * TIMING_VALUE[window]),
  };
  const score = Math.max(0, Math.min(100, why.niche_fit + why.heat + why.credibility + why.timing));
  return { score, window, why };
}
```

- [ ] **Step 4: Run tests** — PASS. Full suite green.

- [ ] **Step 5: Commit** — `git add src/lib/topics/score.ts src/lib/topics/score.test.ts && git commit -m "feat(topics): pure 0-100 scorer — niche/heat/credibility/timing"`

---

## Task 5: Prompt — `buildTopicBoardPrompt`

**Files:**
- Modify: `src/lib/voice-prompt.ts` (append after `buildTrendRadarPrompt`, line ~213)
- Test: `src/lib/topics/prompt.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/topics/prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildTopicBoardPrompt, type WarehouseTweetLine } from "@/lib/voice-prompt";

const tweets: WarehouseTweetLine[] = [
  { handle: "levelsio", text: "shipped an agent that books my flights", url: "https://x.com/levelsio/status/9", createdAt: "2026-06-11T06:00:00Z" },
];

describe("buildTopicBoardPrompt", () => {
  it("embeds pillars, date, and warehouse tweets", () => {
    const p = buildTopicBoardPrompt(["AI tooling", "build in public"], "June 11, 2026", tweets);
    expect(p).toContain("AI tooling");
    expect(p).toContain("June 11, 2026");
    expect(p).toContain("@levelsio");
    expect(p).toContain("books my flights");
  });
  it("asks for the TopicBoardReport JSON shape with dated sources", () => {
    const p = buildTopicBoardPrompt(["x"], "d", []);
    expect(p).toContain('"published_at"');
    expect(p).toContain('"kind"');
    expect(p).toMatch(/spike.*durable|durable.*spike/);
  });
  it("omits the warehouse section when no tweets", () => {
    expect(buildTopicBoardPrompt(["x"], "d", [])).not.toContain("signal warehouse");
  });
  it("truncates long tweet text", () => {
    const long = { ...tweets[0], text: "z".repeat(500) };
    expect(buildTopicBoardPrompt(["x"], "d", [long])).not.toContain("z".repeat(250));
  });
});
```

- [ ] **Step 2: Run to verify fail** — FAIL (not exported).

- [ ] **Step 3: Implement** — append to `src/lib/voice-prompt.ts` (reuse the file-local `sanitizeForPrompt` helper that `buildTrendRadarPrompt` already uses):

```typescript
export interface WarehouseTweetLine {
  handle: string;
  text: string;
  url: string;
  createdAt: string | null;
}

/**
 * P2 topic board prompt: the LLM RANKS against our own scraped signal instead of
 * discovering blind. Dated sources are mandatory — schema rejects sourceless output.
 */
export function buildTopicBoardPrompt(
  pillars: string[],
  date: string,
  warehouseTweets: WarehouseTweetLine[],
): string {
  const lines = [
    `Search X/Twitter, tech news, and GitHub for concrete trends relevant to these content pillars: ${pillars.map((p) => sanitizeForPrompt(p, 200)).join(", ")}.`,
    `Today is ${date}. Focus on signal from the last 48 hours only — skip evergreen topics.`,
  ];
  if (warehouseTweets.length > 0) {
    lines.push(
      `These high-velocity tweets come from our own signal warehouse (scraped in the last 48h). Treat them as ground truth for what is ACTUALLY moving — prefer topics corroborated by them, and rank harder evidence above vibes:`,
      ...warehouseTweets.map(
        (t) => `- @${sanitizeForPrompt(t.handle, 40)} (${t.createdAt ?? "unknown time"}): ${sanitizeForPrompt(t.text, 200)} [${t.url}]`,
      ),
    );
  }
  lines.push(
    `Find 2-6 real, specific topics. Each must have a "why_now": what actually changed this week (a release, an announcement, a spike in discussion).`,
    `For each topic propose one concrete post angle — a specific thing a builder in this space could say from their own experience.`,
    `Classify each topic's "kind": "spike" (reaction window measured in hours) or "durable" (conversation with days of legs).`,
    `Every topic MUST cite at least one real source with a URL and its publication date — no source, no topic. Never invent URLs or dates.`,
    `Avoid generic noise ("AI is growing"). Only surface things that would make someone say "I need to post about this today".`,
    `Return exactly this JSON:`,
    `{"topics": [{"topic": "...", "why_now": "...", "angle": "...", "kind": "spike|durable", "sources": [{"url": "https://...", "title": "...", "published_at": "ISO date or human date"}]}], "generatedAt": "${date}"}`,
  );
  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests** — PASS. Full suite green.

- [ ] **Step 5: Commit** — `git add src/lib/voice-prompt.ts src/lib/topics/prompt.test.ts && git commit -m "feat(topics): board prompt — LLM ranks against warehouse signal, dated sources required"`

---

## Task 6: Board pipeline — `src/lib/topics/board.ts`

**Files:**
- Create: `src/lib/topics/board.ts`
- Test: `src/lib/topics/board.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/topics/board.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const generateStructured = vi.fn();
vi.mock("@/lib/generate", () => ({ generateStructured: (...a: unknown[]) => generateStructured(...a) }));

const gateTrend = vi.fn();
vi.mock("@/lib/credibility/gate", () => ({ gateTrend: (...a: unknown[]) => gateTrend(...a) }));

vi.mock("@/lib/embeddings", () => ({
  embedTexts: vi.fn(async (texts: string[]) => texts.map((_, i) => (i === 0 ? [1, 0] : [1, 0]))),
  relevanceFromVectors: vi.fn(() => 0.9),
}));

vi.mock("./heat", async (importOriginal) => {
  const real = await importOriginal<typeof import("./heat")>();
  return { ...real, heatForTopic: vi.fn(async () => real.computeHeat(8, 2)) };
});

import { generateTopicBoard } from "./board";

const report = {
  topics: [
    { topic: "Agent SDK v2", why_now: "released yesterday", angle: "my port story", kind: "spike", sources: [{ url: "https://x.com/a/status/1", title: "launch", published_at: "2026-06-11T07:00:00Z" }] },
    { topic: "Crypto tax law", why_now: "vote passed", angle: "n/a", kind: "durable", sources: [{ url: "https://news.example/b", title: "vote", published_at: "2026-06-10T07:00:00Z" }] },
  ],
  generatedAt: "June 11, 2026",
};

function makeSb() {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];
  const sb = {
    from: vi.fn((table: string) => {
      if (table === "profiles")
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { content_pillars: ["AI tooling"], niche_description: "indie AI builders" }, error: null }) }) }) };
      if (table === "signal_tweets")
        return { select: () => ({ gte: () => ({ order: () => ({ limit: async () => ({ data: [{ author_handle: "levelsio", text: "agents", url: "u", tweet_created_at: "2026-06-11T05:00:00Z" }], error: null }) }) }) }) };
      if (table === "topic_history")
        return {
          update: (v: unknown) => ({ eq: () => ({ eq: async () => { updated.push(v); return { error: null }; } }) }),
          insert: async (rows: unknown[]) => { inserted.push(...rows); return { error: null }; },
        };
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return { sb, inserted, updated };
}

beforeEach(() => {
  generateStructured.mockReset();
  gateTrend.mockReset();
});

describe("generateTopicBoard", () => {
  it("generates, gates, scores, expires old rows, inserts new ones", async () => {
    generateStructured.mockResolvedValue({ data: report });
    gateTrend
      .mockResolvedValueOnce({ keep: true, angle: "sharper angle", reason: "you ship agents weekly" })
      .mockResolvedValueOnce({ keep: false, angle: "", reason: "no standing" });
    const { sb, inserted, updated } = makeSb();
    const n = await generateTopicBoard(sb as never, "profile-1");
    expect(n).toBe(1);
    expect(updated[0]).toMatchObject({ status: "expired" });
    const row = inserted[0] as Record<string, unknown>;
    expect(row.profile_id).toBe("profile-1");
    expect(row.topic).toBe("Agent SDK v2");
    expect(row.angle).toBe("sharper angle");
    expect(typeof row.score).toBe("number");
    expect(row.status).toBe("fresh");
    expect(row.expires_at).toBeTruthy();
    const why = row.why as Record<string, unknown>;
    expect(why.reason).toBe("you ship agents weekly");
    expect(why.kind).toBe("spike");
    expect((row.sources as unknown[]).length).toBe(1);
  });
  it("falls back to gemini when claude path yields no data and GOOGLE key set", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "k");
    generateStructured
      .mockResolvedValueOnce({ data: null, raw: "garbage" })
      .mockResolvedValueOnce({ data: report });
    gateTrend.mockResolvedValue({ keep: true, angle: "a", reason: "r" });
    const { sb } = makeSb();
    await generateTopicBoard(sb as never, "p");
    expect(generateStructured).toHaveBeenCalledTimes(2);
    expect(generateStructured.mock.calls[1][2]).toMatchObject({ backend: "gemini" });
    vi.unstubAllEnvs();
  });
  it("throws when generation fails everywhere", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    generateStructured.mockResolvedValue({ data: null, raw: "" });
    const { sb } = makeSb();
    await expect(generateTopicBoard(sb as never, "p")).rejects.toThrow(/topic board generation failed/);
    vi.unstubAllEnvs();
  });
  it("throws when every topic is gate-dropped (never writes an empty board)", async () => {
    generateStructured.mockResolvedValue({ data: report });
    gateTrend.mockResolvedValue({ keep: false, angle: "", reason: "no" });
    const { sb, inserted } = makeSb();
    await expect(generateTopicBoard(sb as never, "p")).rejects.toThrow(/all topics gate-dropped/);
    expect(inserted).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify fail** — FAIL (module missing).

- [ ] **Step 3: Implement**

```typescript
// src/lib/topics/board.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { generateStructured } from "@/lib/generate";
import { gateTrend } from "@/lib/credibility/gate";
import { embedTexts, relevanceFromVectors } from "@/lib/embeddings";
import { TopicBoardReport, type TopicCandidate } from "@/lib/schemas";
import { buildTopicBoardPrompt, type WarehouseTweetLine } from "@/lib/voice-prompt";
import { heatForTopic } from "./heat";
import { scoreTopic } from "./score";

const BOARD_TTL_MS = 2 * 3600_000;
const WAREHOUSE_WINDOW_MS = 48 * 3600_000;

function freshestSourceAgeHours(t: TopicCandidate, nowMs: number): number | null {
  const ages = t.sources
    .map((s) => Date.parse(s.published_at))
    .filter((ms) => Number.isFinite(ms))
    .map((ms) => (nowMs - ms) / 3600_000);
  return ages.length > 0 ? Math.min(...ages) : null;
}

async function generateReport(prompt: string) {
  let r: { data: TopicBoardReport | null };
  try {
    r = await generateStructured(TopicBoardReport, prompt, { research: true, attempts: 3 });
  } catch {
    r = { data: null };
  }
  if (!r.data && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      r = await generateStructured(TopicBoardReport, prompt, { backend: "gemini", attempts: 2 });
    } catch {
      r = { data: null };
    }
  }
  if (!r.data) throw new Error("topic board generation failed (claude + fallback)");
  return r.data;
}

/**
 * Full P2 pipeline: warehouse-grounded generation → credibility gate → embed →
 * heat → score → persist. Worker + local only; the app NEVER calls this on request.
 */
export async function generateTopicBoard(
  sb: SupabaseClient<Database>,
  profileId: string,
): Promise<number> {
  const { data: profile, error } = await sb
    .from("profiles")
    .select("content_pillars, niche_description")
    .eq("id", profileId)
    .single();
  if (error || !profile) throw new Error("profile not found");
  const pillars = (profile.content_pillars ?? []) as string[];
  const niche = (profile.niche_description ?? "") as string;

  const now = Date.now();
  const { data: hot } = await sb
    .from("signal_tweets")
    .select("author_handle, text, url, tweet_created_at")
    .gte("tweet_created_at", new Date(now - WAREHOUSE_WINDOW_MS).toISOString())
    .order("author_followers", { ascending: false })
    .limit(25);
  const warehouseLines: WarehouseTweetLine[] = (hot ?? []).map((t) => ({
    handle: t.author_handle,
    text: t.text,
    url: t.url,
    createdAt: t.tweet_created_at,
  }));

  const date = new Date(now).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const report = await generateReport(buildTopicBoardPrompt(pillars, date, warehouseLines));

  const verdicts = await Promise.all(
    report.topics.map((t) =>
      gateTrend(pillars, niche, { topic: t.topic, why_now: t.why_now, angle: t.angle, source: t.sources[0]?.url }),
    ),
  );
  const kept = report.topics
    .map((t, i) => ({ t, v: verdicts[i] }))
    .filter((x) => x.v.keep);
  if (kept.length === 0) throw new Error("all topics gate-dropped — board not written");

  const vectors = await embedTexts([
    `${niche} ${pillars.join(" ")}`,
    ...kept.map((x) => `${x.t.topic} ${x.t.why_now}`),
  ]);
  const heats = await Promise.all(kept.map((x) => heatForTopic(sb, x.t.topic)));

  const generatedAt = new Date(now).toISOString();
  const rows = kept.map((x, i) => {
    const heat = heats[i];
    const scored = scoreTopic({
      nicheFit01: relevanceFromVectors(vectors[0], vectors[i + 1]),
      heat,
      credibilityKept: true,
      freshestSourceAgeHours: freshestSourceAgeHours(x.t, now),
      kind: x.t.kind,
    });
    return {
      profile_id: profileId,
      topic: x.t.topic,
      angle: x.v.angle || x.t.angle,
      score: scored.score,
      why: {
        ...scored.why,
        window: scored.window,
        kind: x.t.kind,
        why_now: x.t.why_now,
        reason: x.v.reason,
        heat_recent: heat.recent,
        heat_prior: heat.prior,
      } as unknown as Json,
      sources: x.t.sources as unknown as Json,
      generated_at: generatedAt,
      expires_at: new Date(now + BOARD_TTL_MS).toISOString(),
      status: "fresh",
    };
  });

  const { error: expireErr } = await sb
    .from("topic_history")
    .update({ status: "expired" })
    .eq("profile_id", profileId)
    .eq("status", "fresh");
  if (expireErr) throw new Error(expireErr.message);
  const { error: insErr } = await sb.from("topic_history").insert(rows);
  if (insErr) throw new Error(insErr.message);
  return rows.length;
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/lib/topics/board.test.ts` → PASS. Full suite green.

- [ ] **Step 5: Commit** — `git add src/lib/topics/board.ts src/lib/topics/board.test.ts && git commit -m "feat(topics): board pipeline — generate, gate, score, persist topic_history"`

---

## Task 7: Freshness chain + dispatch — `src/server/topics.ts` + `src/lib/topics/dispatch.ts`

**Files:**
- Create: `src/lib/topics/dispatch.ts`
- Create: `src/server/topics.ts`
- Test: `src/lib/topics/dispatch.test.ts`
- Test: `src/server/topics.test.ts`

- [ ] **Step 1: Write failing dispatch tests**

```typescript
// src/lib/topics/dispatch.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { dispatchTopicRefresh } from "./dispatch";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("dispatchTopicRefresh", () => {
  it("no token → false, no network call", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await dispatchTopicRefresh()).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("fires workflow_dispatch and returns true on 204", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "tok");
    const f = vi.fn(async () => ({ status: 204 }));
    vi.stubGlobal("fetch", f);
    expect(await dispatchTopicRefresh()).toBe(true);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/repos/FCisco95/embalio/actions/workflows/refresh-topics.yml/dispatches");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string)).toEqual({ ref: "main" });
  });
  it("network error → false, never throws", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net"); }));
    expect(await dispatchTopicRefresh()).toBe(false);
  });
});
```

- [ ] **Step 2: Implement dispatch**

```typescript
// src/lib/topics/dispatch.ts

/**
 * Background refresh = fire the GH Actions worker via workflow_dispatch.
 * Env-gated (GITHUB_DISPATCH_TOKEN: fine-grained PAT, Actions read/write on
 * FCisco95/embalio). No token → silent no-op; the scheduled cadence still covers us.
 * Never throws — freshness UX must not depend on GitHub availability.
 */
export async function dispatchTopicRefresh(): Promise<boolean> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return false;
  const repo = process.env.GITHUB_DISPATCH_REPO ?? "FCisco95/embalio";
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/refresh-topics.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      },
    );
    return res.status === 204;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Run dispatch tests** — PASS.

- [ ] **Step 4: Write failing server tests**

```typescript
// src/server/topics.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const dispatchTopicRefresh = vi.fn(async () => true);
vi.mock("@/lib/topics/dispatch", () => ({ dispatchTopicRefresh: () => dispatchTopicRefresh() }));

// Chainable topic_history mock: .select().eq().eq().gte().order() resolves rows;
// research_briefings: .select().eq().eq().single()
let topicRows: unknown[] = [];
let staleRows: unknown[] = [];
let briefing: unknown = null;
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: (table: string) => {
      if (table === "topic_history") {
        let call = 0;
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  order: async () => ({ data: topicRows, error: null }),
                }),
              }),
              gte: () => ({
                order: async () => ({ data: staleRows, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "research_briefings")
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: briefing, error: null }) }) }) }) };
      throw new Error(`unexpected ${table}`);
    },
  }),
}));

import { getTopicBoard } from "./topics";

const now = Date.now();
const iso = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
const row = (minAgo: number) => ({
  id: "t1", profile_id: "p", topic: "Agent SDK", angle: "a", score: 80,
  why: { niche_fit: 30, heat: 25, credibility: 20, timing: 15, window: "react", kind: "spike", why_now: "w", reason: "r" },
  sources: [{ url: "https://x.com/a/1", title: "s", published_at: iso(minAgo) }],
  generated_at: iso(minAgo), expires_at: iso(minAgo - 120), status: "fresh",
});

beforeEach(() => { topicRows = []; staleRows = []; briefing = null; dispatchTopicRefresh.mockClear(); });

describe("getTopicBoard", () => {
  it("fresh board (<60min): state fresh, no background dispatch", async () => {
    topicRows = [row(20)];
    const v = await getTopicBoard("p");
    expect(v.state).toBe("fresh");
    expect(v.topics).toHaveLength(1);
    expect(dispatchTopicRefresh).not.toHaveBeenCalled();
  });
  it("cached board (60-120min): state cached + background dispatch fired", async () => {
    topicRows = [row(90)];
    const v = await getTopicBoard("p");
    expect(v.state).toBe("cached");
    expect(dispatchTopicRefresh).toHaveBeenCalledOnce();
  });
  it("drops rows without generated_at — no timestamp, no render", async () => {
    topicRows = [{ ...row(20), generated_at: null }, row(25)];
    const v = await getTopicBoard("p");
    expect(v.topics).toHaveLength(1);
  });
  it("no fresh rows + today's briefing → state briefing", async () => {
    briefing = { topics: [{ topic: "from briefing" }], date: "2026-06-11" };
    const v = await getTopicBoard("p");
    expect(v.state).toBe("briefing");
    expect(v.topics[0].topic).toBe("from briefing");
  });
  it("no fresh, no briefing, ≤48h-old board → state stale", async () => {
    staleRows = [{ ...row(60 * 20), status: "expired" }];
    const v = await getTopicBoard("p");
    expect(v.state).toBe("stale");
    expect(v.topics).toHaveLength(1);
  });
  it("nothing anywhere → labeled empty, never throws", async () => {
    const v = await getTopicBoard("p");
    expect(v.state).toBe("empty");
    expect(v.topics).toHaveLength(0);
  });
});
```

NOTE for implementer: the `topic_history` mock above distinguishes the fresh query (`.eq(profile).eq(status).gte().order()`) from the stale query (`.eq(profile).gte().order()`) by chain shape. If your implementation chains differently, adjust mock and implementation TOGETHER — behavior under test (state machine + filters) must not change.

- [ ] **Step 5: Implement server actions**

```typescript
// src/server/topics.ts
"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { dispatchTopicRefresh } from "@/lib/topics/dispatch";
import { draftFromTrend } from "@/server/trends";
import type { GatedTrend } from "@/server/credibility";

export type TopicBoardState = "fresh" | "cached" | "briefing" | "stale" | "empty";

export interface TopicRowView {
  id: string;
  topic: string;
  angle: string;
  score: number;
  why: Record<string, unknown>;
  sources: { url: string; title?: string; published_at?: string }[];
  generated_at: string;
}

export interface TopicBoardView {
  state: TopicBoardState;
  generatedAt: string | null;
  topics: TopicRowView[];
}

const TTL_MS = 2 * 3600_000;
const REFRESH_AFTER_MS = 60 * 60_000;
const STALE_WINDOW_MS = 48 * 3600_000;

type RawRow = {
  id: string; topic: string; angle: string | null; score: number | null;
  why: unknown; sources: unknown; generated_at: string | null;
};

function toView(r: RawRow): TopicRowView | null {
  if (!r.generated_at) return null; // no timestamp → no render, hard rule
  return {
    id: r.id,
    topic: r.topic,
    angle: r.angle ?? "",
    score: r.score ?? 0,
    why: (r.why ?? {}) as Record<string, unknown>,
    sources: Array.isArray(r.sources) ? (r.sources as TopicRowView["sources"]) : [],
    generated_at: r.generated_at,
  };
}

/** Latest insert batch only (rows share one generated_at per board write). */
function latestBatch(rows: TopicRowView[]): TopicRowView[] {
  if (rows.length === 0) return rows;
  const newest = rows[0].generated_at;
  return rows.filter((r) => r.generated_at === newest);
}

/**
 * Freshness chain (spec QA #3/#4): fresh <2h → cached + silent background refresh
 * after 60min → today's research_briefings (low-confidence) → ≤48h board with
 * stale banner → labeled empty. Never empty-render, never unlabeled-stale.
 * Read-only against topic_history: phone open NEVER triggers live generation.
 */
export async function getTopicBoard(profileId: string): Promise<TopicBoardView> {
  const sb = await supabaseServer();
  const now = Date.now();

  const { data: freshRaw } = await sb
    .from("topic_history")
    .select("id, topic, angle, score, why, sources, generated_at")
    .eq("profile_id", profileId)
    .eq("status", "fresh")
    .gte("generated_at", new Date(now - TTL_MS).toISOString())
    .order("generated_at", { ascending: false });
  const fresh = latestBatch(((freshRaw ?? []) as RawRow[]).map(toView).filter((r): r is TopicRowView => r !== null));

  if (fresh.length > 0) {
    const ageMs = now - Date.parse(fresh[0].generated_at);
    if (ageMs > REFRESH_AFTER_MS) void dispatchTopicRefresh().catch(() => {});
    return { state: ageMs > REFRESH_AFTER_MS ? "cached" : "fresh", generatedAt: fresh[0].generated_at, topics: fresh };
  }

  const today = new Date(now).toISOString().slice(0, 10);
  const { data: briefing } = await sb
    .from("research_briefings")
    .select("topics, date")
    .eq("profile_id", profileId)
    .eq("date", today)
    .maybeSingle();
  if (briefing && Array.isArray(briefing.topics) && briefing.topics.length > 0) {
    const topics = (briefing.topics as unknown[]).map((t, i) => {
      const obj = typeof t === "string" ? { topic: t } : (t as Record<string, unknown>);
      return {
        id: `briefing-${i}`,
        topic: String(obj.topic ?? obj.title ?? "untitled"),
        angle: String(obj.angle ?? ""),
        score: 0,
        why: {},
        sources: [],
        generated_at: `${today}T00:00:00Z`,
      };
    });
    return { state: "briefing", generatedAt: `${today}T00:00:00Z`, topics };
  }

  const { data: staleRaw } = await sb
    .from("topic_history")
    .select("id, topic, angle, score, why, sources, generated_at")
    .eq("profile_id", profileId)
    .gte("generated_at", new Date(now - STALE_WINDOW_MS).toISOString())
    .order("generated_at", { ascending: false });
  const stale = latestBatch(((staleRaw ?? []) as RawRow[]).map(toView).filter((r): r is TopicRowView => r !== null));
  if (stale.length > 0) return { state: "stale", generatedAt: stale[0].generated_at, topics: stale };

  return { state: "empty", generatedAt: null, topics: [] };
}

/** One-tap Draft this: topic row → existing draftFromTrend → sign-off queue (drafts table). */
export async function draftFromTopicRow(profileId: string, topic: TopicRowView) {
  const gated: GatedTrend = {
    trend: {
      topic: topic.topic,
      why_now: String(topic.why.why_now ?? ""),
      angle: topic.angle,
      source: topic.sources[0]?.url,
    },
    angle: topic.angle,
    reason: String(topic.why.reason ?? ""),
  };
  return draftFromTrend(profileId, gated);
}
```

NOTE: `GatedTrend` is exported from `src/server/credibility.ts` (a `"use server"` module exporting an interface — type-only import is fine).

- [ ] **Step 6: Run tests** — `npx vitest run src/server/topics.test.ts src/lib/topics/dispatch.test.ts` → PASS. Full suite green.

- [ ] **Step 7: Commit** — `git add src/server/topics.ts src/server/topics.test.ts src/lib/topics/dispatch.ts src/lib/topics/dispatch.test.ts && git commit -m "feat(topics): freshness chain server actions + workflow_dispatch background refresh"`

---

## Task 8: Worker script + refresh workflow

**Files:**
- Create: `scripts/refresh-topics.ts`
- Create: `.github/workflows/refresh-topics.yml`

- [ ] **Step 1: Write the worker script**

```typescript
// scripts/refresh-topics.ts
// GH Actions / local worker: regenerate the topic board for every profile.
// Builds its own service-role client — must NOT import src/lib/supabase/server
// (that module pulls next/headers, which dies outside a Next request).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/types";
import { generateTopicBoard } from "../src/lib/topics/board";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient<Database>(url, key, { auth: { persistSession: false } });

  const { data: profiles, error } = await sb.from("profiles").select("id, handle");
  if (error) throw new Error(error.message);
  if (!profiles || profiles.length === 0) {
    console.log("no profiles — nothing to do");
    return;
  }

  let failed = 0;
  for (const p of profiles) {
    try {
      const n = await generateTopicBoard(sb, p.id);
      console.log(`board written: @${p.handle} → ${n} topics`);
    } catch (e) {
      failed++;
      console.error(`board FAILED: @${p.handle}:`, e instanceof Error ? e.message : e);
    }
  }
  if (failed === profiles.length) {
    process.exitCode = 1; // all failed = job failure; partial success keeps the green
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Local smoke run** (proves tsx resolves `@/` aliases + the full pipeline before touching CI):

```bash
npx tsx --env-file=.env.local scripts/refresh-topics.ts
```
Expected: `board written: @FCisco95 → N topics` (claude CLI is installed locally; research mode may take up to 5 min). If tsx fails on `@/` alias resolution, add `--tsconfig tsconfig.json`; if still failing, install `tsconfig-paths` and run `npx tsx -r tsconfig-paths/register scripts/refresh-topics.ts` — mirror whatever works into the workflow step.

Then verify rows landed — Supabase MCP: `SELECT count(*), max(generated_at) FROM topic_history;` → count > 0.

- [ ] **Step 3: Write the workflow**

```yaml
# .github/workflows/refresh-topics.yml
name: refresh-topics

on:
  schedule:
    - cron: "30 6-22/3 * * *"   # every 3h, waking hours UTC (Lisbon=UTC+1)
  workflow_dispatch: {}

concurrency:
  group: refresh-topics
  cancel-in-progress: false

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Install Claude Code CLI
        run: npm install -g @anthropic-ai/claude-code
      - name: Refresh topic boards
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GOOGLE_GENERATIVE_AI_API_KEY: ${{ secrets.GOOGLE_GENERATIVE_AI_API_KEY }}
        run: npx tsx scripts/refresh-topics.ts
```

- [ ] **Step 4: Set GH secrets**

```bash
# From .env.local (piped, not echoed):
foreach ($name in "NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","OPENAI_API_KEY") {
  (Get-Content .env.local | Where-Object { $_ -match "^$name=" }) -replace "^$name=","" | gh secret set $name --repo FCisco95/embalio
}
```

`CLAUDE_CODE_OAUTH_TOKEN` — **user-assisted step**: Cisco runs `! claude setup-token` (interactive browser flow, rides Max plan), then:
```bash
gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo FCisco95/embalio
# (paste token at prompt — or pipe it)
```
`GOOGLE_GENERATIVE_AI_API_KEY` — optional fallback; set if/when Cisco creates a free AI Studio key. Workflow tolerates its absence.

- [ ] **Step 5: Commit + push + live-fire**

```bash
git add scripts/refresh-topics.ts .github/workflows/refresh-topics.yml
git commit -m "feat(topics): zero-spend GH Actions refresh worker on Claude Max OAuth"
git push origin main
gh workflow run refresh-topics --repo FCisco95/embalio
gh run watch --repo FCisco95/embalio --exit-status
```
Expected: green; then Supabase MCP `SELECT count(*) FROM topic_history WHERE status='fresh';` > 0 with fresh `generated_at`.

(Optional, enables in-app background refresh: create fine-grained PAT with Actions read/write on FCisco95/embalio → `vercel env add GITHUB_DISPATCH_TOKEN production` → redeploy. Skippable; scheduled cadence covers freshness without it.)

---

## Task 9: `/topics` UI + bottom-nav slot

**Files:**
- Create: `src/app/(app)/topics/page.tsx`
- Create: `src/components/topics/topic-board.tsx`
- Create: `src/components/topics/topic-card.tsx`
- Create: `src/lib/topics/format.ts`
- Modify: `src/components/shell/nav-items.ts:11-19`
- Test: `src/lib/topics/format.test.ts`

- [ ] **Step 1: Failing test for relative-time formatter**

```typescript
// src/lib/topics/format.test.ts
import { describe, it, expect } from "vitest";
import { formatAgo } from "./format";

describe("formatAgo", () => {
  const now = Date.parse("2026-06-11T12:00:00Z");
  it("minutes", () => expect(formatAgo("2026-06-11T11:42:00Z", now)).toBe("18m ago"));
  it("just now under a minute", () => expect(formatAgo("2026-06-11T11:59:40Z", now)).toBe("just now"));
  it("hours", () => expect(formatAgo("2026-06-11T09:00:00Z", now)).toBe("3h ago"));
  it("days", () => expect(formatAgo("2026-06-09T12:00:00Z", now)).toBe("2d ago"));
  it("invalid date → null (caller must not render)", () => expect(formatAgo("garbage", now)).toBeNull());
});
```

- [ ] **Step 2: Implement formatter**

```typescript
// src/lib/topics/format.ts
/** Relative "updated Xm ago" stamp. Returns null for unparseable input — and a
 * null stamp means the card must NOT render (spec freshness QA rule #1). */
export function formatAgo(iso: string, nowMs: number = Date.now()): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const mins = Math.floor((nowMs - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
```

Run: `npx vitest run src/lib/topics/format.test.ts` → PASS.

- [ ] **Step 3: Nav slot** — edit `src/components/shell/nav-items.ts`: add Topics right after Home, demote Brand Voice from primary (mobile keeps 5 slots: Home · Topics · Engage · Composer · Reach — matches the spec's Home/Topics/Engage/Stats/Queue direction; Queue/Stats renames land in P3):

```typescript
import { Home, Reply, PenLine, Target, LineChart, Video, Settings2, Flame } from "lucide-react";

export const NAV: NavItem[] = [
  { href: "/",            icon: Home,      label: "Home",        primary: true },
  { href: "/topics",      icon: Flame,     label: "Topics",      primary: true },
  { href: "/engage",      icon: Reply,     label: "Engage",      primary: true },
  { href: "/compose",     icon: PenLine,   label: "Composer",    primary: true },
  { href: "/board",       icon: Target,    label: "Targeting"                  },
  { href: "/performance", icon: LineChart, label: "Reach",       primary: true },
  { href: "/studio",      icon: Video,     label: "Studio"                     },
  { href: "/profiles",    icon: Settings2, label: "Brand Voice"                },
];
```
(Keep the existing `NavItem` type and any other exports in that file untouched; match the file's exact current import list before editing.)

- [ ] **Step 4: Page (server component)** — mirror the profiles-fetch pattern used by `src/app/(app)/engage/page.tsx` (read that file first; reuse its exact profiles query + auth/layout wrappers):

```tsx
// src/app/(app)/topics/page.tsx
import { supabaseServer } from "@/lib/supabase/server";
import { TopicBoard } from "@/components/topics/topic-board";

export default async function TopicsPage() {
  const sb = await supabaseServer();
  const { data: profiles } = await sb.from("profiles").select("id, handle").order("created_at");
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <h1 className="text-lg font-semibold">Topics</h1>
      <p className="text-sm text-muted-foreground">Scored board — fresh on open, grounded in your own signal.</p>
      <TopicBoard profiles={profiles ?? []} />
    </main>
  );
}
```
(Adapt the wrapper classes to whatever `engage/page.tsx` actually uses — match sibling pages, not this sketch.)

- [ ] **Step 5: Board client component**

```tsx
// src/components/topics/topic-board.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { getTopicBoard, type TopicBoardView } from "@/server/topics";
import { TopicCard } from "./topic-card";

const BANNERS: Partial<Record<TopicBoardView["state"], { text: string; cls: string }>> = {
  cached: { text: "Board is over an hour old — background refresh fired.", cls: "bg-zinc-800 text-zinc-300" },
  briefing: { text: "Low confidence: from today's research briefing — live board pending.", cls: "bg-sky-950 text-sky-300" },
  stale: { text: "Showing an older board — fresh topics are on the way.", cls: "bg-amber-950 text-amber-300" },
};

export function TopicBoard({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [view, setView] = useState<TopicBoardView | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (pid: string) => {
    if (!pid) return;
    setLoading(true);
    try { setView(await getTopicBoard(pid)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(profileId); }, [profileId, load]); // fresh-on-open

  return (
    <div className="mt-4 space-y-3">
      {profiles.length > 1 && (
        <select value={profileId} onChange={(e) => setProfileId(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm">
          {profiles.map((p) => <option key={p.id} value={p.id}>@{p.handle}</option>)}
        </select>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading board…</p>}
      {view && BANNERS[view.state] && (
        <div className={`rounded-md px-3 py-2 text-xs ${BANNERS[view.state]!.cls}`}>{BANNERS[view.state]!.text}</div>
      )}
      {view?.state === "empty" && !loading && (
        <p className="rounded-md bg-zinc-900 px-3 py-6 text-center text-sm text-muted-foreground">
          First board is being generated — check back in a few minutes.
        </p>
      )}
      {view?.topics.map((t) => (
        <TopicCard key={t.id} topic={t} profileId={profileId} draftable={view.state !== "briefing"} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Card component**

```tsx
// src/components/topics/topic-card.tsx
"use client";
import { useState } from "react";
import { draftFromTopicRow, type TopicRowView } from "@/server/topics";
import { formatAgo } from "@/lib/topics/format";

function scoreCls(score: number) {
  if (score >= 75) return "bg-emerald-900 text-emerald-300";
  if (score >= 50) return "bg-amber-900 text-amber-300";
  return "bg-zinc-800 text-zinc-400";
}

const WINDOW_LABEL: Record<string, string> = {
  react: "⚡ react <2h", verdict: "🕐 verdict 24–48h", saturated: "🪨 saturated",
};

export function TopicCard({ topic, profileId, draftable }: {
  topic: TopicRowView; profileId: string; draftable: boolean;
}) {
  const [state, setState] = useState<"idle" | "drafting" | "done" | "error">("idle");
  const ago = formatAgo(topic.generated_at);
  if (!ago) return null; // no timestamp → no render (spec freshness QA #1)

  const why = topic.why as { niche_fit?: number; heat?: number; credibility?: number; timing?: number; window?: string; kind?: string; why_now?: string; reason?: string };
  const chips: [string, number | undefined][] = [
    ["niche", why.niche_fit], ["heat", why.heat], ["cred", why.credibility], ["timing", why.timing],
  ];

  async function draft() {
    setState("drafting");
    try { await draftFromTopicRow(profileId, topic); setState("done"); }
    catch { setState("error"); }
  }

  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <header className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-tight">{topic.topic}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreCls(topic.score)}`}>{topic.score}</span>
      </header>
      {why.why_now && <p className="mt-1 text-xs text-zinc-400">{why.why_now}</p>}
      <p className="mt-1 text-xs text-zinc-300">→ {topic.angle}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        {why.kind && (
          <span className={`rounded px-1.5 py-0.5 ${why.kind === "spike" ? "bg-rose-950 text-rose-300" : "bg-emerald-950 text-emerald-300"}`}>
            {why.kind === "spike" ? "⚡ spike" : "🌱 durable"}
          </span>
        )}
        {why.window && <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-400">{WINDOW_LABEL[why.window] ?? why.window}</span>}
        {chips.filter(([, v]) => typeof v === "number").map(([k, v]) => (
          <span key={k} className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-400">{k} {v}</span>
        ))}
        <span className="ml-auto text-zinc-500">updated {ago}</span>
      </div>
      {topic.sources.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {topic.sources.map((s, i) => (
            <li key={i} className="truncate text-[11px]">
              <a href={s.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                {s.title ?? s.url}
              </a>
              {s.published_at && <span className="text-zinc-500"> · {s.published_at}</span>}
            </li>
          ))}
        </ul>
      )}
      {draftable && (
        <button onClick={draft} disabled={state === "drafting" || state === "done"}
          className="mt-3 w-full rounded-md bg-zinc-100 py-2 text-sm font-medium text-zinc-900 disabled:opacity-60">
          {state === "idle" && "Draft this"}
          {state === "drafting" && "Drafting…"}
          {state === "done" && "In queue ✓ — open Composer"}
          {state === "error" && "Failed — tap to retry"}
        </button>
      )}
    </article>
  );
}
```
(Visual idiom: match existing components — read `src/components/trend-radar.tsx` first and reuse its button/badge/Tailwind patterns over this sketch where they differ.)

- [ ] **Step 7: Build + suite**

Run: `npm test` → all green (≥442 + new). Run: `npm run build` → compiles clean (catches server/client boundary mistakes).

- [ ] **Step 8: Commit**

```bash
git add src/app/(app)/topics src/components/topics src/components/shell/nav-items.ts src/lib/topics/format.ts src/lib/topics/format.test.ts
git commit -m "feat(topics): /topics mobile board — score pills, why-chips, freshness stamps, one-tap Draft this"
```

---

## Task 10: Final verification + ship

- [ ] **Step 1: Full gates**

```bash
npm test         # ≥442 baseline green + all new tests
npm run lint     # clean
npm run build    # clean
```

- [ ] **Step 2: Deploy + live worker run**

```bash
git push origin main
vercel deploy --prod
gh workflow run refresh-topics --repo FCisco95/embalio && gh run watch --repo FCisco95/embalio --exit-status
```

- [ ] **Step 3: Live freshness check** — Supabase MCP:

```sql
SELECT profile_id, count(*) AS topics, max(generated_at) AS latest, max(score) AS top_score
FROM topic_history WHERE status = 'fresh' GROUP BY profile_id;
```
Expected: ≥1 profile with fresh rows < 3h old. Also re-check gate (a): `SELECT count(*) FROM signal_tweets;` still growing.

- [ ] **Step 4: Phone dogfood (user)** — Cisco opens `$APP_URL/topics` on phone: install PWA, board renders with timestamps, tap Draft this, check `/compose` queue. Report results.

- [ ] **Step 5: Vault bookkeeping** — update `10 - PROJECTS/Embalio/_hub/Embalio — Next Steps.md` (P2 status), commit vault.

---

## Self-review notes

- Spec coverage: route+nav (T9), scorer with 4 components (T3/T4), freshness chain incl. never-empty/never-unlabeled (T7), zero-spend worker on OAuth token + Gemini fallback + warehouse-grounded prompt (T5/T6/T8), Draft-this → existing draftFromTrend (T7/T9), timestamps mandatory (T7 filter + T9 null-render), sources zod-required (T2), spike/durable badge (T2/T9), profileId everywhere (no FIXED_PROFILE_ID in new code), step-zero cron unblock (T0/T1).
- Out of scope (later phases, deliberate): /queue + /performance renames, web-push, sniper, KPI cards, RLS for topic_history (service-role-only table, same posture as research_briefings).
- Known risk: supabase-js chain shapes in mocks (T3/T7) may need joint test+impl adjustment — flagged inline.
