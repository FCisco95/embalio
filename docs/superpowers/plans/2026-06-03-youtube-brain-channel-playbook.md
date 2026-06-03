# YouTube Brain v2 — Channel Playbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the YouTube brain encode sourced, live-researched YouTube-algorithm expertise and synthesize a persisted **Channel Playbook** that frames topic ranking and script writing.

**Architecture:** Two layers behind the existing `BrainClient` seam: a live-researched + cached **Algorithm Brief** (general best practices, with sources) feeds a brand-specific **Channel Playbook** (the strategic path), which is then passed (optionally) into `rankTopics`/`writeScript`. Judgment (prompts) lives in `src/lib/studio/brain.ts`; plumbing (cache, persistence) lives in `src/server/studio/`. Brain stays `LocalClaudeBrain`; the optional `playbook` arg is the future `AgentSdkBrain` swap seam.

**Tech Stack:** Next.js (App Router) server actions, Supabase (service-role), Zod, `generateStructured` (`claude -p`, with `research:true` web mode), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-youtube-brain-channel-playbook-design.md`

---

## File structure

**Create:**
- `supabase/migrations/0012_algorithm_briefs.sql` — the brief cache table
- `supabase/migrations/0013_profiles_channel_playbook.sql` — the playbook column
- `src/server/studio/algorithm-brief.ts` — `getAlgorithmBrief`, `runAlgorithmBrief` (cache/freshness/fallback)
- `src/server/studio/algorithm-brief.test.ts`
- `src/server/studio/playbook.ts` — `getChannelPlaybook`, `generateChannelPlaybook`
- `src/server/studio/playbook.test.ts`
- `src/components/studio/playbook-panel.tsx` — the collapsible Studio panel

**Modify:**
- `src/lib/studio/schemas.ts` — add `AlgorithmBrief`, `ChannelPlaybook`
- `src/lib/studio/brain.ts` — extend `RankRequest`/`ScriptRequest` with `playbook?`; weave the playbook into `buildRankPrompt`/`buildScriptPrompt`; add `buildBriefPrompt`/`buildPlaybookPrompt`
- `src/lib/studio/brain.test.ts` — new assertions (create if absent)
- `src/server/studio/projects.ts` — load the playbook and thread it into `rankTopicsForProject` + `writeScriptForProject`
- `src/lib/supabase/types.ts` — reflect the new table + column
- `src/app/(app)/studio/page.tsx` — load playbook + brief meta, pass to `StudioFlow`
- `src/components/studio/studio-flow.tsx` — render `PlaybookPanel` atop the rail

---

## Task 1: Schemas — AlgorithmBrief + ChannelPlaybook

**Files:**
- Modify: `src/lib/studio/schemas.ts`
- Test: `src/lib/studio/schemas.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Append to (or create) `src/lib/studio/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { AlgorithmBrief, ChannelPlaybook } from "./schemas";

describe("AlgorithmBrief", () => {
  it("accepts a well-formed brief with sources", () => {
    const r = AlgorithmBrief.safeParse({
      packaging: ["Front-load the payoff in the title"],
      retention: ["Hook must pay off in the first 15s"],
      formats: ["build-in-public logs"],
      cadence: "2 long-form + 4 shorts / week",
      authenticity: ["Keep a real face in the flagship loop"],
      summary: "Current YT best practices for solo devs.",
      sources: [{ title: "Creator Insider", url: "https://youtube.com/x" }],
    });
    expect(r.success).toBe(true);
  });
  it("rejects an empty packaging list", () => {
    const r = AlgorithmBrief.safeParse({
      packaging: [], retention: ["x"], formats: [], cadence: "c",
      authenticity: [], summary: "s", sources: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("ChannelPlaybook", () => {
  it("accepts a well-formed playbook", () => {
    const r = ChannelPlaybook.safeParse({
      positioning: "A vibe-coder who builds on blockchain in public",
      northStar: { devBrand: "1k subs in 90d", organic: "ship Organic on-chain weekly" },
      pillars: [{ name: "Build logs", why: "Trust via the messy middle" }],
      packagingFormulas: ["I built X with Y in Z time"],
      retentionRules: ["Pay off the hook in 15s"],
      cadence: "2 long-form / week",
      nextMoves: ["Record the smart-contract teardown"],
    });
    expect(r.success).toBe(true);
  });
  it("rejects more than 6 pillars", () => {
    const pillars = Array.from({ length: 7 }, (_, i) => ({ name: `p${i}`, why: "w" }));
    const r = ChannelPlaybook.safeParse({
      positioning: "p", northStar: { devBrand: "d", organic: "o" }, pillars,
      packagingFormulas: ["f"], retentionRules: ["r"], cadence: "c", nextMoves: ["m"],
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/studio/schemas.test.ts`
Expected: FAIL — `AlgorithmBrief`/`ChannelPlaybook` not exported.

- [ ] **Step 3: Add the schemas**

Append to `src/lib/studio/schemas.ts`:

```ts
export const AlgorithmBrief = z.object({
  packaging: z.array(z.string()).min(1),
  retention: z.array(z.string()).min(1),
  formats: z.array(z.string()).default([]),
  cadence: z.string().min(1),
  authenticity: z.array(z.string()).default([]),
  summary: z.string().min(1),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).default([]),
});
export type AlgorithmBrief = z.infer<typeof AlgorithmBrief>;

export const ChannelPlaybook = z.object({
  positioning: z.string().min(1),
  northStar: z.object({ devBrand: z.string(), organic: z.string() }),
  pillars: z.array(z.object({ name: z.string(), why: z.string() })).min(1).max(6),
  packagingFormulas: z.array(z.string()).min(1),
  retentionRules: z.array(z.string()).min(1),
  cadence: z.string().min(1),
  nextMoves: z.array(z.string()).min(1),
  briefResearchedAt: z.string().optional(),
});
export type ChannelPlaybook = z.infer<typeof ChannelPlaybook>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/studio/schemas.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/schemas.ts src/lib/studio/schemas.test.ts
git commit -m "feat(studio): AlgorithmBrief + ChannelPlaybook schemas"
```

---

## Task 2: Migrations + types reflection

**Files:**
- Create: `supabase/migrations/0012_algorithm_briefs.sql`, `supabase/migrations/0013_profiles_channel_playbook.sql`
- Modify: `src/lib/supabase/types.ts`

> No live DB apply in this task — migrations are written + hand-reflected into `types.ts` only, exactly like slice 1. Applying to the live project is owner-gated (see "After the plan").

- [ ] **Step 1: Write `0012_algorithm_briefs.sql`**

```sql
-- 0012_algorithm_briefs.sql
-- Live-researched YouTube-algorithm best-practices brief, cached per profile.
-- Service-role only (RLS on, no anon policy) — mirrors youtube_credentials.
create table if not exists algorithm_briefs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  brief jsonb not null,
  researched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table algorithm_briefs enable row level security;
create index if not exists algorithm_briefs_profile_researched_idx
  on algorithm_briefs (profile_id, researched_at desc);
```

- [ ] **Step 2: Write `0013_profiles_channel_playbook.sql`**

```sql
-- 0013_profiles_channel_playbook.sql
-- The synthesized Channel Playbook (strategic path), mirrors profiles.growth_plan.
alter table profiles add column if not exists channel_playbook jsonb;
```

- [ ] **Step 3: Reflect into `src/lib/supabase/types.ts`**

In the `profiles` table type, add `channel_playbook: Json | null` to `Row`, and `channel_playbook?: Json | null` to both `Insert` and `Update` (mirror the existing `growth_plan` line exactly).

Add a new `algorithm_briefs` table block alongside the other table definitions (mirror the shape/style of the existing `youtube_credentials` block):

```ts
algorithm_briefs: {
  Row: { id: string; profile_id: string; brief: Json; researched_at: string; created_at: string };
  Insert: { id?: string; profile_id: string; brief: Json; researched_at?: string; created_at?: string };
  Update: { id?: string; profile_id?: string; brief?: Json; researched_at?: string; created_at?: string };
  Relationships: [
    {
      foreignKeyName: "algorithm_briefs_profile_id_fkey";
      columns: ["profile_id"];
      isOneToOne: false;
      referencedRelation: "profiles";
      referencedColumns: ["id"];
    },
  ];
};
```

- [ ] **Step 4: Verify the types compile**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0012_algorithm_briefs.sql supabase/migrations/0013_profiles_channel_playbook.sql src/lib/supabase/types.ts
git commit -m "feat(studio): migrations + types for algorithm_briefs + channel_playbook"
```

---

## Task 3: Thread the playbook through rank/script prompts

**Files:**
- Modify: `src/lib/studio/brain.ts`
- Test: `src/lib/studio/brain.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/append `src/lib/studio/brain.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRankPrompt, buildScriptPrompt } from "./brain";
import type { ChannelPlaybook, RankedTopic, TrendSignal } from "./schemas";

const playbook: ChannelPlaybook = {
  positioning: "Vibe-coder on blockchain",
  northStar: { devBrand: "1k subs", organic: "ship weekly" },
  pillars: [{ name: "Build logs", why: "trust" }],
  packagingFormulas: ["I built X with Y in Z"],
  retentionRules: ["pay off the hook in 15s"],
  cadence: "2/week",
  nextMoves: ["record the teardown"],
};
const signals: TrendSignal[] = [{ source: "hackernews", id: "1", title: "T", url: "u" }];
const topic: RankedTopic = { id: "t", title: "T", angle: "a", score: 90, rationale: "r", sourceRefs: [] };

describe("buildRankPrompt", () => {
  it("weaves the playbook in when present", () => {
    const p = buildRankPrompt({ niche: "n", signals, playbook });
    expect(p).toContain("Vibe-coder on blockchain");
    expect(p).toContain("I built X with Y in Z");
  });
  it("omits the playbook block cleanly when absent", () => {
    const p = buildRankPrompt({ niche: "n", signals });
    expect(p).not.toContain("Channel playbook");
  });
});

describe("buildScriptPrompt", () => {
  it("applies the playbook's retention rules when present", () => {
    const p = buildScriptPrompt({ topic, playbook });
    expect(p).toContain("pay off the hook in 15s");
  });
  it("omits the playbook block cleanly when absent", () => {
    const p = buildScriptPrompt({ topic });
    expect(p).not.toContain("Channel playbook");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/studio/brain.test.ts`
Expected: FAIL — playbook not referenced in prompts (and `RankRequest`/`ScriptRequest` don't accept `playbook`).

- [ ] **Step 3: Extend the interfaces + prompt builders**

In `src/lib/studio/brain.ts`, update the imports and the two request interfaces, and add a playbook block to each builder.

Change the import line to include the new type:

```ts
import { RankedTopicList, VideoScript, type RankedTopic, type TrendSignal, type ChannelPlaybook } from "./schemas";
```

Add `playbook?` to both interfaces:

```ts
export interface RankRequest {
  niche: string;
  voiceSpec?: string;
  signals: TrendSignal[];
  count?: number;
  playbook?: ChannelPlaybook;
}
export interface ScriptRequest {
  topic: RankedTopic;
  voiceSpec?: string;
  targetDurationSec?: number;
  playbook?: ChannelPlaybook;
}
```

Add a shared helper above `buildRankPrompt`:

```ts
function playbookBlock(pb?: ChannelPlaybook): string {
  if (!pb) return "";
  return [
    `Channel playbook — every choice must advance THIS strategy:`,
    `Positioning: ${pb.positioning}`,
    `Pillars: ${pb.pillars.map((p) => p.name).join(", ")}`,
    `Packaging formulas to use: ${pb.packagingFormulas.join(" | ")}`,
    `Retention rules: ${pb.retentionRules.join(" | ")}`,
    `Planned next moves: ${pb.nextMoves.join(" | ")}`,
  ].join("\n");
}
```

In `buildRankPrompt`, insert `playbookBlock(req.playbook)` into the array (after the niche line) and add a scoring instruction. Replace the `return [...]` array so it includes:

```ts
    req.playbook ? playbookBlock(req.playbook) : "",
    req.playbook ? `Score each topic by how well it advances the playbook above (pillars, packaging, next moves), not generic virality.` : "",
```

In `buildScriptPrompt`, insert after the angle line:

```ts
    req.playbook ? playbookBlock(req.playbook) : "",
```

(Both builders already `.filter(Boolean)`, so empty strings drop out and the absent-playbook case is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/studio/brain.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/brain.ts src/lib/studio/brain.test.ts
git commit -m "feat(studio): thread ChannelPlaybook into rank/script prompts"
```

---

## Task 4: Brief + playbook prompt builders

**Files:**
- Modify: `src/lib/studio/brain.ts`
- Test: `src/lib/studio/brain.test.ts`

- [ ] **Step 1: Write the failing test**

Add `buildBriefPrompt, buildPlaybookPrompt` to the existing `./brain` import at the **top** of `src/lib/studio/brain.test.ts`, and add `type AlgorithmBrief` to the existing `./schemas` import (keep all imports at the top — the repo lints `import/first`). Then append the new `describe` blocks at the bottom:

```ts
// (imports already at top of file:)
//   import { buildRankPrompt, buildScriptPrompt, buildBriefPrompt, buildPlaybookPrompt } from "./brain";
//   import type { ChannelPlaybook, RankedTopic, TrendSignal, AlgorithmBrief } from "./schemas";

const brief: AlgorithmBrief = {
  packaging: ["front-load the payoff"], retention: ["15s hook"], formats: ["build logs"],
  cadence: "2/week", authenticity: ["real face"], summary: "sum", sources: [],
};

describe("buildBriefPrompt", () => {
  it("asks for current, sourced best practices for the niche", () => {
    const p = buildBriefPrompt("vibe-coder on blockchain");
    expect(p).toContain("vibe-coder on blockchain");
    expect(p.toLowerCase()).toContain("source");
  });
});

describe("buildPlaybookPrompt", () => {
  it("includes the niche and the brief's guidance", () => {
    const p = buildPlaybookPrompt({ niche: "vibe-coder", brief });
    expect(p).toContain("vibe-coder");
    expect(p).toContain("front-load the payoff");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/studio/brain.test.ts`
Expected: FAIL — `buildBriefPrompt`/`buildPlaybookPrompt` not exported.

- [ ] **Step 3: Add the builders**

In `src/lib/studio/brain.ts`, add the `AlgorithmBrief` type to the import, then add:

```ts
export function buildBriefPrompt(niche: string): string {
  return [
    `You are a YouTube growth strategist. Research the CURRENT (2026) best practices for growing a channel in this niche: ${niche}.`,
    `Cover: packaging (titles/thumbnails/CTR), retention (first-15s hooks + pacing), which formats/series are winning, posting cadence, and how to avoid the "inauthentic/mass-produced content" demotion.`,
    `Ground every claim in real, current sources (creator channels, YouTube/Creator Insider, reputable analyses) and return their titles + urls.`,
    `Respond as JSON matching: { packaging: string[], retention: string[], formats: string[], cadence: string, authenticity: string[], summary: string, sources: { title, url }[] }.`,
  ].join("\n\n");
}

export function buildPlaybookPrompt(input: {
  niche: string;
  voiceSpec?: string;
  brief: AlgorithmBrief;
  northStarContext?: string;
}): string {
  const b = input.brief;
  return [
    `You are the channel strategist for a solo-dev YouTube channel.`,
    `Niche / brand: ${input.niche}.`,
    input.voiceSpec ? `Creator voice:\n${input.voiceSpec}` : "",
    input.northStarContext ? `Existing goals/context:\n${input.northStarContext}` : "",
    `Apply these current algorithm best practices:`,
    `- Packaging: ${b.packaging.join(" | ")}`,
    `- Retention: ${b.retention.join(" | ")}`,
    `- Winning formats: ${b.formats.join(" | ")}`,
    `- Cadence: ${b.cadence}`,
    `- Authenticity: ${b.authenticity.join(" | ")}`,
    `Synthesize a Channel Playbook: the channel's positioning/wedge; a DUAL north-star (one dev-brand metric e.g. subs, one Organic on-chain metric); 1-6 content pillars (name + why); packaging formulas to use; retention rules to apply to every script; a cadence; and concrete next moves (the path to follow now).`,
    `Respond as JSON matching: { positioning, northStar: { devBrand, organic }, pillars: { name, why }[], packagingFormulas: string[], retentionRules: string[], cadence, nextMoves: string[] }.`,
  ].filter(Boolean).join("\n\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/studio/brain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/brain.ts src/lib/studio/brain.test.ts
git commit -m "feat(studio): brief + playbook prompt builders"
```

---

## Task 5: Algorithm Brief cache (server)

**Files:**
- Create: `src/server/studio/algorithm-brief.ts`, `src/server/studio/algorithm-brief.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/studio/algorithm-brief.test.ts` (mirrors `briefing.test.ts`'s mock approach):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AlgorithmBrief } from "@/lib/studio/schemas";

vi.mock("@/lib/supabase/server", () => ({ supabaseService: vi.fn() }));

const BRIEF: AlgorithmBrief = {
  packaging: ["p"], retention: ["r"], formats: [], cadence: "c",
  authenticity: [], summary: "s", sources: [],
};

function mockDb(latestRow: unknown, inserted: unknown = { id: "new" }) {
  const insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: inserted, error: null }) }),
  });
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: latestRow, error: null }),
          }),
        }),
      }),
    }),
    insert,
  });
  return { from, insert };
}

describe("runAlgorithmBrief", () => {
  beforeEach(() => vi.resetModules());

  it("returns the cached brief without researching when fresh", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    const { from } = mockDb({ brief: BRIEF, researched_at: "2026-06-01T00:00:00Z" });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { runAlgorithmBrief } = await import("./algorithm-brief");
    const research = vi.fn();
    const r = await runAlgorithmBrief("pid", research, { freshnessDays: 7, now: new Date("2026-06-05T00:00:00Z") });
    expect(research).not.toHaveBeenCalled();
    expect(r.brief).toEqual(BRIEF);
    expect(r.stale).toBe(false);
  });

  it("researches and inserts when the cache is stale", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    const { from, insert } = mockDb({ brief: BRIEF, researched_at: "2026-05-01T00:00:00Z" });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { runAlgorithmBrief } = await import("./algorithm-brief");
    const fresh: AlgorithmBrief = { ...BRIEF, summary: "fresh" };
    const research = vi.fn().mockResolvedValue(fresh);
    const r = await runAlgorithmBrief("pid", research, { freshnessDays: 7, now: new Date("2026-06-05T00:00:00Z") });
    expect(research).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalled();
    expect(r.brief).toEqual(fresh);
  });

  it("falls back to the stale cached brief when research throws", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    const { from } = mockDb({ brief: BRIEF, researched_at: "2026-05-01T00:00:00Z" });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { runAlgorithmBrief } = await import("./algorithm-brief");
    const research = vi.fn().mockRejectedValue(new Error("web research down"));
    const r = await runAlgorithmBrief("pid", research, { freshnessDays: 7, now: new Date("2026-06-05T00:00:00Z") });
    expect(r.brief).toEqual(BRIEF);
    expect(r.stale).toBe(true);
  });

  it("rethrows when research fails and there is no cached brief", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    const { from } = mockDb(null);
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { runAlgorithmBrief } = await import("./algorithm-brief");
    const research = vi.fn().mockRejectedValue(new Error("down"));
    await expect(runAlgorithmBrief("pid", research, { now: new Date() })).rejects.toThrow("down");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/studio/algorithm-brief.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the cache**

Create `src/server/studio/algorithm-brief.ts`:

```ts
import { supabaseService } from "@/lib/supabase/server";
import { AlgorithmBrief } from "@/lib/studio/schemas";
import type { Json } from "@/lib/supabase/types";

export interface BriefRow {
  brief: AlgorithmBrief;
  researched_at: string;
}

/** Most recent brief for the profile, or null. */
export async function getAlgorithmBrief(profileId: string): Promise<BriefRow | null> {
  const sb = supabaseService();
  const { data } = await sb
    .from("algorithm_briefs")
    .select("brief, researched_at")
    .eq("profile_id", profileId)
    .order("researched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const parsed = AlgorithmBrief.safeParse(data.brief);
  if (!parsed.success) return null;
  return { brief: parsed.data, researched_at: data.researched_at };
}

/**
 * Return the cached brief if within the freshness window; otherwise run `research`
 * and cache it. On research failure, fall back to the stale cache if one exists,
 * else rethrow. `now` is injectable for tests.
 */
export async function runAlgorithmBrief(
  profileId: string,
  research: () => Promise<AlgorithmBrief>,
  opts: { freshnessDays?: number; now?: Date } = {},
): Promise<{ brief: AlgorithmBrief; researched_at: string; stale: boolean }> {
  const now = opts.now ?? new Date();
  const windowMs = (opts.freshnessDays ?? 7) * 24 * 60 * 60 * 1000;
  const latest = await getAlgorithmBrief(profileId);
  if (latest && now.getTime() - new Date(latest.researched_at).getTime() < windowMs) {
    return { ...latest, stale: false };
  }
  try {
    const fresh = await research();
    const researched_at = now.toISOString();
    const sb = supabaseService();
    const { error } = await sb
      .from("algorithm_briefs")
      .insert({ profile_id: profileId, brief: fresh as unknown as Json, researched_at })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { brief: fresh, researched_at, stale: false };
  } catch (err) {
    if (latest) return { ...latest, stale: true };
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/studio/algorithm-brief.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/studio/algorithm-brief.ts src/server/studio/algorithm-brief.test.ts
git commit -m "feat(studio): algorithm-brief cache with freshness + stale fallback"
```

---

## Task 6: Channel Playbook generation + persistence (server)

**Files:**
- Create: `src/server/studio/playbook.ts`, `src/server/studio/playbook.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/studio/playbook.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChannelPlaybook } from "@/lib/studio/schemas";

vi.mock("@/lib/supabase/server", () => ({ supabaseService: vi.fn(), supabaseServer: vi.fn() }));
vi.mock("@/lib/generate", () => ({ generateStructured: vi.fn() }));
vi.mock("./algorithm-brief", () => ({ runAlgorithmBrief: vi.fn(), getAlgorithmBrief: vi.fn() }));
vi.mock("@/lib/voice-prompt", () => ({ buildVoiceSystemFromSpec: () => "voice" }));

const PLAYBOOK: ChannelPlaybook = {
  positioning: "p", northStar: { devBrand: "d", organic: "o" },
  pillars: [{ name: "n", why: "w" }], packagingFormulas: ["f"],
  retentionRules: ["r"], cadence: "c", nextMoves: ["m"],
};

describe("generateChannelPlaybook", () => {
  beforeEach(() => vi.resetModules());

  it("researches the brief, synthesizes, persists, and returns the playbook", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "pid", niche_description: "vibe" }, error: null }) }),
      }),
      update,
    });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);

    const { runAlgorithmBrief } = await import("./algorithm-brief");
    vi.mocked(runAlgorithmBrief).mockResolvedValue({
      brief: { packaging: ["p"], retention: ["r"], formats: [], cadence: "c", authenticity: [], summary: "s", sources: [] },
      researched_at: "2026-06-05T00:00:00Z", stale: false,
    });
    const { generateStructured } = await import("@/lib/generate");
    vi.mocked(generateStructured).mockResolvedValue({ data: PLAYBOOK } as never);

    const { generateChannelPlaybook } = await import("./playbook");
    const result = await generateChannelPlaybook("pid");
    expect(result.positioning).toBe("p");
    expect(result.briefResearchedAt).toBe("2026-06-05T00:00:00Z");
    expect(update).toHaveBeenCalled();
  });

  it("throws and does not persist when synthesis returns no data", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "pid", niche_description: "vibe" }, error: null }) }),
      }),
      update,
    });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { runAlgorithmBrief } = await import("./algorithm-brief");
    vi.mocked(runAlgorithmBrief).mockResolvedValue({
      brief: { packaging: ["p"], retention: ["r"], formats: [], cadence: "c", authenticity: [], summary: "s", sources: [] },
      researched_at: "2026-06-05T00:00:00Z", stale: false,
    });
    const { generateStructured } = await import("@/lib/generate");
    vi.mocked(generateStructured).mockResolvedValue({ data: null, raw: "" } as never);

    const { generateChannelPlaybook } = await import("./playbook");
    await expect(generateChannelPlaybook("pid")).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/studio/playbook.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement playbook generation**

Create `src/server/studio/playbook.ts`:

```ts
"use server";
import { supabaseService, supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { AlgorithmBrief, ChannelPlaybook } from "@/lib/studio/schemas";
import { buildBriefPrompt, buildPlaybookPrompt } from "@/lib/studio/brain";
import { buildVoiceSystemFromSpec } from "@/lib/voice-prompt";
import { runAlgorithmBrief } from "./algorithm-brief";
import type { Json } from "@/lib/supabase/types";

const DEFAULT_NICHE = "a vibe-coder who builds on blockchain and builds in public";

export async function getChannelPlaybook(profileId: string): Promise<ChannelPlaybook | null> {
  const sb = await supabaseServer();
  const { data } = await sb.from("profiles").select("channel_playbook").eq("id", profileId).single();
  const raw = data?.channel_playbook;
  if (!raw) return null;
  const parsed = ChannelPlaybook.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function generateChannelPlaybook(
  profileId: string,
  opts: { refreshResearch?: boolean } = {},
): Promise<ChannelPlaybook> {
  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", profileId).single();
  const niche = profile?.niche_description?.trim() || DEFAULT_NICHE;
  const voiceSpec = profile ? buildVoiceSystemFromSpec(profile) : undefined;
  const northStarContext = (profile?.growth_plan as { northStar?: string } | null)?.northStar ?? undefined;

  const { brief, researched_at } = await runAlgorithmBrief(
    profileId,
    async () => {
      const r = await generateStructured(AlgorithmBrief, buildBriefPrompt(niche), { research: true, attempts: 3 });
      if (!r.data) throw new Error("algorithm research failed — try again");
      return r.data;
    },
    { freshnessDays: opts.refreshResearch ? 0 : 7 },
  );

  const r = await generateStructured(
    ChannelPlaybook,
    buildPlaybookPrompt({ niche, voiceSpec, brief, northStarContext }),
    { attempts: 4 },
  );
  if (!r.data) throw new Error("could not build the channel playbook — try again");
  const playbook: ChannelPlaybook = { ...r.data, briefResearchedAt: researched_at };

  const { error } = await sb
    .from("profiles")
    .update({ channel_playbook: playbook as unknown as Json })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  return playbook;
}
```

> Note: the `northStarContext` cast tolerates the X-side `growth_plan` shape being free-form; if `growth_plan` has no `northStar` it's simply omitted.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/studio/playbook.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/studio/playbook.ts src/server/studio/playbook.test.ts
git commit -m "feat(studio): generate + persist the Channel Playbook"
```

---

## Task 7: Thread the playbook into topic ranking + scripting

**Files:**
- Modify: `src/server/studio/projects.ts`
- Test: `src/server/studio/projects-playbook.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/server/studio/projects-playbook.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ supabaseService: vi.fn() }));
vi.mock("@/lib/studio/signals", () => ({ collectTrendSignals: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/voice-prompt", () => ({ buildVoiceSystemFromSpec: () => "voice" }));
vi.mock("@/lib/retry", () => ({ withRetry: (fn: () => unknown) => fn() }));
const rankTopics = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/studio/brain", () => ({ brain: { rankTopics, writeScript: vi.fn() } }));
const getChannelPlaybook = vi.fn();
vi.mock("./playbook", () => ({ getChannelPlaybook }));

describe("rankTopicsForProject", () => {
  beforeEach(() => vi.resetModules());
  it("passes the loaded playbook into brain.rankTopics", async () => {
    const playbook = { positioning: "p" };
    getChannelPlaybook.mockResolvedValue(playbook);
    const { supabaseService } = await import("@/lib/supabase/server");
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "pid", niche_description: "n" } }) }) }),
    });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { rankTopicsForProject } = await import("./projects");
    await rankTopicsForProject("pid");
    expect(rankTopics).toHaveBeenCalledWith(expect.objectContaining({ playbook }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/studio/projects-playbook.test.ts`
Expected: FAIL — `rankTopics` called without `playbook`.

- [ ] **Step 3: Thread the playbook**

In `src/server/studio/projects.ts`, add the import:

```ts
import { getChannelPlaybook } from "./playbook";
```

In `rankTopicsForProject`, load the playbook and pass it through:

```ts
export async function rankTopicsForProject(profileId: string): Promise<RankedTopic[]> {
  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", profileId).single();
  const voiceSpec = profile ? buildVoiceSystemFromSpec(profile) : undefined;
  const niche = profile?.niche_description?.trim() || "a vibe-coder who builds on blockchain and builds in public";
  const playbook = (await getChannelPlaybook(profileId)) ?? undefined;
  const signals = await withRetry(() => collectTrendSignals({ limit: 25 }));
  return brain.rankTopics({ niche, voiceSpec, signals, count: 6, playbook });
}
```

In `writeScriptForProject`, load the playbook and pass it to `writeScript`:

```ts
  const playbook = (await getChannelPlaybook(project.profile_id)) ?? undefined;
  const script = await brain.writeScript({ topic: project.topic as RankedTopic, voiceSpec, playbook });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/studio/projects-playbook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/studio/projects.ts src/server/studio/projects-playbook.test.ts
git commit -m "feat(studio): rank + script derive from the Channel Playbook"
```

---

## Task 8: Channel Playbook panel (UI) + wiring

**Files:**
- Create: `src/components/studio/playbook-panel.tsx`
- Modify: `src/app/(app)/studio/page.tsx`, `src/components/studio/studio-flow.tsx`

> UI task — verified manually in the browser (no unit test), matching how the other `studio/*` panels were built.

- [ ] **Step 1: Build the panel component**

Create `src/components/studio/playbook-panel.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { generateChannelPlaybook } from "@/server/studio/playbook";
import type { ChannelPlaybook } from "@/lib/studio/schemas";

export function PlaybookPanel({
  profileId, initialPlaybook, briefMeta,
}: {
  profileId: string;
  initialPlaybook: ChannelPlaybook | null;
  briefMeta: { researched_at: string; sources: { title: string; url: string }[] } | null;
}) {
  const [playbook, setPlaybook] = useState<ChannelPlaybook | null>(initialPlaybook);
  const [open, setOpen] = useState(!initialPlaybook);
  const [busy, start] = useTransition();

  function run(refreshResearch: boolean) {
    start(async () => {
      try { setPlaybook(await generateChannelPlaybook(profileId, { refreshResearch })); toast.success("Playbook updated"); }
      catch (e) { toast.error(String(e)); }
    });
  }

  if (!playbook) {
    return (
      <Card><CardContent className="flex items-center justify-between gap-3 pt-5">
        <div className="text-[13px] text-muted-foreground">No channel playbook yet — research the algorithm and lay out your path.</div>
        <Button onClick={() => run(false)} disabled={busy || !profileId}>{busy ? "Researching…" : "Generate Channel Playbook"}</Button>
      </CardContent></Card>
    );
  }

  return (
    <Card><CardContent className="space-y-3 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] font-semibold uppercase text-muted-foreground">Channel Playbook</div>
        <button className="text-[12px] text-muted-foreground underline" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Show"}</button>
      </div>
      {open && (
        <div className="space-y-3 text-[13px]">
          <div><span className="font-semibold">Positioning:</span> {playbook.positioning}</div>
          <div><span className="font-semibold">North-star:</span> dev — {playbook.northStar.devBrand} · organic — {playbook.northStar.organic}</div>
          <div><span className="font-semibold">Pillars:</span> {playbook.pillars.map((p) => p.name).join(" · ")}</div>
          <div><span className="font-semibold">Packaging:</span> {playbook.packagingFormulas.join(" · ")}</div>
          <div>
            <div className="font-semibold">Next moves:</div>
            <ul className="ml-4 list-disc">{playbook.nextMoves.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
          {briefMeta && (
            <details className="text-[12px] text-muted-foreground">
              <summary>Researched {new Date(briefMeta.researched_at).toLocaleDateString()} · {briefMeta.sources.length} sources</summary>
              <ul className="ml-4 mt-1 list-disc">
                {briefMeta.sources.map((s, i) => <li key={i}><a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}
              </ul>
            </details>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => run(false)} disabled={busy}>{busy ? "Working…" : "Refresh playbook"}</Button>
            <Button size="sm" variant="outline" onClick={() => run(true)} disabled={busy}>Refresh research</Button>
          </div>
        </div>
      )}
    </CardContent></Card>
  );
}
```

- [ ] **Step 2: Load playbook + brief meta in the page**

In `src/app/(app)/studio/page.tsx`, add imports and load the data inside the `try` block, then pass to `StudioFlow`:

```ts
import { getChannelPlaybook } from "@/server/studio/playbook";
import { getAlgorithmBrief } from "@/server/studio/algorithm-brief";
```

Inside `try`, after `ytConnected = ...`:

```ts
    playbook = await getChannelPlaybook(profile.id);
    const briefRow = await getAlgorithmBrief(profile.id);
    briefMeta = briefRow ? { researched_at: briefRow.researched_at, sources: briefRow.brief.sources } : null;
```

Declare above the `try` (next to the other `let`s):

```ts
  let playbook: Awaited<ReturnType<typeof getChannelPlaybook>> = null;
  let briefMeta: { researched_at: string; sources: { title: string; url: string }[] } | null = null;
```

Pass to `StudioFlow`: add `playbook={playbook}` and `briefMeta={briefMeta}` props.

- [ ] **Step 3: Render the panel in StudioFlow**

In `src/components/studio/studio-flow.tsx`:
- Add the import: `import { PlaybookPanel } from "./playbook-panel";` and `import type { ChannelPlaybook } from "@/lib/studio/schemas";`
- Add to the component props: `playbook: ChannelPlaybook | null;` and `briefMeta: { researched_at: string; sources: { title: string; url: string }[] } | null;`
- Render `<PlaybookPanel profileId={profileId} initialPlaybook={playbook} briefMeta={briefMeta} />` at the **top** of the returned JSX — both in the `if (!active)` empty-state branch (wrap both in a fragment/div) and in the main return, above the stage-rail `div`.

- [ ] **Step 4: Verify the build + manual check**

Run: `npx tsc --noEmit`
Expected: PASS.

Then (dev server running) load `http://localhost:3000/studio`, confirm the panel renders, click **Generate Channel Playbook**, and confirm a playbook appears with a sources disclosure. (Live DB must have migrations applied — see "After the plan".)

- [ ] **Step 5: Commit**

```bash
git add src/components/studio/playbook-panel.tsx "src/app/(app)/studio/page.tsx" src/components/studio/studio-flow.tsx
git commit -m "feat(studio): Channel Playbook panel + wiring"
```

---

## Task 9: Full verification + integration review

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all pass (prior 255 + the new tests), 1 skipped.

- [ ] **Step 2: Production build** (stop the dev server first to avoid the `.next` clash)

Run: `npm run build`
Expected: green, route table prints, no type/lint errors.

- [ ] **Step 3: Request a code review**

Use `superpowers:requesting-code-review` against the diff for the whole slice; address any findings (TDD) before merge.

- [ ] **Step 4: Commit any review fixes, then stop**

```bash
git add -A && git commit -m "fix(studio): address Channel Playbook review findings"
```

---

## After the plan (owner-gated)

1. **Apply migrations `0012` + `0013` to the live Supabase project** (`vzxpakxjnuaesfxihyvl`) via the Supabase MCP `apply_migration` — same gate as slice 1. Until applied, the page's `try/catch` keeps `/studio` rendering (playbook simply stays null).
2. **Live smoke test:** generate a Channel Playbook against real research, confirm a topic scan + script now reflect it.
3. **Next specs (deferred):** `AgentSdkBrain` + external skill chain (④), Apify-X/GitHub signals (⑤), scoreboard analytics (⑥).
