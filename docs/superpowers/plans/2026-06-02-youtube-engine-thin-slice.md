# YouTube Engine — Thin Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first end-to-end YouTube Engine slice inside Embalio — pick a trending topic → generate an editable script → record-hub teleprompter driven by a per-device profile → real (forced-private) YouTube upload → draft an X thread into the existing sign-off queue.

**Architecture:** A project-centric pipeline. One `video_projects` row threads through stages (`topic → script → record → publish → repurposed`) rendered by a new `/studio` section's stage rail. The creative "brain" (topic ranking + script authoring) sits behind a swappable `BrainClient` interface, implemented in slice 1 by the existing local `claude -p` path (`generateStructured`) so it can be swapped for an external Agent SDK skill chain later with zero UI change. Three new Supabase tables; the X handoff reuses the existing `drafts` queue.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Supabase (`@supabase/ssr` + service-role), Zod 4, Vitest, `googleapis` (new dep), Hacker News Algolia API (free, no key).

**Spec:** `docs/superpowers/specs/2026-06-02-youtube-engine-thin-slice-design.md`

---

## Conventions (read once)

- **Generation:** `generateStructured<T>(schema, prompt, opts?, runner?)` from `@/lib/generate` returns `{ data: T } | { data: null; raw }`. It already retries once on schema-validation failure.
- **DB clients:** `supabaseService()` (alias `supabaseApp`) from `@/lib/supabase/server` is the service-role client used by app pages/server-data (see `src/server/profiles.ts`). Studio server actions use it. The X-thread handoff reuses the existing `saveDraftToQueue` (which uses `supabaseServer()` — leave it; it's the canonical queue seam).
- **Active profile:** `(await listProfiles())[0]` from `@/server/profiles` (gated by `FIXED_PROFILE_ID`). A `getActiveProfile()` helper is added in Task 7.
- **Retry:** `withRetry(fn, opts)` from `@/lib/retry`.
- **Tests:** colocated `*.test.ts`, run with `npm test` (vitest). No live network/API in tests — inject `fetch`/runner/clients. Run a single file with `npx vitest run <path>`.
- **Migrations:** numbered SQL in `supabase/migrations/`. Next free numbers are `0009`, `0010`, `0011`. Applying to the live Supabase project (ref `vzxpakxjnuaesfxihyvl`) is done with the Supabase MCP `apply_migration` and **requires owner confirmation** (additive, but touches the live DB). Writing the files is safe.
- **Build gotcha:** never run `npm run build` while `npm run dev` is up (clashes on `.next`).

## File map

**New — library (pure/logic, unit-tested):**
- `src/lib/studio/schemas.ts` — Zod schemas + types (TrendSignal, RankedTopic, ScriptBeat, VideoScript, stages).
- `src/lib/studio/stages.ts` — stage-transition validator.
- `src/lib/studio/signals.ts` — Hacker News trend-signal collector.
- `src/lib/studio/brain.ts` — `BrainClient` interface + `makeLocalClaudeBrain` + prompt builders.
- `src/lib/studio/recording-profile.ts` — device→profile resolution + browser localStorage helpers.
- `src/lib/youtube.ts` — googleapis OAuth + resumable upload wrapper.

**New — server actions:**
- `src/server/studio/recording-profiles.ts`
- `src/server/studio/projects.ts`
- `src/server/studio/publish.ts`
- `src/server/studio/repurpose.ts`

**New — routes/UI:**
- `src/app/api/youtube/oauth/start/route.ts`, `src/app/api/youtube/oauth/callback/route.ts`
- `src/app/(app)/studio/page.tsx`
- `src/components/studio/studio-flow.tsx` (client orchestrator + stage rail)
- `src/components/studio/topic-board.tsx`, `script-studio.tsx`, `record-hub.tsx`, `publish-panel.tsx`, `repurpose-panel.tsx`, `render-panel.tsx`, `device-picker.tsx`

**New — migrations:**
- `supabase/migrations/0009_recording_profiles.sql`
- `supabase/migrations/0010_video_projects.sql`
- `supabase/migrations/0011_youtube_credentials.sql`

**Modified:**
- `src/components/shell/sidebar.tsx` — add the Studio nav entry.
- `src/lib/supabase/types.ts` — regenerated after migrations.

---

## Task 1: Database migrations + regenerated types

**Files:**
- Create: `supabase/migrations/0009_recording_profiles.sql`
- Create: `supabase/migrations/0010_video_projects.sql`
- Create: `supabase/migrations/0011_youtube_credentials.sql`
- Modify: `src/lib/supabase/types.ts` (regenerate)

- [ ] **Step 1: Write `0009_recording_profiles.sql`**

```sql
-- 0009_recording_profiles.sql
-- Per-device recording configuration, synced across machines via Supabase.
create table if not exists recording_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  device_label text not null,
  os text not null,                       -- 'windows' | 'macos'
  monitors jsonb not null default '[]',   -- [{ resolution, role }]
  capture_tool text not null,             -- 'OBS+Rapidemo' | 'OBS'
  mic text,
  webcam text,
  teleprompter_placement text not null default 'top-center',
  scene_presets jsonb not null default '[]',
  export_path text,
  sync_target text,
  created_at timestamptz not null default now()
);
create index if not exists recording_profiles_profile_id_idx on recording_profiles(profile_id);

alter table recording_profiles enable row level security;
drop policy if exists recording_profiles_owner on recording_profiles;
create policy recording_profiles_owner on recording_profiles
  for all using (
    profile_id in (select id from profiles where user_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where user_id = auth.uid())
  );
```

- [ ] **Step 2: Write `0010_video_projects.sql`**

```sql
-- 0010_video_projects.sql
-- The spine: one row per video, threaded through pipeline stages.
create table if not exists video_projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  stage text not null default 'topic',    -- topic|script|record|publish|repurposed
  topic jsonb,                             -- RankedTopic
  script jsonb,                            -- VideoScript
  recording jsonb,                         -- { recording_profile_id, take_confirmed_at, notes }
  publish jsonb,                           -- { youtube_video_id, url, privacy_status, published_at }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists video_projects_profile_id_idx on video_projects(profile_id);

alter table video_projects enable row level security;
drop policy if exists video_projects_owner on video_projects;
create policy video_projects_owner on video_projects
  for all using (
    profile_id in (select id from profiles where user_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where user_id = auth.uid())
  );
```

- [ ] **Step 3: Write `0011_youtube_credentials.sql`**

```sql
-- 0011_youtube_credentials.sql
-- OAuth refresh token for videos.insert. Service-role only; never read via anon/RLS.
create table if not exists youtube_credentials (
  profile_id uuid primary key references profiles(id) on delete cascade,
  refresh_token text not null,
  scope text,
  obtained_at timestamptz not null default now()
);
alter table youtube_credentials enable row level security;
-- No anon policy on purpose: only the service-role client (which bypasses RLS) touches this table.
```

- [ ] **Step 4: Apply migrations to the live project (owner-gated)**

Confirm with the owner first. Then apply each file with the Supabase MCP `apply_migration` (project ref `vzxpakxjnuaesfxihyvl`), name = the file's basename, query = the file's SQL. Verify with `list_tables` that all three tables exist.

- [ ] **Step 5: Regenerate `src/lib/supabase/types.ts`**

Use the Supabase MCP `generate_typescript_types` (project ref `vzxpakxjnuaesfxihyvl`) and overwrite `src/lib/supabase/types.ts` with the result. Confirm the three new tables appear under `Database['public']['Tables']`.

- [ ] **Step 6: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors referencing the new tables.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0009_recording_profiles.sql supabase/migrations/0010_video_projects.sql supabase/migrations/0011_youtube_credentials.sql src/lib/supabase/types.ts
git commit -m "feat(studio): add recording_profiles, video_projects, youtube_credentials tables"
```

---

## Task 2: Studio Zod schemas

**Files:**
- Create: `src/lib/studio/schemas.ts`
- Test: `src/lib/studio/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { RankedTopic, RankedTopicList, VideoScript, TrendSignal, STUDIO_STAGES } from "./schemas";

describe("studio schemas", () => {
  it("parses a valid RankedTopic", () => {
    const t = RankedTopic.parse({ id: "t1", title: "I shipped a Solana app with Claude", angle: "vibe-coding on chain", score: 87, rationale: "fits niche", sourceRefs: ["https://x"] });
    expect(t.score).toBe(87);
  });
  it("rejects an out-of-range score", () => {
    expect(() => RankedTopic.parse({ id: "t1", title: "x", angle: "y", score: 140, rationale: "z" })).toThrow();
  });
  it("parses a RankedTopicList wrapper", () => {
    const list = RankedTopicList.parse({ topics: [{ id: "t1", title: "x", angle: "y", score: 10, rationale: "z" }] });
    expect(list.topics).toHaveLength(1);
  });
  it("parses a VideoScript with beats", () => {
    const s = VideoScript.parse({ title: "T", hook: "H", beats: [{ id: "b1", say: "say this", visualPrompt: "show code", estSeconds: 8 }] });
    expect(s.beats[0].visualPrompt).toBe("show code");
  });
  it("normalizes a TrendSignal", () => {
    const sig = TrendSignal.parse({ source: "hackernews", id: "1", title: "x", url: "https://x" });
    expect(sig.source).toBe("hackernews");
  });
  it("exposes the canonical stage order", () => {
    expect(STUDIO_STAGES).toEqual(["topic", "script", "record", "publish", "repurposed"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/studio/schemas.test.ts`
Expected: FAIL — cannot find module `./schemas`.

- [ ] **Step 3: Implement `src/lib/studio/schemas.ts`**

```ts
import { z } from "zod";

export const STUDIO_STAGES = ["topic", "script", "record", "publish", "repurposed"] as const;
export type StudioStage = (typeof STUDIO_STAGES)[number];

export const TrendSignal = z.object({
  source: z.enum(["hackernews", "apify-x", "github-trending"]),
  id: z.string(),
  title: z.string(),
  url: z.string(),
  score: z.number().optional(),
  comments: z.number().optional(),
  createdAt: z.string().optional(),
});
export type TrendSignal = z.infer<typeof TrendSignal>;

export const RankedTopic = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  angle: z.string().min(1).max(400),
  score: z.number().min(0).max(100),
  rationale: z.string().min(1).max(600),
  sourceRefs: z.array(z.string()).default([]),
});
export type RankedTopic = z.infer<typeof RankedTopic>;
export const RankedTopicList = z.object({ topics: z.array(RankedTopic).min(1).max(10) });
export type RankedTopicList = z.infer<typeof RankedTopicList>;

export const ScriptBeat = z.object({
  id: z.string().min(1),
  say: z.string().min(1).max(600),
  visualPrompt: z.string().min(1).max(400),
  estSeconds: z.number().min(1).max(120).optional(),
});
export type ScriptBeat = z.infer<typeof ScriptBeat>;

export const VideoScript = z.object({
  title: z.string().min(1).max(120),
  hook: z.string().min(1).max(400),
  beats: z.array(ScriptBeat).min(1).max(40),
});
export type VideoScript = z.infer<typeof VideoScript>;

export const RecordingState = z.object({
  recording_profile_id: z.string().nullable().default(null),
  take_confirmed_at: z.string().nullable().default(null),
  notes: z.string().default(""),
});
export type RecordingState = z.infer<typeof RecordingState>;

export const PublishState = z.object({
  youtube_video_id: z.string(),
  url: z.string(),
  privacy_status: z.string(),
  published_at: z.string(),
});
export type PublishState = z.infer<typeof PublishState>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/studio/schemas.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/schemas.ts src/lib/studio/schemas.test.ts
git commit -m "feat(studio): zod schemas for topics, scripts, signals, stages"
```

---

## Task 3: Stage-transition validator

**Files:**
- Create: `src/lib/studio/stages.ts`
- Test: `src/lib/studio/stages.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { canTransition, nextStage } from "./stages";

describe("stage transitions", () => {
  it("allows a single forward step", () => {
    expect(canTransition("topic", "script")).toBe(true);
    expect(canTransition("script", "record")).toBe(true);
  });
  it("allows stepping back to re-edit", () => {
    expect(canTransition("record", "script")).toBe(true);
    expect(canTransition("publish", "topic")).toBe(true);
  });
  it("rejects skipping forward by more than one", () => {
    expect(canTransition("topic", "record")).toBe(false);
  });
  it("rejects unknown stages", () => {
    // @ts-expect-error invalid stage
    expect(canTransition("topic", "bogus")).toBe(false);
  });
  it("returns the next stage or null at the end", () => {
    expect(nextStage("topic")).toBe("script");
    expect(nextStage("repurposed")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/studio/stages.test.ts`
Expected: FAIL — cannot find module `./stages`.

- [ ] **Step 3: Implement `src/lib/studio/stages.ts`**

```ts
import { STUDIO_STAGES, type StudioStage } from "./schemas";

const ORDER: readonly StudioStage[] = STUDIO_STAGES;

export function canTransition(from: StudioStage, to: StudioStage): boolean {
  const fi = ORDER.indexOf(from);
  const ti = ORDER.indexOf(to);
  if (fi < 0 || ti < 0) return false;
  // Forward by exactly one, or back to any earlier stage (re-edit).
  return ti === fi + 1 || ti < fi;
}

export function nextStage(from: StudioStage): StudioStage | null {
  const fi = ORDER.indexOf(from);
  return fi >= 0 && fi < ORDER.length - 1 ? ORDER[fi + 1] : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/studio/stages.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/stages.ts src/lib/studio/stages.test.ts
git commit -m "feat(studio): stage-transition validator"
```

---

## Task 4: Hacker News trend-signal collector

**Files:**
- Create: `src/lib/studio/signals.ts`
- Test: `src/lib/studio/signals.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { collectTrendSignals } from "./signals";

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => payload })) as unknown as typeof fetch;
}

describe("collectTrendSignals", () => {
  it("normalizes HN hits into TrendSignal[]", async () => {
    const f = fakeFetch({ hits: [
      { objectID: "1", title: "Vibe coding on Solana", url: "https://a", points: 120, num_comments: 30, created_at: "2026-06-01T00:00:00Z" },
      { objectID: "2", title: "", url: "https://b" }, // dropped: no title
    ] });
    const out = await collectTrendSignals({ limit: 10 }, f);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: "hackernews", id: "1", title: "Vibe coding on Solana", score: 120 });
  });
  it("falls back to the HN item URL when a hit has no url", async () => {
    const f = fakeFetch({ hits: [{ objectID: "9", title: "x" }] });
    const out = await collectTrendSignals({}, f);
    expect(out[0].url).toBe("https://news.ycombinator.com/item?id=9");
  });
  it("throws on a non-OK response", async () => {
    await expect(collectTrendSignals({}, fakeFetch({}, false))).rejects.toThrow(/HN search failed/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/studio/signals.test.ts`
Expected: FAIL — cannot find module `./signals`.

- [ ] **Step 3: Implement `src/lib/studio/signals.ts`**

```ts
import type { TrendSignal } from "./schemas";

const HN_ENDPOINT = "https://hn.algolia.com/api/v1/search";
const DEFAULT_QUERY = 'AI OR LLM OR "vibe coding" OR Solana OR blockchain OR "Claude Code"';

interface HnHit {
  objectID: string;
  title?: string;
  url?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
}

function normalizeHit(h: HnHit): TrendSignal {
  return {
    source: "hackernews",
    id: h.objectID,
    title: h.title ?? "",
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    score: h.points,
    comments: h.num_comments,
    createdAt: h.created_at,
  };
}

export async function collectTrendSignals(
  opts: { query?: string; limit?: number } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<TrendSignal[]> {
  const query = opts.query ?? DEFAULT_QUERY;
  const url = `${HN_ENDPOINT}?tags=story&query=${encodeURIComponent(query)}&hitsPerPage=${opts.limit ?? 20}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`HN search failed: ${res.status}`);
  const json = (await res.json()) as { hits: HnHit[] };
  return (json.hits ?? []).filter((h) => h.title && h.title.trim()).map(normalizeHit);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/studio/signals.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/signals.ts src/lib/studio/signals.test.ts
git commit -m "feat(studio): Hacker News trend-signal collector"
```

---

## Task 5: BrainClient + LocalClaudeBrain

**Files:**
- Create: `src/lib/studio/brain.ts`
- Test: `src/lib/studio/brain.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { makeLocalClaudeBrain, buildRankPrompt, buildScriptPrompt } from "./brain";
import type { RankedTopic } from "./schemas";

describe("LocalClaudeBrain", () => {
  it("rankTopics returns parsed topics and respects count", async () => {
    const gen = vi.fn(async () => ({ data: { topics: [
      { id: "a", title: "A", angle: "x", score: 90, rationale: "r", sourceRefs: [] },
      { id: "b", title: "B", angle: "y", score: 80, rationale: "r", sourceRefs: [] },
    ] } }));
    const brain = makeLocalClaudeBrain(gen as never);
    const out = await brain.rankTopics({ niche: "vibe coding on blockchain", signals: [], count: 1 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("a");
  });
  it("writeScript returns a parsed VideoScript", async () => {
    const gen = vi.fn(async () => ({ data: { title: "T", hook: "H", beats: [{ id: "b1", say: "s", visualPrompt: "v" }] } }));
    const brain = makeLocalClaudeBrain(gen as never);
    const topic: RankedTopic = { id: "a", title: "A", angle: "x", score: 90, rationale: "r", sourceRefs: [] };
    const out = await brain.writeScript({ topic });
    expect(out.beats[0].say).toBe("s");
  });
  it("throws a friendly error when generation returns null", async () => {
    const gen = vi.fn(async () => ({ data: null, raw: "junk" }));
    const brain = makeLocalClaudeBrain(gen as never);
    await expect(brain.rankTopics({ niche: "x", signals: [] })).rejects.toThrow(/topic ranking failed/);
  });
  it("prompt builders include the niche and the topic title", () => {
    expect(buildRankPrompt({ niche: "NICHE", signals: [{ source: "hackernews", id: "1", title: "SIG", url: "u" }] })).toContain("NICHE");
    expect(buildRankPrompt({ niche: "NICHE", signals: [{ source: "hackernews", id: "1", title: "SIG", url: "u" }] })).toContain("SIG");
    const topic: RankedTopic = { id: "a", title: "TITLE", angle: "x", score: 1, rationale: "r", sourceRefs: [] };
    expect(buildScriptPrompt({ topic })).toContain("TITLE");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/studio/brain.test.ts`
Expected: FAIL — cannot find module `./brain`.

- [ ] **Step 3: Implement `src/lib/studio/brain.ts`**

```ts
import { generateStructured } from "@/lib/generate";
import { RankedTopicList, VideoScript, type RankedTopic, type TrendSignal } from "./schemas";

export interface RankRequest {
  niche: string;
  voiceSpec?: string;
  signals: TrendSignal[];
  count?: number;
}
export interface ScriptRequest {
  topic: RankedTopic;
  voiceSpec?: string;
  targetDurationSec?: number;
}
export interface BrainClient {
  rankTopics(req: RankRequest): Promise<RankedTopic[]>;
  writeScript(req: ScriptRequest): Promise<VideoScript>;
}

export function buildRankPrompt(req: RankRequest): string {
  const signalLines = req.signals
    .map((s) => `- [${s.source}] ${s.title} (${s.url})${s.score ? ` · ${s.score} pts` : ""}`)
    .join("\n");
  return [
    `You are the editorial brain for a solo-dev YouTube channel.`,
    `Niche: ${req.niche}.`,
    req.voiceSpec ? `Creator voice:\n${req.voiceSpec}` : "",
    `Below are trending signals. Rank the best video topics for THIS niche (a vibe-coder who builds on blockchain and builds in public).`,
    `For each topic give: id (slug), title (packaging-rule, <=120 chars), angle (why this, for this niche), score 0-100 (brand fit), rationale, sourceRefs (the urls you used).`,
    `Return at most 6 topics, best first.`,
    `Signals:\n${signalLines}`,
    `Respond as JSON: { "topics": RankedTopic[] }.`,
  ].filter(Boolean).join("\n\n");
}

export function buildScriptPrompt(req: ScriptRequest): string {
  return [
    `You are scripting a real-face, screen-recorded solo-dev YouTube video.`,
    req.voiceSpec ? `Creator voice:\n${req.voiceSpec}` : "",
    `Topic: ${req.topic.title}`,
    `Angle: ${req.topic.angle}`,
    `Target length: ~${req.targetDurationSec ?? 360} seconds.`,
    `Write: a packaging-rule title; a hook that PAYS OFF in the first 15 seconds; then teleprompter "beats".`,
    `Each beat has: id, say (the exact teleprompter line to read), visualPrompt (the on-screen element/screen-capture for that line), estSeconds.`,
    `Front-load the face + payoff; body is screen-only. Keep it tight.`,
    `Respond as JSON matching: { title, hook, beats: { id, say, visualPrompt, estSeconds }[] }.`,
  ].filter(Boolean).join("\n\n");
}

type Gen = typeof generateStructured;

export function makeLocalClaudeBrain(gen: Gen = generateStructured): BrainClient {
  return {
    async rankTopics(req) {
      const r = await gen(RankedTopicList, buildRankPrompt(req));
      if (!r.data) throw new Error("topic ranking failed — try again");
      return req.count ? r.data.topics.slice(0, req.count) : r.data.topics;
    },
    async writeScript(req) {
      const r = await gen(VideoScript, buildScriptPrompt(req));
      if (!r.data) throw new Error("script generation failed — try again");
      return r.data;
    },
  };
}

/** Slice-1 brain. Swap this binding for an Agent-SDK-backed BrainClient later. */
export const brain: BrainClient = makeLocalClaudeBrain();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/studio/brain.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/brain.ts src/lib/studio/brain.test.ts
git commit -m "feat(studio): BrainClient interface + local claude -p implementation"
```

---

## Task 6: Recording-profile device resolution

**Files:**
- Create: `src/lib/studio/recording-profile.ts`
- Test: `src/lib/studio/recording-profile.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveRecordingProfileId } from "./recording-profile";

describe("resolveRecordingProfileId", () => {
  it("returns the mapped profile id for a known device", () => {
    expect(resolveRecordingProfileId("dev-1", { "dev-1": "rp-home" })).toBe("rp-home");
  });
  it("returns the fallback when the device is unknown", () => {
    expect(resolveRecordingProfileId("dev-x", { "dev-1": "rp-home" }, "rp-travel")).toBe("rp-travel");
  });
  it("returns null when no mapping and no fallback", () => {
    expect(resolveRecordingProfileId(null, {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/studio/recording-profile.test.ts`
Expected: FAIL — cannot find module `./recording-profile`.

- [ ] **Step 3: Implement `src/lib/studio/recording-profile.ts`**

```ts
export type DeviceMap = Record<string, string>; // deviceId -> recording_profile.id

export function resolveRecordingProfileId(
  deviceId: string | null,
  map: DeviceMap,
  fallback?: string,
): string | null {
  if (deviceId && map[deviceId]) return map[deviceId];
  return fallback ?? null;
}

// --- Browser-only helpers (guarded so the module is import-safe on the server) ---

const DEVICE_ID_KEY = "embalio.studio.deviceId";
const DEVICE_MAP_KEY = "embalio.studio.deviceMap";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (window.crypto?.randomUUID?.() ?? `dev-${Date.now()}`);
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function readDeviceMap(): DeviceMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(DEVICE_MAP_KEY) ?? "{}") as DeviceMap;
  } catch {
    return {};
  }
}

export function setDeviceMapping(deviceId: string, recordingProfileId: string): void {
  if (typeof window === "undefined") return;
  const map = readDeviceMap();
  map[deviceId] = recordingProfileId;
  window.localStorage.setItem(DEVICE_MAP_KEY, JSON.stringify(map));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/studio/recording-profile.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/recording-profile.ts src/lib/studio/recording-profile.test.ts
git commit -m "feat(studio): device->recording-profile resolution + localStorage helpers"
```

---

## Task 7: Recording-profile server actions + seed

**Files:**
- Create: `src/server/studio/recording-profiles.ts`
- Test: `src/server/studio/recording-profiles.test.ts`

- [ ] **Step 1: Write the failing test (pure seed-builder)**

The DB calls are thin wrappers over `supabaseService()`; unit-test the pure seed builder that the seed action inserts.

```ts
import { describe, it, expect } from "vitest";
import { defaultSeedProfiles } from "./recording-profiles";

describe("defaultSeedProfiles", () => {
  it("produces the Home (Windows) and Travel (Mac) profiles for a profile id", () => {
    const seeds = defaultSeedProfiles("p1");
    expect(seeds).toHaveLength(2);
    const home = seeds.find((s) => s.os === "windows")!;
    expect(home.capture_tool).toBe("OBS+Rapidemo");
    expect(home.profile_id).toBe("p1");
    const travel = seeds.find((s) => s.os === "macos")!;
    expect(travel.capture_tool).toBe("OBS");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/server/studio/recording-profiles.test.ts`
Expected: FAIL — cannot find module `./recording-profiles`.

- [ ] **Step 3: Implement `src/server/studio/recording-profiles.ts`**

```ts
"use server";
import { supabaseService } from "@/lib/supabase/server";
import { listProfiles } from "@/server/profiles";
import { revalidatePath } from "next/cache";

export interface RecordingProfileInput {
  profile_id: string;
  device_label: string;
  os: string;
  monitors: { resolution: string; role: string }[];
  capture_tool: "OBS+Rapidemo" | "OBS";
  mic?: string;
  webcam?: string;
  teleprompter_placement: string;
  scene_presets: string[];
  export_path?: string;
  sync_target?: string;
}

export async function getActiveProfile() {
  const profiles = await listProfiles();
  const profile = profiles?.[0];
  if (!profile) throw new Error("no profile configured");
  return profile;
}

export function defaultSeedProfiles(profileId: string): RecordingProfileInput[] {
  return [
    {
      profile_id: profileId,
      device_label: "Home (Windows)",
      os: "windows",
      monitors: [
        { resolution: "2560x1440", role: "primary" },
        { resolution: "1920x1080", role: "teleprompter" },
      ],
      capture_tool: "OBS+Rapidemo",
      teleprompter_placement: "second-monitor",
      scene_presets: ["face-cam", "screen+cam", "screen-only"],
      export_path: "C:/Recordings",
    },
    {
      profile_id: profileId,
      device_label: "Travel (Mac)",
      os: "macos",
      monitors: [{ resolution: "1512x982", role: "primary" }],
      capture_tool: "OBS",
      teleprompter_placement: "webcam-overlay",
      scene_presets: ["face-cam", "screen+cam"],
      export_path: "~/Recordings",
    },
  ];
}

export async function listRecordingProfiles(profileId: string) {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("recording_profiles")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function seedRecordingProfilesIfEmpty(profileId: string) {
  const existing = await listRecordingProfiles(profileId);
  if (existing.length > 0) return existing;
  const sb = supabaseService();
  const { data, error } = await sb.from("recording_profiles").insert(defaultSeedProfiles(profileId)).select("*");
  if (error) throw new Error(error.message);
  revalidatePath("/studio");
  return data ?? [];
}

export async function createRecordingProfile(input: RecordingProfileInput) {
  const sb = supabaseService();
  const { data, error } = await sb.from("recording_profiles").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  revalidatePath("/studio");
  return data;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/studio/recording-profiles.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/server/studio/recording-profiles.ts src/server/studio/recording-profiles.test.ts
git commit -m "feat(studio): recording-profile server actions + Home/Travel seed"
```

---

## Task 8: Video-project server actions

**Files:**
- Create: `src/server/studio/projects.ts`
- Test: `src/server/studio/projects.test.ts`

- [ ] **Step 1: Write the failing test (pure helpers)**

`projects.ts` exposes pure helpers used by the actions; test those (the DB wrappers are thin).

```ts
import { describe, it, expect } from "vitest";
import { assertTransition, mergeProjectPatch } from "./projects";

describe("project helpers", () => {
  it("assertTransition throws on an illegal jump", () => {
    expect(() => assertTransition("topic", "publish")).toThrow(/cannot move/i);
    expect(() => assertTransition("topic", "script")).not.toThrow();
  });
  it("mergeProjectPatch stamps updated_at and keeps prior fields", () => {
    const patch = mergeProjectPatch({ stage: "script", script: { title: "T", hook: "H", beats: [] } }, "2026-06-02T00:00:00Z");
    expect(patch.stage).toBe("script");
    expect(patch.updated_at).toBe("2026-06-02T00:00:00Z");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/server/studio/projects.test.ts`
Expected: FAIL — cannot find module `./projects`.

- [ ] **Step 3: Implement `src/server/studio/projects.ts`**

```ts
"use server";
import { supabaseService } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { withRetry } from "@/lib/retry";
import { collectTrendSignals } from "@/lib/studio/signals";
import { brain } from "@/lib/studio/brain";
import { canTransition } from "@/lib/studio/stages";
import type { StudioStage, RankedTopic, VideoScript } from "@/lib/studio/schemas";
import { buildVoiceSystemFromSpec } from "@/lib/voice-prompt";

export function assertTransition(from: StudioStage, to: StudioStage) {
  if (!canTransition(from, to)) throw new Error(`cannot move from ${from} to ${to}`);
}

export function mergeProjectPatch(patch: Record<string, unknown>, now: string) {
  return { ...patch, updated_at: now };
}

export async function listVideoProjects(profileId: string) {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("video_projects")
    .select("*")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createVideoProject(profileId: string) {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("video_projects")
    .insert({ profile_id: profileId, stage: "topic" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/studio");
  return data;
}

/** Stage 1: pull live signals + rank topics for the niche. Does NOT advance. */
export async function rankTopicsForProject(profileId: string): Promise<RankedTopic[]> {
  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", profileId).single();
  const voiceSpec = profile ? buildVoiceSystemFromSpec(profile) : undefined;
  const signals = await withRetry(() => collectTrendSignals({ limit: 25 }));
  return brain.rankTopics({ niche: "a vibe-coder who builds on blockchain and builds in public", voiceSpec, signals, count: 6 });
}

/** Human pick gate: store the chosen topic and advance to 'script'. */
export async function chooseTopic(projectId: string, topic: RankedTopic) {
  return updateProject(projectId, "topic", "script", { topic });
}

/** Stage 2: write the script from the chosen topic. Advances to 'script' content but keeps stage. */
export async function writeScriptForProject(projectId: string): Promise<VideoScript> {
  const sb = supabaseService();
  const { data: project } = await sb.from("video_projects").select("*").eq("id", projectId).single();
  if (!project?.topic) throw new Error("choose a topic first");
  const { data: profile } = await sb.from("profiles").select("*").eq("id", project.profile_id).single();
  const voiceSpec = profile ? buildVoiceSystemFromSpec(profile) : undefined;
  const script = await brain.writeScript({ topic: project.topic as RankedTopic, voiceSpec });
  await patchProject(projectId, { script });
  return script;
}

/** Save edits to the script (from Script Studio). */
export async function saveScript(projectId: string, script: VideoScript) {
  await patchProject(projectId, { script });
}

export async function advanceToRecord(projectId: string) {
  return updateProject(projectId, "script", "record", {});
}

export async function confirmTake(projectId: string, recordingProfileId: string, notes = "") {
  return updateProject(projectId, "record", "publish", {
    recording: { recording_profile_id: recordingProfileId, take_confirmed_at: new Date().toISOString(), notes },
  });
}

// --- internals ---

async function patchProject(projectId: string, patch: Record<string, unknown>) {
  const sb = supabaseService();
  const { error } = await sb
    .from("video_projects")
    .update(mergeProjectPatch(patch, new Date().toISOString()))
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/studio");
}

async function updateProject(projectId: string, from: StudioStage, to: StudioStage, patch: Record<string, unknown>) {
  assertTransition(from, to);
  await patchProject(projectId, { ...patch, stage: to });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/studio/projects.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/studio/projects.ts src/server/studio/projects.test.ts
git commit -m "feat(studio): video-project lifecycle server actions (topic->script->record)"
```

---

## Task 9: YouTube OAuth + upload (real, forced-private)

**Files:**
- Create: `src/lib/youtube.ts`
- Create: `src/app/api/youtube/oauth/start/route.ts`
- Create: `src/app/api/youtube/oauth/callback/route.ts`
- Create: `src/server/studio/publish.ts`
- Test: `src/lib/youtube.test.ts`
- Modify: `package.json` (add `googleapis`)

- [ ] **Step 1: Add the dependency**

Run: `npm install googleapis`
Expected: `googleapis` appears in `package.json` dependencies.

- [ ] **Step 2: Write the failing test (pure helpers)**

```ts
import { describe, it, expect } from "vitest";
import { buildAuthUrl, FORCED_PRIVACY, YT_SCOPES } from "./youtube";

describe("youtube helpers", () => {
  it("forces private uploads in slice 1", () => {
    expect(FORCED_PRIVACY).toBe("private");
  });
  it("requests the upload scope", () => {
    expect(YT_SCOPES).toContain("https://www.googleapis.com/auth/youtube.upload");
  });
  it("buildAuthUrl includes offline access so we get a refresh token", () => {
    const url = buildAuthUrl({ clientId: "cid", redirectUri: "http://localhost:3000/cb" });
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain("client_id=cid");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/youtube.test.ts`
Expected: FAIL — cannot find module `./youtube`.

- [ ] **Step 4: Implement `src/lib/youtube.ts`**

```ts
import { google } from "googleapis";
import { createReadStream } from "node:fs";
import { withRetry } from "@/lib/retry";

export const FORCED_PRIVACY = "private" as const;
export const YT_SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

export function buildAuthUrl(opts: { clientId: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: YT_SCOPES.join(" "),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function oauthClient(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID!,
    process.env.YOUTUBE_CLIENT_SECRET!,
    redirectUri,
  );
}

export async function exchangeCodeForRefreshToken(code: string, redirectUri: string): Promise<{ refreshToken: string; scope?: string }> {
  const client = oauthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error("no refresh_token returned (revoke prior consent and retry)");
  return { refreshToken: tokens.refresh_token, scope: tokens.scope };
}

export interface UploadInput {
  refreshToken: string;
  filePath: string;
  title: string;
  description: string;
  redirectUri: string;
}

/** Uploads a local file as an UNLISTED-by-default... no: forced PRIVATE video. Returns the video id + url. */
export async function uploadVideo(input: UploadInput): Promise<{ videoId: string; url: string; privacyStatus: string }> {
  const client = oauthClient(input.redirectUri);
  client.setCredentials({ refresh_token: input.refreshToken });
  const youtube = google.youtube({ version: "v3", auth: client });

  const res = await withRetry(() =>
    youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title: input.title, description: input.description },
        status: { privacyStatus: FORCED_PRIVACY }, // hardcoded; the single seam to relax later
      },
      media: { body: createReadStream(input.filePath) },
    }),
  );

  const videoId = res.data.id;
  if (!videoId) throw new Error("upload succeeded but no video id returned");
  return { videoId, url: `https://www.youtube.com/watch?v=${videoId}`, privacyStatus: FORCED_PRIVACY };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/youtube.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Implement the OAuth start route `src/app/api/youtube/oauth/start/route.ts`**

```ts
import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "YOUTUBE_CLIENT_ID not set" }, { status: 500 });
  const redirectUri = `${new URL(req.url).origin}/api/youtube/oauth/callback`;
  return NextResponse.redirect(buildAuthUrl({ clientId, redirectUri }));
}
```

- [ ] **Step 7: Implement the OAuth callback route `src/app/api/youtube/oauth/callback/route.ts`**

```ts
import { NextResponse } from "next/server";
import { exchangeCodeForRefreshToken } from "@/lib/youtube";
import { supabaseService } from "@/lib/supabase/server";
import { getActiveProfile } from "@/server/studio/recording-profiles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
  const redirectUri = `${url.origin}/api/youtube/oauth/callback`;

  const { refreshToken, scope } = await exchangeCodeForRefreshToken(code, redirectUri);
  const profile = await getActiveProfile();
  const sb = supabaseService();
  const { error } = await sb.from("youtube_credentials").upsert({
    profile_id: profile.id,
    refresh_token: refreshToken,
    scope: scope ?? null,
    obtained_at: new Date().toISOString(),
  }, { onConflict: "profile_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.redirect(`${url.origin}/studio?yt=connected`);
}
```

- [ ] **Step 8: Implement `src/server/studio/publish.ts`**

```ts
"use server";
import { supabaseService } from "@/lib/supabase/server";
import { uploadVideo } from "@/lib/youtube";
import { revalidatePath } from "next/cache";

export async function isYouTubeConnected(profileId: string): Promise<boolean> {
  const sb = supabaseService();
  const { data } = await sb.from("youtube_credentials").select("profile_id").eq("profile_id", profileId).maybeSingle();
  return !!data;
}

/**
 * Publish a recorded take. `filePath` is a server-readable path; the Publish panel
 * uploads the MP4 to a temp path first (see Task 15) and passes that here.
 */
export async function publishProjectVideo(
  projectId: string,
  filePath: string,
  origin: string,
) {
  const sb = supabaseService();
  const { data: project } = await sb.from("video_projects").select("*").eq("id", projectId).single();
  if (!project) throw new Error("project not found");
  if (project.stage !== "publish") throw new Error("project is not at the publish stage");
  const script = project.script as { title?: string; hook?: string } | null;

  const { data: cred } = await sb.from("youtube_credentials").select("*").eq("profile_id", project.profile_id).maybeSingle();
  if (!cred) throw new Error("YouTube not connected — connect first");

  const result = await uploadVideo({
    refreshToken: cred.refresh_token,
    filePath,
    title: script?.title ?? "Untitled",
    description: script?.hook ?? "",
    redirectUri: `${origin}/api/youtube/oauth/callback`,
  });

  const { error } = await sb.from("video_projects").update({
    publish: { youtube_video_id: result.videoId, url: result.url, privacy_status: result.privacyStatus, published_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  }).eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/studio");
  return result;
}
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/youtube.ts src/lib/youtube.test.ts src/app/api/youtube package.json package-lock.json src/server/studio/publish.ts
git commit -m "feat(studio): YouTube OAuth + forced-private videos.insert upload"
```

- [ ] **Step 10: Document required env vars**

Add to the repo's env notes (e.g. `.env.example` if present, else a comment in `docs/HANDOFF.md`): `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` (from a Google Cloud OAuth desktop/web client with the YouTube Data API v3 enabled, redirect URI `http://localhost:3000/api/youtube/oauth/callback`).

---

## Task 10: Video → X-thread handoff

**Files:**
- Create: `src/server/studio/repurpose.ts`
- Test: `src/server/studio/repurpose.test.ts`

- [ ] **Step 1: Write the failing test (pure prompt builder)**

```ts
import { describe, it, expect } from "vitest";
import { buildVideoThreadPrompt } from "./repurpose";

describe("buildVideoThreadPrompt", () => {
  it("includes the video title, url, and the beats", () => {
    const p = buildVideoThreadPrompt("VOICE", {
      title: "I shipped a Solana app with Claude",
      url: "https://youtu.be/abc",
      beats: [{ id: "b1", say: "Here is the hook", visualPrompt: "x" }],
    });
    expect(p).toContain("I shipped a Solana app with Claude");
    expect(p).toContain("https://youtu.be/abc");
    expect(p).toContain("Here is the hook");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/server/studio/repurpose.test.ts`
Expected: FAIL — cannot find module `./repurpose`.

- [ ] **Step 3: Implement `src/server/studio/repurpose.ts`**

```ts
"use server";
import { supabaseService } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { ThreadDraft } from "@/lib/schemas";
import { buildVoiceSystemFromSpec } from "@/lib/voice-prompt";
import { saveDraftToQueue } from "@/server/posts";
import type { VideoScript } from "@/lib/studio/schemas";

export function buildVideoThreadPrompt(
  voiceSystem: string,
  video: { title: string; url: string; beats: VideoScript["beats"] },
): string {
  const beatLines = video.beats.map((b, i) => `${i + 1}. ${b.say}`).join("\n");
  return [
    voiceSystem,
    `Repurpose this just-published YouTube video into an X thread that drives views to it.`,
    `Video title: ${video.title}`,
    `Video URL: ${video.url}`,
    `The video's beats (teleprompter lines):\n${beatLines}`,
    `Write a tight thread: a scroll-stopping hook tweet, 2-5 body tweets distilling the most valuable beats, and a final CTA tweet linking the video (${video.url}).`,
    `Each tweet <=280 chars. Respond as JSON: { tweets: { tweet, type }[] } where type is "hook" | "body" | "cta".`,
  ].join("\n\n");
}

/** Generate an X thread from a published project and drop it into the existing sign-off queue. */
export async function createXThreadFromVideo(projectId: string): Promise<{ draftId: string; tweetCount: number }> {
  const sb = supabaseService();
  const { data: project } = await sb.from("video_projects").select("*").eq("id", projectId).single();
  if (!project) throw new Error("project not found");
  const script = project.script as VideoScript | null;
  const publish = project.publish as { url?: string } | null;
  if (!script) throw new Error("no script to repurpose");
  if (!publish?.url) throw new Error("publish the video before repurposing");

  const { data: profile } = await sb.from("profiles").select("*").eq("id", project.profile_id).single();
  const voiceSystem = profile ? buildVoiceSystemFromSpec(profile) : "";

  const r = await generateStructured(ThreadDraft, buildVideoThreadPrompt(voiceSystem, { title: script.title, url: publish.url, beats: script.beats }));
  if (!r.data) throw new Error("could not draft the thread — try again");

  // Reuse the existing queue seam: store the thread as one 'original' draft (tweets joined),
  // matching how Create-a-Post persists multi-tweet originals.
  const body = r.data.tweets.map((t) => t.tweet).join("\n\n");
  const draftId = await saveDraftToQueue(project.profile_id, { kind: "original", body });

  await sb.from("video_projects").update({ stage: "repurposed", updated_at: new Date().toISOString() }).eq("id", projectId);
  return { draftId, tweetCount: r.data.tweets.length };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/studio/repurpose.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/server/studio/repurpose.ts src/server/studio/repurpose.test.ts
git commit -m "feat(studio): video->X-thread handoff into the existing sign-off queue"
```

---

## Task 11: Sidebar entry + `/studio` route + flow shell

**Files:**
- Modify: `src/components/shell/sidebar.tsx:18-25` (NAV array)
- Create: `src/app/(app)/studio/page.tsx`
- Create: `src/components/studio/studio-flow.tsx`

- [ ] **Step 1: Add the Studio nav entry**

In `src/components/shell/sidebar.tsx`, import `Video` from `lucide-react` (add to the existing import block) and add to `NAV` after the Engage entry:

```ts
  { href: "/studio",      icon: Video,     label: "Studio"      },
```

- [ ] **Step 2: Create the server page `src/app/(app)/studio/page.tsx`**

```tsx
import { getActiveProfile, seedRecordingProfilesIfEmpty } from "@/server/studio/recording-profiles";
import { listVideoProjects } from "@/server/studio/projects";
import { isYouTubeConnected } from "@/server/studio/publish";
import { StudioFlow } from "@/components/studio/studio-flow";

export default async function StudioPage() {
  let profileId = "";
  let recordingProfiles: Awaited<ReturnType<typeof seedRecordingProfilesIfEmpty>> = [];
  let projects: Awaited<ReturnType<typeof listVideoProjects>> = [];
  let ytConnected = false;
  try {
    const profile = await getActiveProfile();
    profileId = profile.id;
    recordingProfiles = await seedRecordingProfilesIfEmpty(profile.id);
    projects = await listVideoProjects(profile.id);
    ytConnected = await isYouTubeConnected(profile.id);
  } catch {
    // Render an empty studio if the DB/profile isn't ready.
  }

  return (
    <div className="mx-auto max-w-content px-[30px] pb-[60px] pt-[26px] max-md:px-4">
      <div className="mb-[22px]">
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Studio</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Trending topic → script → record → publish → repurpose.</p>
      </div>
      <StudioFlow
        profileId={profileId}
        recordingProfiles={recordingProfiles}
        initialProjects={projects}
        ytConnected={ytConnected}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create the client orchestrator `src/components/studio/studio-flow.tsx`**

This holds the active project + stage rail and renders the per-stage panel. Panels are added in Tasks 12-16; reference them now and create stubs in Step 4 so the file compiles.

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createVideoProject } from "@/server/studio/projects";
import { STUDIO_STAGES, type StudioStage } from "@/lib/studio/schemas";
import { TopicBoard } from "./topic-board";
import { ScriptStudio } from "./script-studio";
import { RecordHub } from "./record-hub";
import { PublishPanel } from "./publish-panel";
import { RepurposePanel } from "./repurpose-panel";
import { RenderPanel } from "./render-panel";

type Project = { id: string; stage: string; topic: unknown; script: unknown; recording: unknown; publish: unknown };

const STAGE_LABEL: Record<StudioStage, string> = {
  topic: "Topic", script: "Script", record: "Record", publish: "Publish", repurposed: "Repurpose",
};

export function StudioFlow({
  profileId, recordingProfiles, initialProjects, ytConnected,
}: {
  profileId: string;
  recordingProfiles: { id: string; device_label: string; os: string; capture_tool: string; teleprompter_placement: string; scene_presets: unknown; export_path: string | null }[];
  initialProjects: Project[];
  ytConnected: boolean;
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(initialProjects[0]?.id ?? null);
  const active = projects.find((p) => p.id === activeId) ?? null;

  async function newProject() {
    try {
      const p = (await createVideoProject(profileId)) as Project;
      setProjects((prev) => [p, ...prev]);
      setActiveId(p.id);
    } catch (e) { toast.error(String(e)); }
  }

  function patchActive(patch: Partial<Project>) {
    setProjects((prev) => prev.map((p) => (p.id === activeId ? { ...p, ...patch } : p)));
  }

  if (!active) {
    return (
      <div className="rounded-xl border border-border p-10 text-center">
        <p className="mb-4 text-sm text-muted-foreground">No video in progress.</p>
        <Button onClick={newProject} disabled={!profileId}>Start a new video</Button>
      </div>
    );
  }

  const stage = active.stage as StudioStage;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STUDIO_STAGES.map((s) => (
            <span key={s} className={cn(
              "rounded-full px-3 py-1 text-[12px] font-medium",
              s === stage ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}>{STAGE_LABEL[s]}</span>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={newProject}>New video</Button>
      </div>

      {stage === "topic" && <TopicBoard profileId={profileId} projectId={active.id} onChosen={() => patchActive({ stage: "script" })} />}
      {stage === "script" && <ScriptStudio projectId={active.id} script={active.script} onAdvance={() => patchActive({ stage: "record" })} onScript={(script) => patchActive({ script })} />}
      {stage === "record" && <RecordHub projectId={active.id} script={active.script} recordingProfiles={recordingProfiles} onConfirmed={() => patchActive({ stage: "publish" })} />}
      {stage === "publish" && <PublishPanel projectId={active.id} ytConnected={ytConnected} onPublished={(publish) => patchActive({ publish })} />}
      {stage === "repurposed" && <RepurposePanel projectId={active.id} publish={active.publish} />}
      {stage === "publish" && <RenderPanel />}
    </div>
  );
}
```

- [ ] **Step 4: Create panel stubs so the build compiles**

Create each of these files with a minimal default export (filled in by Tasks 12-16). Example stub for `src/components/studio/topic-board.tsx`:

```tsx
"use client";
export function TopicBoard(_: { profileId: string; projectId: string; onChosen: () => void }) {
  return null;
}
```

Make analogous stubs: `script-studio.tsx` (`export function ScriptStudio(_: { projectId: string; script: unknown; onAdvance: () => void; onScript: (s: unknown) => void }) { return null; }`), `record-hub.tsx` (`export function RecordHub(_: { projectId: string; script: unknown; recordingProfiles: unknown[]; onConfirmed: () => void }) { return null; }`), `publish-panel.tsx` (`export function PublishPanel(_: { projectId: string; ytConnected: boolean; onPublished: (p: unknown) => void }) { return null; }`), `repurpose-panel.tsx` (`export function RepurposePanel(_: { projectId: string; publish: unknown }) { return null; }`), `render-panel.tsx` (`export function RenderPanel() { return null; }`).

- [ ] **Step 5: Verify build + manual smoke**

Run: `npx tsc --noEmit`
Expected: no errors.
Then `npm run dev`, visit `http://localhost:3000/studio` — the Studio nav item appears, the stage rail renders, "Start a new video" creates a project and advances the rail to Topic.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/sidebar.tsx src/app/(app)/studio/page.tsx src/components/studio
git commit -m "feat(studio): /studio route, sidebar entry, stage-rail flow shell"
```

---

## Task 12: Topic Board panel

**Files:**
- Modify: `src/components/studio/topic-board.tsx`

- [ ] **Step 1: Implement the panel**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScorePill } from "@/components/ui/score-bar";
import { toast } from "sonner";
import { rankTopicsForProject, chooseTopic } from "@/server/studio/projects";
import type { RankedTopic } from "@/lib/studio/schemas";

export function TopicBoard({ profileId, projectId, onChosen }: { profileId: string; projectId: string; onChosen: () => void }) {
  const [topics, setTopics] = useState<RankedTopic[] | null>(null);
  const [scanning, startScan] = useTransition();
  const [picking, startPick] = useTransition();

  function scan() {
    startScan(async () => {
      try { setTopics(await rankTopicsForProject(profileId)); }
      catch (e) { toast.error(String(e)); }
    });
  }
  function pick(t: RankedTopic) {
    startPick(async () => {
      try { await chooseTopic(projectId, t); toast.success("Topic locked"); onChosen(); }
      catch (e) { toast.error(String(e)); }
    });
  }

  return (
    <div className="space-y-4">
      <Button onClick={scan} disabled={scanning || !profileId}>
        {scanning ? "Scanning what's trending…" : "Scan trending topics"}
      </Button>
      {topics?.map((t) => (
        <Card key={t.id}>
          <CardContent className="flex flex-col gap-2 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[14px] font-semibold">{t.title}</div>
              <ScorePill value={t.score} />
            </div>
            <div className="text-[13px]">{t.angle}</div>
            <div className="text-[12px] text-muted-foreground">{t.rationale}</div>
            <div><Button size="sm" disabled={picking} onClick={() => pick(t)}>Pick this</Button></div>
          </CardContent>
        </Card>
      ))}
      {topics && topics.length === 0 && <p className="text-[13px] text-muted-foreground">No topics ranked — try again.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (no errors). In `npm run dev`, on `/studio` with a project at Topic, click "Scan trending topics" → a ranked board appears; "Pick this" advances to Script.

- [ ] **Step 3: Commit**

```bash
git add src/components/studio/topic-board.tsx
git commit -m "feat(studio): Topic Board panel (scan + ~30s pick gate)"
```

---

## Task 13: Script Studio panel

**Files:**
- Modify: `src/components/studio/script-studio.tsx`

- [ ] **Step 1: Implement the panel**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { writeScriptForProject, saveScript, advanceToRecord } from "@/server/studio/projects";
import type { VideoScript } from "@/lib/studio/schemas";

export function ScriptStudio({ projectId, script, onAdvance, onScript }: {
  projectId: string; script: unknown; onAdvance: () => void; onScript: (s: VideoScript) => void;
}) {
  const [draft, setDraft] = useState<VideoScript | null>((script as VideoScript) ?? null);
  const [writing, startWrite] = useTransition();
  const [saving, startSave] = useTransition();

  function write() {
    startWrite(async () => {
      try { const s = await writeScriptForProject(projectId); setDraft(s); onScript(s); }
      catch (e) { toast.error(String(e)); }
    });
  }
  function persist(next: VideoScript) {
    setDraft(next); onScript(next);
    startSave(async () => { try { await saveScript(projectId, next); } catch (e) { toast.error(String(e)); } });
  }
  function go() {
    startSave(async () => { try { await advanceToRecord(projectId); onAdvance(); } catch (e) { toast.error(String(e)); } });
  }

  if (!draft) {
    return <Button onClick={write} disabled={writing}>{writing ? "Writing the script…" : "Write the script"}</Button>;
  }

  return (
    <div className="space-y-4">
      <Card><CardContent className="space-y-2 pt-5">
        <label className="text-[12px] font-semibold uppercase text-muted-foreground">Title</label>
        <Textarea rows={1} value={draft.title} onChange={(e) => persist({ ...draft, title: e.target.value })} />
        <label className="text-[12px] font-semibold uppercase text-muted-foreground">Hook (pays off &lt;15s)</label>
        <Textarea rows={2} value={draft.hook} onChange={(e) => persist({ ...draft, hook: e.target.value })} />
      </CardContent></Card>

      {draft.beats.map((b, i) => (
        <Card key={b.id}>
          <CardContent className="grid grid-cols-1 gap-3 pt-5 md:grid-cols-2">
            <div>
              <label className="text-[12px] font-semibold uppercase text-muted-foreground">Say {i + 1}</label>
              <Textarea rows={3} value={b.say} onChange={(e) => persist({ ...draft, beats: draft.beats.map((x) => x.id === b.id ? { ...x, say: e.target.value } : x) })} />
            </div>
            <div>
              <label className="text-[12px] font-semibold uppercase text-muted-foreground">On screen</label>
              <Textarea rows={3} value={b.visualPrompt} onChange={(e) => persist({ ...draft, beats: draft.beats.map((x) => x.id === b.id ? { ...x, visualPrompt: e.target.value } : x) })} />
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-2">
        <Button onClick={write} variant="outline" disabled={writing}>{writing ? "Rewriting…" : "Rewrite"}</Button>
        <Button onClick={go} disabled={saving}>Looks good → Record</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (no errors). In dev, at Script stage: "Write the script" produces an editable title/hook/beats grid; edits persist (revalidate); "Looks good → Record" advances.

- [ ] **Step 3: Commit**

```bash
git add src/components/studio/script-studio.tsx
git commit -m "feat(studio): Script Studio panel (beats || visual prompts, editable)"
```

---

## Task 14: Record Hub panel

**Files:**
- Modify: `src/components/studio/record-hub.tsx`
- Create: `src/components/studio/device-picker.tsx`

- [ ] **Step 1: Implement the device picker `src/components/studio/device-picker.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { StyledSelect } from "@/components/ui/select-native";
import { getOrCreateDeviceId, readDeviceMap, setDeviceMapping, resolveRecordingProfileId } from "@/lib/studio/recording-profile";

type RP = { id: string; device_label: string; os: string };

export function DevicePicker({ recordingProfiles, value, onChange }: {
  recordingProfiles: RP[]; value: string; onChange: (id: string) => void;
}) {
  const [deviceId, setDeviceId] = useState("");
  useEffect(() => {
    const id = getOrCreateDeviceId();
    setDeviceId(id);
    const resolved = resolveRecordingProfileId(id, readDeviceMap(), recordingProfiles[0]?.id);
    if (resolved && resolved !== value) onChange(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StyledSelect aria-label="Recording device" value={value} onChange={(e) => {
      onChange(e.target.value);
      if (deviceId) setDeviceMapping(deviceId, e.target.value); // remember this machine's choice
    }}>
      {recordingProfiles.map((rp) => (
        <option key={rp.id} value={rp.id}>{rp.device_label} · {rp.os}</option>
      ))}
    </StyledSelect>
  );
}
```

- [ ] **Step 2: Implement `src/components/studio/record-hub.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { confirmTake } from "@/server/studio/projects";
import { DevicePicker } from "./device-picker";
import type { VideoScript } from "@/lib/studio/schemas";

type RP = { id: string; device_label: string; os: string; capture_tool: string; teleprompter_placement: string; scene_presets: unknown; export_path: string | null };

export function RecordHub({ projectId, script, recordingProfiles, onConfirmed }: {
  projectId: string; script: unknown; recordingProfiles: RP[]; onConfirmed: () => void;
}) {
  const s = script as VideoScript | null;
  const [deviceProfileId, setDeviceProfileId] = useState(recordingProfiles[0]?.id ?? "");
  const [confirming, startConfirm] = useTransition();
  const active = recordingProfiles.find((rp) => rp.id === deviceProfileId);
  const scenes = Array.isArray(active?.scene_presets) ? (active!.scene_presets as string[]) : [];

  function confirm() {
    startConfirm(async () => {
      try { await confirmTake(projectId, deviceProfileId); toast.success("Take saved"); onConfirmed(); }
      catch (e) { toast.error(String(e)); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DevicePicker recordingProfiles={recordingProfiles} value={deviceProfileId} onChange={setDeviceProfileId} />
        {active && (
          <span className="text-[12px] text-muted-foreground">
            {active.capture_tool} · teleprompter: {active.teleprompter_placement}
            {scenes.length ? ` · scenes: ${scenes.join(", ")}` : ""}
            {active.export_path ? ` · save to ${active.export_path}` : ""}
          </span>
        )}
      </div>

      {s && (
        <Card><CardContent className="space-y-3 pt-5">
          <div className="rounded-lg bg-secondary p-4 text-[15px] font-medium leading-relaxed">{s.hook}</div>
          <ol className="space-y-2">
            {s.beats.map((b, i) => (
              <li key={b.id} className="rounded-lg border border-border p-3">
                <div className="text-[14px]">{i + 1}. {b.say}</div>
                <div className="mt-1 text-[12px] text-muted-foreground">▶ {b.visualPrompt}</div>
              </li>
            ))}
          </ol>
        </CardContent></Card>
      )}

      <Button onClick={confirm} disabled={confirming || !deviceProfileId}>I recorded this take → Publish</Button>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (no errors). In dev at Record stage: the device picker defaults to this machine's remembered profile (or first), shows capture-tool/teleprompter/scene guidance, the teleprompter hook + beat checklist render, and "I recorded this take" advances to Publish. Switching devices persists the choice in localStorage.

- [ ] **Step 4: Commit**

```bash
git add src/components/studio/record-hub.tsx src/components/studio/device-picker.tsx
git commit -m "feat(studio): Record Hub — device-profile-driven teleprompter + beat checklist"
```

---

## Task 15: Publish panel (file upload + real private publish)

**Files:**
- Modify: `src/components/studio/publish-panel.tsx`
- Create: `src/app/api/studio/upload/route.ts` (receives the MP4, writes a temp file, returns its path)

- [ ] **Step 1: Implement the upload receiver `src/app/api/studio/upload/route.ts`**

A browser can't hand a local path to a server action, so the panel POSTs the file here; the route streams it to a temp file and returns the path for `publishProjectVideo`.

```ts
import { NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = join(tmpdir(), `embalio-${Date.now()}-${safe}`);
  await writeFile(path, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ path });
}
```

- [ ] **Step 2: Implement `src/components/studio/publish-panel.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { publishProjectVideo } from "@/server/studio/publish";

export function PublishPanel({ projectId, ytConnected, onPublished }: {
  projectId: string; ytConnected: boolean; onPublished: (p: { url: string }) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [publishing, startPublish] = useTransition();

  function publish() {
    if (!file) { toast.error("Choose your recorded MP4 first"); return; }
    startPublish(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/studio/upload", { method: "POST", body: fd });
        if (!up.ok) throw new Error("upload failed");
        const { path } = (await up.json()) as { path: string };
        const result = await publishProjectVideo(projectId, path, window.location.origin);
        toast.success("Uploaded (private)");
        onPublished({ url: result.url });
      } catch (e) { toast.error(String(e)); }
    });
  }

  if (!ytConnected) {
    return (
      <Card><CardContent className="space-y-3 pt-5">
        <p className="text-[13px] text-muted-foreground">Connect your YouTube channel to publish.</p>
        <Button asChild><a href="/api/youtube/oauth/start">Connect YouTube</a></Button>
      </CardContent></Card>
    );
  }

  return (
    <Card><CardContent className="space-y-3 pt-5">
      <p className="text-[13px] text-muted-foreground">Pick the MP4 you exported from OBS. Slice 1 always uploads as <strong>private</strong>.</p>
      <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button onClick={publish} disabled={publishing || !file}>{publishing ? "Uploading…" : "Upload to YouTube (private)"}</Button>
    </CardContent></Card>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors. (Full publish verification needs the Google OAuth env vars from Task 9 Step 10; without them the panel shows "Connect YouTube".)

- [ ] **Step 4: Commit**

```bash
git add src/components/studio/publish-panel.tsx src/app/api/studio/upload/route.ts
git commit -m "feat(studio): Publish panel — file upload + real forced-private YouTube publish"
```

---

## Task 16: Repurpose panel + Render scaffold

**Files:**
- Modify: `src/components/studio/repurpose-panel.tsx`
- Modify: `src/components/studio/render-panel.tsx`

- [ ] **Step 1: Implement `src/components/studio/repurpose-panel.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createXThreadFromVideo } from "@/server/studio/repurpose";

export function RepurposePanel({ projectId, publish }: { projectId: string; publish: unknown }) {
  const url = (publish as { url?: string } | null)?.url;
  const [done, setDone] = useState(false);
  const [working, startWork] = useTransition();

  function makeThread() {
    startWork(async () => {
      try {
        const r = await createXThreadFromVideo(projectId);
        toast.success(`Drafted a ${r.tweetCount}-tweet thread → sign-off queue`);
        setDone(true);
      } catch (e) { toast.error(String(e)); }
    });
  }

  return (
    <Card><CardContent className="space-y-3 pt-5">
      {url && <p className="text-[13px]">Published (private): <a className="text-brand-text underline" href={url} target="_blank" rel="noreferrer">{url}</a></p>}
      <p className="text-[13px] text-muted-foreground">Turn this video into an X thread. It lands in your existing Engage/Compose sign-off queue.</p>
      <div className="flex gap-2">
        <Button onClick={makeThread} disabled={working}>{working ? "Drafting…" : "Draft X thread"}</Button>
        {done && <Button asChild variant="outline"><a href="/compose">Open queue</a></Button>}
      </div>
    </CardContent></Card>
  );
}
```

- [ ] **Step 2: Implement the Render scaffold `src/components/studio/render-panel.tsx`**

```tsx
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Scaffold only — the Shotstack render() seam is wired in slice 2.
export function RenderPanel() {
  return (
    <Card><CardContent className="space-y-2 pt-5">
      <div className="text-[12px] font-semibold uppercase text-muted-foreground">Render (coming next)</div>
      <p className="text-[13px] text-muted-foreground">
        Auto-composited intro/outro/captions over your face-cam via Shotstack. Not wired yet —
        publish your edited export directly for now.
      </p>
      <Button disabled>Render with Shotstack</Button>
    </CardContent></Card>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (no errors). In dev: after a (mock or real) publish, the Repurpose panel drafts a thread that appears under `/compose`; the Render scaffold renders disabled.

- [ ] **Step 4: Commit**

```bash
git add src/components/studio/repurpose-panel.tsx src/components/studio/render-panel.tsx
git commit -m "feat(studio): Repurpose panel (X-thread handoff) + Render scaffold"
```

---

## Task 17: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all prior tests still pass plus the new studio tests; 0 failures (1 pre-existing RLS skip is fine).

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 3: Production build (dev server stopped)**

Stop `npm run dev` first (build/dev clash on `.next`). Run: `npm run build`
Expected: build succeeds, `/studio` and the new API routes compile.

- [ ] **Step 4: Manual end-to-end pass**

With `npm run dev` and (optionally) the Google OAuth env vars set: `/studio` → new video → scan → pick topic → write & edit script → record-hub confirm (device profile drives the teleprompter) → connect YouTube → upload an MP4 (lands private on the channel) → draft X thread → confirm it appears in `/compose`.

- [ ] **Step 5: Update the handoff**

Append a short "YouTube Engine slice 1" section to `docs/HANDOFF.md` noting: new tables, the `BrainClient` boundary (local `claude -p` now, Agent SDK later), forced-private publish, the X-handoff reuse of `drafts`, deferred Render/Shotstack, and the required `YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET` env vars. Commit.

```bash
git add docs/HANDOFF.md
git commit -m "docs(handoff): record YouTube Engine slice 1"
```

---

## Self-review notes (author)

- **Spec coverage:** §3 stage rail → Task 11; §4 tables → Task 1; §5 BrainClient + HN signals → Tasks 4-5,8; §6 publish → Task 9,15; §7 X handoff → Task 10,16; §8 Record Hub → Task 14; §4.1 device detection → Task 6,14; §9 Render scaffold → Task 16. All covered.
- **Reuse, not rebuild:** generation (`generateStructured`), voice (`buildVoiceSystemFromSpec`), queue (`saveDraftToQueue`), retry (`withRetry`), `ThreadDraft` schema, `supabaseService`, `StyledSelect`/`Card`/`Button`/`ScorePill`, `listProfiles`/`FIXED_PROFILE_ID`. New code is only the studio-specific surface + plumbing.
- **Swap-readiness:** the only line to change when the external Agent SDK brain exists is the `brain` binding in `src/lib/studio/brain.ts`; UI and server actions are untouched.
- **Type consistency:** `RankedTopic`/`VideoScript`/`StudioStage` flow unchanged from `schemas.ts` through brain → projects → panels. `confirmTake(projectId, recordingProfileId, notes?)` signature matches its caller in Record Hub.
```
