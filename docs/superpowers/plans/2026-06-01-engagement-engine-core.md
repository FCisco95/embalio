# Engagement Engine Core — Implementation Plan (Plan A of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Embalio's reply engine non-generic — target the *right* posts (author 5–20× the owner's size, fresh, uncrowded) and draft replies that pick a scenario recipe and are written to make the original author reply back (X's ~150× signal).

**Architecture:** Add a pure `engagement` module (`knobs`, `scoring` upgrade, `reply-craft` prompt builder) parameterized by quiz-derived knobs read from the `profiles` row, then wire it into the existing `scanTargetsForProfile` / `draftRepliesForProfile` path. Pure functions are unit-tested; the model picks the scenario in-prompt (asserted via golden-prompt tests).

**Tech Stack:** TypeScript, Vitest (`npm test` = `vitest run`), Zod schemas, Supabase (jsonb `metrics_snapshot`; new nullable `profiles` columns), `claude -p` generation. `@/` path alias → `src/`.

**Scope (Plan A):** data capture + knobs + targeting + reply-craft. **Out (Plan B/C):** the Scan→Engage and Create-a-post UI, the quiz redesign, the Growth Plan artifact. This plan ships a measurable engine improvement testable without UI.

**Spec:** `docs/superpowers/specs/2026-06-01-engagement-engine-and-quiz-design.md`
**Research grounding:** `docs/superpowers/notes/2026-06-01-x-growth-playbook-research.md`

---

## File structure (locked before tasks)

- Create `src/lib/engagement/knobs.ts` — `EngagementKnobs` type + `knobsFromProfile(row)` (pure). Maps account-size bucket → owner-follower estimate + 5–20× target band; capacity → daily reply target; pulls goal + reply playbook.
- Create `src/lib/engagement/knobs.test.ts`.
- Create `src/lib/engagement/reply-craft.ts` — `buildEngagementReplyPrompt(voiceSystem, target, knobs)` (pure). The anti-slop, scenario-aware, author-reply-objective reply prompt.
- Create `src/lib/engagement/reply-craft.test.ts` — golden-prompt assertions.
- Modify `src/lib/scoring.ts` — extend `ScoreInputs` with optional `authorFollowers`, `ownerFollowerEstimate`, `replyCount`; apply size-fit + crowding multipliers (backward compatible).
- Modify `src/lib/scoring.test.ts` — add cases for the new factors.
- Modify `src/lib/apify.ts` — capture `authorFollowers` into `CandidateInput.metrics_snapshot`.
- Modify `src/lib/apify.test.ts` — assert the new field maps.
- Modify `src/lib/schemas.ts` — add `scenario` to `ReplyDraft`.
- Modify `src/server/targeting.ts` — feed author size/replyCount into scoring; use the new reply prompt + persist scenario.
- Create `supabase/migrations/0007_engagement_knobs.sql` — add `account_size`, `daily_capacity`, `reply_playbook` to `profiles`.
- Modify `src/lib/supabase/types.ts` — add the three columns to the `profiles` Row/Insert/Update.
- Modify `src/server/setup.ts` — persist `account_size` + `daily_capacity` in `finalizeSetup`.

---

## Task 1: Capture author follower count from Apify

**Files:**
- Modify: `src/lib/apify.ts:6-12` (CandidateInput), `src/lib/apify.ts:40-54` (mapping)
- Test: `src/lib/apify.test.ts`

- [ ] **Step 1: Write the failing test** — add to `src/lib/apify.test.ts`:

```typescript
it("maps author follower count into metrics_snapshot", async () => {
  const client = fakeClient([
    { id: "1", url: "https://x.com/a/status/1", text: "hi", author: { userName: "a", followers: 1234 }, likeCount: 2, viewCount: 9, replyCount: 1, createdAt: "2026-05-30T00:00:00Z" },
  ]);
  const out = await pullTweets(client, "actor", { handles: ["@a"] });
  expect(out[0].metrics_snapshot.authorFollowers).toBe(1234);
});
```

(Use the existing `fakeClient`/mock helper already in this test file; match its current style.)

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/apify.test.ts`
Expected: FAIL — `authorFollowers` is `undefined` / not on the type.

- [ ] **Step 3: Implement** — in `src/lib/apify.ts`, extend the interface (lines 6-12):

```typescript
export interface CandidateInput {
  source_tweet_id: string;
  author_handle: string;
  tweet_text: string;
  tweet_url: string;
  metrics_snapshot: { likes: number; views: number; replies: number; authorFollowers: number; createdAt: string };
}
```

And the mapping (inside `pullTweets`, the `metrics_snapshot` object, lines 47-52):

```typescript
      metrics_snapshot: {
        likes: t.likeCount ?? 0,
        views: t.viewCount ?? 0,
        replies: t.replyCount ?? 0,
        authorFollowers: t.author?.followers ?? t.author?.followersCount ?? t.authorFollowers ?? 0,
        createdAt: t.createdAt ?? new Date().toISOString(),
      },
```

> Live-data note: the `apidojo/tweet-scraper` field for follower count is unverified. The `?? ` chain covers the likely names; confirm against one live run's raw item and tighten if needed (this is the same field-mapping seam flagged for live setup).

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/lib/apify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apify.ts src/lib/apify.test.ts
git commit -m "feat(engagement): capture author follower count from Apify"
```

---

## Task 2: Add engine-knob columns to profiles

**Files:**
- Create: `supabase/migrations/0007_engagement_knobs.sql`
- Modify: `src/lib/supabase/types.ts` (profiles Row/Insert/Update)

- [ ] **Step 1: Write the migration**

```sql
-- 0007_engagement_knobs.sql
-- Engine knobs collected by setup but previously unpersisted.
alter table profiles add column if not exists account_size text;
alter table profiles add column if not exists daily_capacity text;
alter table profiles add column if not exists reply_playbook text;
```

- [ ] **Step 2: Apply the migration**

Run (against the live project, as the rest of the schema is managed):
`supabase db push` (or paste the SQL via the Supabase SQL editor / MCP `apply_migration`).
Expected: three columns added, no error (idempotent via `if not exists`).

- [ ] **Step 3: Update generated types** — in `src/lib/supabase/types.ts`, add to the `profiles` table's `Row`, `Insert`, and `Update` types:

```typescript
account_size: string | null
daily_capacity: string | null
reply_playbook: string | null
```

(In `Insert`/`Update` make them optional: `account_size?: string | null` etc. Match the file's existing formatting for other nullable text columns.)

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: build succeeds (no type errors from the new columns).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_engagement_knobs.sql src/lib/supabase/types.ts
git commit -m "feat(engagement): add account_size, daily_capacity, reply_playbook columns"
```

---

## Task 3: Engagement knobs (pure)

**Files:**
- Create: `src/lib/engagement/knobs.ts`
- Test: `src/lib/engagement/knobs.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { knobsFromProfile } from "@/lib/engagement/knobs";

describe("knobsFromProfile", () => {
  it("derives a 5-20x target follower band from account_size", () => {
    const k = knobsFromProfile({ account_size: "500-5k", daily_capacity: "30m", north_star_metric: "grow reach", reply_playbook: null });
    expect(k.ownerFollowerEstimate).toBe(2750);
    expect(k.targetFollowerBand.min).toBe(2750 * 5);
    expect(k.targetFollowerBand.max).toBe(2750 * 20);
  });

  it("maps capacity to a daily reply target", () => {
    expect(knobsFromProfile({ account_size: null, daily_capacity: "10m", north_star_metric: null, reply_playbook: null }).dailyReplyTarget).toBe(5);
    expect(knobsFromProfile({ account_size: null, daily_capacity: "30m", north_star_metric: null, reply_playbook: null }).dailyReplyTarget).toBe(12);
    expect(knobsFromProfile({ account_size: null, daily_capacity: "60m+", north_star_metric: null, reply_playbook: null }).dailyReplyTarget).toBe(20);
  });

  it("defaults gracefully when fields are null", () => {
    const k = knobsFromProfile({ account_size: null, daily_capacity: null, north_star_metric: null, reply_playbook: null });
    expect(k.goal).toBe("general");
    expect(k.dailyReplyTarget).toBe(10);
    expect(k.ownerFollowerEstimate).toBe(250);
    expect(k.replyPlaybook).toBe("");
  });

  it("normalizes the goal", () => {
    expect(knobsFromProfile({ account_size: null, daily_capacity: null, north_star_metric: "generate inbound leads / clients", reply_playbook: null }).goal).toBe("leads");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/engagement/knobs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `src/lib/engagement/knobs.ts`:

```typescript
export type EngagementGoal = "followers" | "reach" | "leads" | "authority" | "general";

export interface EngagementKnobs {
  goal: EngagementGoal;
  ownerFollowerEstimate: number;
  targetFollowerBand: { min: number; max: number };
  dailyReplyTarget: number;
  replyPlaybook: string;
}

export interface ProfileKnobInput {
  account_size: string | null;
  daily_capacity: string | null;
  north_star_metric: string | null;
  reply_playbook: string | null;
}

// Midpoint-ish owner follower estimate per account-size bucket.
const SIZE_ESTIMATE: Record<string, number> = {
  "<500": 250,
  "500-5k": 2750,
  "5k-50k": 27500,
  "50k+": 75000,
};

// Capacity bucket → target high-quality replies/day (research: 15-20 optimum, <50 cap).
const CAPACITY_TARGET: Record<string, number> = {
  "10m": 5,
  "30m": 12,
  "60m+": 20,
};

function normalizeGoal(metric: string | null): EngagementGoal {
  const m = (metric ?? "").toLowerCase();
  if (m.includes("lead") || m.includes("client") || m.includes("inbound")) return "leads";
  if (m.includes("reach") || m.includes("impression")) return "reach";
  if (m.includes("authority") || m.includes("niche")) return "authority";
  if (m.includes("follower")) return "followers";
  return "general";
}

export function knobsFromProfile(p: ProfileKnobInput): EngagementKnobs {
  const ownerFollowerEstimate = SIZE_ESTIMATE[p.account_size ?? ""] ?? 250;
  return {
    goal: normalizeGoal(p.north_star_metric),
    ownerFollowerEstimate,
    targetFollowerBand: { min: ownerFollowerEstimate * 5, max: ownerFollowerEstimate * 20 },
    dailyReplyTarget: CAPACITY_TARGET[p.daily_capacity ?? ""] ?? 10,
    replyPlaybook: p.reply_playbook ?? "",
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/lib/engagement/knobs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engagement/knobs.ts src/lib/engagement/knobs.test.ts
git commit -m "feat(engagement): knobsFromProfile — derive targeting band + reply cadence"
```

---

## Task 4: Upgrade scoring with size-fit + crowding (backward compatible)

**Files:**
- Modify: `src/lib/scoring.ts`
- Test: `src/lib/scoring.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `src/lib/scoring.test.ts`:

```typescript
describe("compositeScore — engagement targeting factors", () => {
  const strong = { relevance: 1, likesPerHour: 50, ageHours: 1 };

  it("is unchanged when the new factors are absent (backward compatible)", () => {
    const a = compositeScore(strong);
    const b = compositeScore({ ...strong });
    expect(a.composite).toBeCloseTo(b.composite);
  });

  it("full credit when author is inside the 5-20x band", () => {
    const inBand = compositeScore({ ...strong, authorFollowers: 25000, ownerFollowerEstimate: 2750 });
    const baseline = compositeScore(strong);
    expect(inBand.composite).toBeCloseTo(baseline.composite);
  });

  it("downranks an author far above the band", () => {
    const huge = compositeScore({ ...strong, authorFollowers: 5_000_000, ownerFollowerEstimate: 2750 });
    const baseline = compositeScore(strong);
    expect(huge.composite).toBeLessThan(baseline.composite);
  });

  it("downranks a crowded post (>20 replies)", () => {
    const crowded = compositeScore({ ...strong, replyCount: 100 });
    const baseline = compositeScore(strong);
    expect(crowded.composite).toBeLessThan(baseline.composite);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: FAIL — new optional fields not honored (huge/crowded equal baseline).

- [ ] **Step 3: Implement** — replace `src/lib/scoring.ts` contents with:

```typescript
export interface ScoreInputs {
  relevance: number;   // 0..1 cosine similarity, already normalized
  likesPerHour: number;
  ageHours: number;
  authorFollowers?: number;        // for the 5-20x size-fit rule
  ownerFollowerEstimate?: number;  // owner's approx size (from knobs)
  replyCount?: number;             // crowding: <20 replies stays visible
}

export interface Scores {
  relevance: number;
  velocity: number;
  recency: number;
  composite: number;
}

const WEIGHTS = { relevance: 0.5, velocity: 0.3, recency: 0.2 };
const VELOCITY_SATURATION = 200; // likes/hr that maps to ~1.0
const RECENCY_HALFLIFE_HOURS = 12;
const REPLY_CROWD_FULL = 20;      // <= this many replies: full credit
const REPLY_CROWD_ZERO = 100;     // >= this many: no credit

// 1.0 inside the 5-20x band; ramps from 0 below 5x, decays toward 0 above 20x.
export function sizeFit(authorFollowers: number, ownerEstimate: number): number {
  if (ownerEstimate <= 0 || authorFollowers <= 0) return 1;
  const ratio = authorFollowers / ownerEstimate;
  if (ratio < 5) return clamp01(ratio / 5);
  if (ratio > 20) return clamp01(20 / ratio);
  return 1;
}

function crowding(replyCount: number): number {
  if (replyCount <= REPLY_CROWD_FULL) return 1;
  if (replyCount >= REPLY_CROWD_ZERO) return 0;
  return clamp01(1 - (replyCount - REPLY_CROWD_FULL) / (REPLY_CROWD_ZERO - REPLY_CROWD_FULL));
}

export function compositeScore(i: ScoreInputs): Scores {
  const relevance = clamp01(i.relevance);
  const velocity = clamp01(1 - Math.exp(-i.likesPerHour / VELOCITY_SATURATION));
  const recency = Math.pow(0.5, Math.max(0, i.ageHours) / RECENCY_HALFLIFE_HOURS);
  let composite =
    WEIGHTS.relevance * relevance +
    WEIGHTS.velocity * velocity +
    WEIGHTS.recency * recency;

  // Optional engagement-targeting multipliers (only when inputs provided).
  if (i.authorFollowers != null && i.ownerFollowerEstimate != null) {
    composite *= sizeFit(i.authorFollowers, i.ownerFollowerEstimate);
  }
  if (i.replyCount != null) {
    composite *= crowding(i.replyCount);
  }

  return { relevance, velocity, recency, composite: clamp01(composite) };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
```

- [ ] **Step 4: Run tests, verify all pass** (old + new)

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: PASS (existing 3 + new 4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat(engagement): size-fit + crowding factors in compositeScore"
```

---

## Task 5: Reply-craft prompt + scenario schema

**Files:**
- Modify: `src/lib/schemas.ts:85-89` (ReplyDraft)
- Create: `src/lib/engagement/reply-craft.ts`
- Test: `src/lib/engagement/reply-craft.test.ts`

- [ ] **Step 1: Add `scenario` to `ReplyDraft`** in `src/lib/schemas.ts` (replace lines 85-89):

```typescript
export const ENGAGEMENT_SCENARIOS = ["supportive", "contrarian", "witty", "technical", "question"] as const;
export const ReplyDraft = z.object({
  reply: z.string().min(1).max(560).optional(),
  scenario: z.enum(ENGAGEMENT_SCENARIOS).optional(),
  skip: z.boolean().default(false),
});
export type ReplyDraft = z.infer<typeof ReplyDraft>;
```

- [ ] **Step 2: Write the failing test** `src/lib/engagement/reply-craft.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildEngagementReplyPrompt } from "@/lib/engagement/reply-craft";
import type { EngagementKnobs } from "@/lib/engagement/knobs";

const knobs: EngagementKnobs = {
  goal: "leads",
  ownerFollowerEstimate: 2750,
  targetFollowerBand: { min: 13750, max: 55000 },
  dailyReplyTarget: 12,
  replyPlaybook: "never reply to drama",
};

const target = { authorHandle: "@naval", post: "shipping fast beats planning", reason: "rising, in-niche", scenarioHint: "" };

describe("buildEngagementReplyPrompt", () => {
  const p = buildEngagementReplyPrompt("VOICE_SYSTEM", target, knobs);

  it("states the author-reply-back objective", () => {
    expect(p).toMatch(/reply back/i);
  });
  it("defines all five scenario recipes", () => {
    for (const s of ["supportive", "contrarian", "witty", "technical", "question"]) {
      expect(p.toLowerCase()).toContain(s);
    }
  });
  it("bans slop openers explicitly", () => {
    expect(p.toLowerCase()).toContain("great post");
    expect(p.toLowerCase()).toContain("never");
  });
  it("includes the voice system and the owner's playbook", () => {
    expect(p).toContain("VOICE_SYSTEM");
    expect(p).toContain("never reply to drama");
  });
  it("tunes by goal", () => {
    expect(p.toLowerCase()).toContain("leads");
  });
  it("asks for JSON with reply + scenario + skip", () => {
    expect(p).toMatch(/"scenario"/);
    expect(p).toMatch(/"skip"/);
  });
});
```

- [ ] **Step 3: Run it, verify it fails**

Run: `npx vitest run src/lib/engagement/reply-craft.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement** `src/lib/engagement/reply-craft.ts`:

```typescript
import { frameUntrusted, sanitizeForPrompt, UNTRUSTED_DATA_NOTICE } from "@/lib/generate/sanitize";
import type { EngagementKnobs, EngagementGoal } from "@/lib/engagement/knobs";

export interface ReplyTarget {
  authorHandle: string;
  post: string;
  reason: string;
  scenarioHint?: string;
}

const GOAL_EMPHASIS: Record<EngagementGoal, string> = {
  leads: "Goal: inbound leads. Position as a credible practitioner; end with a genuine question or offer to help. No sales pitch.",
  reach: "Goal: reach. Add a take saveable/quotable enough that others want to reply to YOU, not just agree.",
  authority: "Goal: authority. Bring depth — original data, a precise mechanism, or a counterexample.",
  followers: "Goal: followers. Be a sharp peer; a small specific insight that earns the profile click.",
  general: "Goal: steady growth. Add genuine, specific value.",
};

const SCENARIO_RECIPES = [
  "supportive — affirm in half a sentence, then add a fact/mechanism/example the post did not have.",
  "contrarian — disagree on substance with evidence, stay warm (never dunk). This best earns the author's reply.",
  "witty — one sharp ON-TOPIC line that reframes the post. No generic memes.",
  "technical — the precise practitioner detail/gotcha/number only an expert knows.",
  "question — a specific question that proves you read it and that the author will enjoy answering.",
].join("\n- ");

export function buildEngagementReplyPrompt(
  voiceSystem: string,
  target: ReplyTarget,
  knobs: EngagementKnobs,
): string {
  return [
    voiceSystem,
    UNTRUSTED_DATA_NOTICE,
    `OBJECTIVE: write a reply engineered to make the original author reply BACK to you — that is the highest-value signal on X (~150× a like). Aim for a response, not applause.`,
    GOAL_EMPHASIS[knobs.goal],
    knobs.replyPlaybook ? `The owner's hard reply rules (obey strictly):\n${sanitizeForPrompt(knobs.replyPlaybook, 1000)}` : "",
    `Reply to this post by ${sanitizeForPrompt(target.authorHandle, 100)} (${sanitizeForPrompt(target.reason, 200)}):\n${frameUntrusted(target.post)}`,
    `First, classify the post into ONE engagement scenario, then write the reply using that scenario's recipe:\n- ${SCENARIO_RECIPES}`,
    `Hard rules:\n- Standalone value: the reply must make sense even if nobody read the original.\n- Be specific (a number, example, named experience). Concise: 1-2 sentences.\n- NEVER open with or use slop: "great post", "this 🔥", "well said", "100%", "so true", bare emoji, or restating their point.\n- If you have nothing genuinely valuable to add, set skip:true.`,
    `Return exactly this JSON: {"reply": "...", "scenario": "supportive"|"contrarian"|"witty"|"technical"|"question", "skip": false} or {"skip": true}.`,
  ].filter(Boolean).join("\n\n");
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run src/lib/engagement/reply-craft.test.ts src/lib/schemas.test.ts`
Expected: PASS (schema test, if present, still green; new reply-craft tests green).

- [ ] **Step 6: Commit**

```bash
git add src/lib/engagement/reply-craft.ts src/lib/engagement/reply-craft.test.ts src/lib/schemas.ts
git commit -m "feat(engagement): scenario-aware, anti-slop reply-craft prompt"
```

---

## Task 6: Wire the engine into targeting

**Files:**
- Modify: `src/server/targeting.ts` (rankCandidates 19-31; scanTargetsForProfile 40-70; draftRepliesForProfile 79-105)

- [ ] **Step 1: Write the failing test** — create `src/server/targeting.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { rankCandidates } from "@/server/targeting";
import type { CandidateInput } from "@/lib/apify";

function cand(id: string, authorFollowers: number, replies: number): CandidateInput {
  return {
    source_tweet_id: id, author_handle: "@x", tweet_text: "t", tweet_url: "u",
    metrics_snapshot: { likes: 50, views: 0, replies, authorFollowers, createdAt: new Date().toISOString() },
  };
}

describe("rankCandidates with owner size", () => {
  it("ranks an in-band, uncrowded post above a mega-account crowded one", () => {
    const cands = [cand("mega", 5_000_000, 200), cand("inband", 25_000, 3)];
    const ranked = rankCandidates(cands, () => 1, 2, 2750);
    expect(ranked[0].source_tweet_id).toBe("inband");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/server/targeting.test.ts`
Expected: FAIL — `rankCandidates` takes 3 args, not 4 (ownerEstimate).

- [ ] **Step 3: Implement** — in `src/server/targeting.ts`:

(a) Add import at top:
```typescript
import { knobsFromProfile } from "@/lib/engagement/knobs";
import { buildEngagementReplyPrompt } from "@/lib/engagement/reply-craft";
import { buildVoiceSystem } from "@/lib/voice-prompt";
import { generateStructured } from "@/lib/generate";
import { ReplyDraft } from "@/lib/schemas";
```

(b) Replace `rankCandidates` (19-31) to thread the owner estimate into scoring:
```typescript
export function rankCandidates(
  cands: CandidateInput[],
  relevanceOf: (c: CandidateInput) => number,
  topN: number,
  ownerFollowerEstimate?: number,
): RankedCandidate[] {
  const scored = cands.map((c) => {
    const ageHours = (Date.now() - new Date(c.metrics_snapshot.createdAt).getTime()) / 3600_000;
    const likesPerHour = c.metrics_snapshot.likes / Math.max(1, ageHours);
    const s = compositeScore({
      relevance: relevanceOf(c),
      likesPerHour,
      ageHours,
      authorFollowers: c.metrics_snapshot.authorFollowers,
      ownerFollowerEstimate,
      replyCount: c.metrics_snapshot.replies,
    });
    return { ...c, score_relevance: s.relevance, score_velocity: s.velocity, score_recency: s.recency, score_composite: s.composite };
  });
  return scored.sort((a, b) => b.score_composite - a.score_composite).slice(0, topN);
}
```

(c) In `scanTargetsForProfile`, pass the owner estimate (after loading `profile`, around line 56):
```typescript
  const knobs = knobsFromProfile(profile);
  const ranked = rankCandidates(raw, (c) => relevanceById.get(c.source_tweet_id) ?? 0, TOP_N, knobs.ownerFollowerEstimate);
```

(d) Replace the draft loop body in `draftRepliesForProfile` (select author_handle too; use the new prompt; persist scenario). Change the candidates select (line 83-85) to include author_handle:
```typescript
  const { data: cands } = await sb.from("candidates")
    .select("id, tweet_text, author_handle").eq("profile_id", profileId).eq("status", "surfaced")
    .order("score_composite", { ascending: false }).limit(limit);
  const knobs = knobsFromProfile(profile);
  const voiceSystem = buildVoiceSystem({
    handle: profile.handle, niche_description: profile.niche_description,
    voice_corpus: profile.voice_corpus, voice_notes: profile.voice_notes,
  });
```

And replace the loop (94-103):
```typescript
  for (const c of cands ?? []) {
    const { count } = await sb.from("drafts").select("id", { count: "exact", head: true }).eq("candidate_id", c.id);
    if ((count ?? 0) > 0) continue;
    const prompt = buildEngagementReplyPrompt(voiceSystem, { authorHandle: c.author_handle, post: c.tweet_text, reason: "surfaced opportunity" }, knobs);
    const r = await generateStructured(ReplyDraft, prompt);
    if (!r.data || r.data.skip || !r.data.reply) continue;
    await sb.from("drafts").insert({
      profile_id: profileId, kind: "reply", candidate_id: c.id,
      body: r.data.reply, model_used: process.env.GEN_BACKEND ?? "subscription",
      engagement_scenario: r.data.scenario ?? null,
    });
    drafted++;
  }
```

> Note: `drafts.engagement_scenario` is a new nullable column — add it in this task's migration step below, or drop the field from the insert if deferring. Persisting scenario is cheap and useful; include it.

- [ ] **Step 4: Add `engagement_scenario` to drafts** — append to `supabase/migrations/0007_engagement_knobs.sql`:
```sql
alter table drafts add column if not exists engagement_scenario text;
```
And add `engagement_scenario: string | null` to the `drafts` Row/Insert/Update in `src/lib/supabase/types.ts`. Re-apply the migration (`supabase db push`).

- [ ] **Step 5: Run tests + build**

Run: `npx vitest run src/server/targeting.test.ts && npm run build`
Expected: PASS + build clean.

- [ ] **Step 6: Commit**

```bash
git add src/server/targeting.ts src/server/targeting.test.ts supabase/migrations/0007_engagement_knobs.sql src/lib/supabase/types.ts
git commit -m "feat(engagement): wire knobs + scenario reply-craft into targeting"
```

---

## Task 7: Persist account_size + daily_capacity in finalizeSetup

**Files:**
- Modify: `src/server/setup.ts` (the `profiles.update({...})` in `finalizeSetup`)

- [ ] **Step 1: Read** `src/server/setup.ts` and locate the `supabaseService().from("profiles").update({...}).eq("id", profileId)` call inside `finalizeSetup`.

- [ ] **Step 2: Add the two fields** to that update object (alongside `handle`, `niche_description`, `voice_corpus`, `voice_notes`):

```typescript
      account_size: a.accountSize,
      daily_capacity: a.capacity,
```

(`a` is the `SetupAnswers` already in scope. `reply_playbook` is populated by the Plan C quiz; leave it out here.)

- [ ] **Step 3: Verify build + existing setup tests**

Run: `npm run build && npx vitest run src/server`
Expected: PASS / clean.

- [ ] **Step 4: Commit**

```bash
git add src/server/setup.ts
git commit -m "feat(engagement): persist account_size + daily_capacity from setup"
```

---

## Task 8: Full verification

- [ ] **Step 1: Run the whole suite** (never with `RUN_RLS_INTEGRATION=1`)

Run: `npm test`
Expected: all green (prior count + the new engagement tests), ≤1 skipped (RLS).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit any final fixups**

```bash
git add -A
git commit -m "test(engagement): green suite + clean build for engine core"
```

---

## Self-review (completed against the spec)

- **Spec §4.1 Targeting** → Tasks 1,4,6 (author followers captured; size-fit + crowding; owner estimate threaded). Recency already weighted; goal-reweighting beyond size-fit is deferred to a later iteration (size-fit is the primary research lever) — noted, not silently dropped.
- **Spec §4.2 Reply-craft** → Task 5 (5 scenarios, author-reply objective, slop-ban, playbook + goal tuning, scenario persisted in Task 6).
- **Spec §7 Data model** → Tasks 1,2,6 (authorFollowers in jsonb; account_size/daily_capacity/reply_playbook columns; engagement_scenario on drafts).
- **Knob wiring (§5)** → Tasks 3,6,7 (knobsFromProfile; threaded into scan + draft; account_size/capacity persisted).
- **Out of scope (correctly absent):** Post-craft/Create-a-post, Scan→Engage UI, quiz redesign, Growth Plan, platform LinkedIn/YouTube — these are Plans B & C.
- **Placeholder scan:** none — every code step has complete code; commands have expected output.
- **Type consistency:** `ScoreInputs` optional fields match usage in `rankCandidates`; `EngagementKnobs` shape matches `knobsFromProfile` and `buildEngagementReplyPrompt`; `ReplyDraft.scenario` enum matches `ENGAGEMENT_SCENARIOS` used in the prompt's JSON instruction.
- **Open verify item:** the live Apify follower-count field name (Task 1) needs confirmation against a real run.
