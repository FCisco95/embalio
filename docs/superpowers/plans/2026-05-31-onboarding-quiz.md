# Onboarding Quiz — First-Account Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a takeover, tap-first, one-question-per-screen setup flow at `/setup` that captures the data Embalio needs (handle, account size, premium, pillars, goal, capacity, voice), then synthesizes a voice spec + recommends accounts to follow, persisting `voice_spec` + `seed_targets`.

**Architecture:** A small client step-machine (`setup-quiz.tsx`) drives screens from a `STEPS` config array. All transformation logic lives in pure, unit-tested helpers (`setup-logic.ts`). Persistence and generation reuse the existing engine (`synthesizePersona`, a new extracted `recommendTargets`, `savePersona`) through a thin server-action orchestrator (`setup.ts`). One new server action pulls the user's own posts via the existing Apify client to auto-build the voice corpus. No schema migration — every field maps to an existing `profiles` column.

**Tech Stack:** Next.js 16 (App Router, server actions), React client components, Supabase (`save_persona` RPC + `profiles`/`seed_targets`), Zod schemas, Apify (`apify-client`), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-31-onboarding-quiz-design.md`

---

## File Structure

**Create:**
- `src/lib/setup-steps.ts` — `STEPS` config array + `StepDef`/`SetupAnswers` types (data only).
- `src/lib/setup-steps.test.ts` — `STEPS` integrity tests.
- `src/lib/setup-logic.ts` — pure transforms: `answersToInterview`, `needsSetup`, `curatedSeedHandles`, `normHandle`.
- `src/lib/setup-logic.test.ts` — tests for the pure transforms.
- `src/server/voice-pull.ts` — `pullOwnVoiceCorpus(handle)` server action wrapping Apify `pullTweets`.
- `src/server/voice-pull.test.ts` — maps Apify rows → corpus; throws when `APIFY_TOKEN` absent.
- `src/server/setup.ts` — `getSetupProfileId`, `buildSetupPreview`, `finalizeSetup` server actions.
- `src/server/setup.test.ts` — orchestration tests (mocks).
- `src/components/setup-quiz.tsx` — the client step-machine UI.
- `src/app/setup/page.tsx` — takeover route (outside the `(app)` group → no nav).

**Modify:**
- `src/server/target-queue.ts` — extract `recommendTargets(input)`; `generateTargetQueue` becomes a thin wrapper (keeps existing behavior + test green).
- `src/app/(app)/page.tsx:43-57` — redirect to `/setup` when `needsSetup(profile)`.

**Commit trailer:** every commit in this plan must end its message with:
```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

**Branch:** work on a dedicated branch off `make-it-true` (e.g. `feat/onboarding-quiz`). Re-check the branch before each commit and stage only the files listed in that task.

---

### Task 1: Steps config + types

**Files:**
- Create: `src/lib/setup-steps.ts`
- Test: `src/lib/setup-steps.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/setup-steps.test.ts
import { describe, it, expect } from "vitest";
import { STEPS, type StepDef } from "@/lib/setup-steps";

describe("STEPS config", () => {
  it("has the 7 expected step ids in order", () => {
    expect(STEPS.map((s) => s.id)).toEqual([
      "handle", "accountSize", "premium", "pillars", "goal", "capacity", "voiceMethod",
    ]);
  });

  it("every step has a question and explanation", () => {
    for (const s of STEPS) {
      expect(s.question.length).toBeGreaterThan(0);
      expect(s.explanation.length).toBeGreaterThan(0);
    }
  });

  it("choice steps (single/chips/toggle) define options", () => {
    const choice = STEPS.filter((s: StepDef) => s.kind !== "text");
    for (const s of choice) {
      expect(Array.isArray(s.options)).toBe(true);
      expect(s.options!.length).toBeGreaterThan(0);
    }
  });

  it("ids are unique", () => {
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(STEPS.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/setup-steps.test.ts`
Expected: FAIL — cannot find module `@/lib/setup-steps`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/setup-steps.ts
export type StepKind = "text" | "single" | "chips" | "toggle";
export type SetupFieldId =
  | "handle" | "accountSize" | "premium" | "pillars" | "goal" | "capacity" | "voiceMethod";

export interface StepOption {
  value: string;
  label: string;
}

export interface StepDef {
  id: SetupFieldId;
  question: string;
  explanation: string;
  kind: StepKind;
  options?: StepOption[];
  allowOpenText?: boolean;
  required?: boolean;
}

export interface SetupAnswers {
  handle: string;
  accountSize: string;
  premium: boolean;
  pillars: string[];
  goal: string;
  goalOpen?: string;
  capacity: string;
  voiceMethod: "pull" | "paste" | "tags";
  voiceCorpus: string[];
  voiceTags: string[];
}

export const EMPTY_ANSWERS: SetupAnswers = {
  handle: "", accountSize: "", premium: false, pillars: [],
  goal: "", goalOpen: "", capacity: "", voiceMethod: "pull", voiceCorpus: [], voiceTags: [],
};

export const STEPS: StepDef[] = [
  {
    id: "handle", kind: "text", required: true,
    question: "What's your X handle?",
    explanation: "So I can label your account and pull your recent posts to learn your voice.",
  },
  {
    id: "accountSize", kind: "single", required: true,
    question: "How big is the account today?",
    explanation: "This calibrates who I recommend you follow and what goals are realistic.",
    options: [
      { value: "<500", label: "Just starting (under 500)" },
      { value: "500-5k", label: "500 – 5k" },
      { value: "5k-50k", label: "5k – 50k" },
      { value: "50k+", label: "50k+" },
    ],
  },
  {
    id: "premium", kind: "toggle", required: true,
    question: "Are you on X Premium?",
    explanation: "Premium changes the algorithm rules I write to (post length, reach weighting).",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "pillars", kind: "chips", required: true, allowOpenText: true,
    question: "What do you post about?",
    explanation: "Your content pillars drive opportunity scoring and account recommendations.",
    options: [
      { value: "AI agents", label: "AI agents" },
      { value: "Building in public", label: "Building in public" },
      { value: "Dev tools", label: "Dev tools" },
      { value: "Startups", label: "Startups" },
    ],
  },
  {
    id: "goal", kind: "single", required: true, allowOpenText: true,
    question: "What's your main growth goal?",
    explanation: "I tailor recommendations and framing to what you actually want.",
    options: [
      { value: "followers", label: "More followers" },
      { value: "reach", label: "More reach / impressions" },
      { value: "leads", label: "Inbound leads / clients" },
      { value: "authority", label: "Authority in my niche" },
    ],
  },
  {
    id: "capacity", kind: "single", required: true,
    question: "How much time can you spend per day?",
    explanation: "This sets how many opportunities I surface and how often I draft.",
    options: [
      { value: "10m", label: "~10 minutes" },
      { value: "30m", label: "~30 minutes" },
      { value: "60m+", label: "1 hour or more" },
    ],
  },
  {
    id: "voiceMethod", kind: "single", required: true, allowOpenText: true,
    question: "How should I learn your voice?",
    explanation: "So drafts sound like the same person wrote them — not a bot.",
    options: [
      { value: "pull", label: "Pull my recent posts (recommended)" },
      { value: "paste", label: "I'll paste a few posts" },
      { value: "tags", label: "Just describe it with tags" },
    ],
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/setup-steps.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/setup-steps.ts src/lib/setup-steps.test.ts
git commit -m "$(printf 'feat(onboarding): setup steps config + types\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: Pure transform helpers

**Files:**
- Create: `src/lib/setup-logic.ts`
- Test: `src/lib/setup-logic.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/setup-logic.test.ts
import { describe, it, expect } from "vitest";
import { answersToInterview, needsSetup, curatedSeedHandles } from "@/lib/setup-logic";
import { EMPTY_ANSWERS, type SetupAnswers } from "@/lib/setup-steps";

const base: SetupAnswers = {
  ...EMPTY_ANSWERS,
  handle: "@fcisco95",
  accountSize: "<500",
  premium: true,
  pillars: ["AI agents", "Dev tools"],
  goal: "followers",
  capacity: "30m",
  voiceMethod: "tags",
  voiceTags: ["punchy", "lowercase"],
};

describe("answersToInterview", () => {
  it("maps pillars to niche and the goal bucket to a north-star phrase", () => {
    const iv = answersToInterview(base);
    expect(iv.niche).toBe("AI agents, Dev tools");
    expect(iv.goals).toBe("grow followers");
    expect(iv.northStarMetric).toBe("grow followers");
    expect(iv.premiumAccount).toBe(true);
  });

  it("prefers open-text goal over the bucket when provided", () => {
    const iv = answersToInterview({ ...base, goalOpen: "1k followers in 90 days" });
    expect(iv.goals).toBe("1k followers in 90 days");
  });

  it("uses voice tags as tone when method is tags", () => {
    expect(answersToInterview(base).tone).toBe("punchy, lowercase");
  });
});

describe("needsSetup", () => {
  it("true when profile is missing", () => {
    expect(needsSetup(null)).toBe(true);
  });
  it("true when voice_spec or pillars are empty", () => {
    expect(needsSetup({ voice_spec: "", content_pillars: ["x"] })).toBe(true);
    expect(needsSetup({ voice_spec: "spec", content_pillars: [] })).toBe(true);
  });
  it("false when both voice_spec and pillars are present", () => {
    expect(needsSetup({ voice_spec: "spec", content_pillars: ["AI"] })).toBe(false);
  });
});

describe("curatedSeedHandles", () => {
  it("keeps recommended minus toggled-off, adds user handles, normalizes + dedupes", () => {
    const out = curatedSeedHandles({
      recommended: ["@Alice", "@Bob", "@Carol"],
      toggledOff: ["@bob"],
      added: ["@Dave", "alice"],
    });
    expect(out).toEqual(["alice", "carol", "dave"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/setup-logic.test.ts`
Expected: FAIL — cannot find module `@/lib/setup-logic`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/setup-logic.ts
import type { InterviewAnswers } from "@/server/persona";
import type { SetupAnswers } from "@/lib/setup-steps";

const GOAL_TO_NORTHSTAR: Record<string, string> = {
  followers: "grow followers",
  reach: "grow reach / impressions",
  leads: "generate inbound leads / clients",
  authority: "build authority in the niche",
};

export function normHandle(h: string): string {
  return h.trim().replace(/^@+/, "").toLowerCase();
}

export function answersToInterview(a: SetupAnswers): InterviewAnswers {
  const goal = a.goalOpen?.trim() || GOAL_TO_NORTHSTAR[a.goal] || a.goal;
  return {
    niche: a.pillars.join(", "),
    goals: goal,
    tone: a.voiceMethod === "tags" ? a.voiceTags.join(", ") : "",
    northStarMetric: goal,
    premiumAccount: a.premium,
  };
}

export function needsSetup(
  p: { voice_spec?: string | null; content_pillars?: string[] | null } | null | undefined,
): boolean {
  if (!p) return true;
  const hasVoice = !!(p.voice_spec && p.voice_spec.trim());
  const hasPillars = Array.isArray(p.content_pillars) && p.content_pillars.length > 0;
  return !(hasVoice && hasPillars);
}

export function curatedSeedHandles(opts: {
  recommended: string[];
  toggledOff: string[];
  added: string[];
}): string[] {
  const off = new Set(opts.toggledOff.map(normHandle));
  const kept = opts.recommended.map(normHandle).filter((h) => h && !off.has(h));
  const added = opts.added.map(normHandle).filter(Boolean);
  return [...new Set([...kept, ...added])];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/setup-logic.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/setup-logic.ts src/lib/setup-logic.test.ts
git commit -m "$(printf 'feat(onboarding): pure transforms for setup answers\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: Voice-pull server action

**Files:**
- Create: `src/server/voice-pull.ts`
- Test: `src/server/voice-pull.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/voice-pull.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import type { ApifyLike } from "@/lib/apify";
import { pullOwnVoiceCorpus } from "@/server/voice-pull";

function fakeClient(items: unknown[]): ApifyLike {
  return {
    actor: () => ({ call: vi.fn().mockResolvedValue({ defaultDatasetId: "ds1" }) }),
    dataset: () => ({ listItems: vi.fn().mockResolvedValue({ items }) }),
  } as unknown as ApifyLike;
}

afterEach(() => { delete process.env.APIFY_TOKEN; });

describe("pullOwnVoiceCorpus", () => {
  it("maps pulled tweets to a trimmed, non-empty text corpus", async () => {
    process.env.APIFY_TOKEN = "tok";
    const client = fakeClient([
      { id: "1", text: " first post ", author: { userName: "me" } },
      { id: "2", text: "", author: { userName: "me" } },
      { id: "3", text: "second", author: { userName: "me" } },
    ]);
    const corpus = await pullOwnVoiceCorpus("@me", client);
    expect(corpus).toEqual(["first post", "second"]);
  });

  it("throws a typed unavailable error when APIFY_TOKEN is not set", async () => {
    await expect(pullOwnVoiceCorpus("@me", fakeClient([]))).rejects.toThrow(/APIFY_TOKEN/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/voice-pull.test.ts`
Expected: FAIL — cannot find module `@/server/voice-pull`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/voice-pull.ts
"use server";
import { makeApify, pullTweets, type ApifyLike } from "@/lib/apify";

/**
 * Pull the user's own recent posts to seed their voice corpus (zero-typing path).
 * `client` is injectable for tests; in production it defaults to makeApify().
 */
export async function pullOwnVoiceCorpus(handle: string, client?: ApifyLike): Promise<string[]> {
  if (!process.env.APIFY_TOKEN) {
    throw new Error("voice-pull unavailable: APIFY_TOKEN not set");
  }
  const actor = process.env.APIFY_TWEET_SCRAPER_ACTOR ?? "apidojo/tweet-scraper";
  const rows = await pullTweets(client ?? makeApify(), actor, { handles: [handle], maxPerHandle: 30 });
  return rows
    .map((r) => r.tweet_text.trim())
    .filter(Boolean)
    .slice(0, 30);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/voice-pull.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/voice-pull.ts src/server/voice-pull.test.ts
git commit -m "$(printf 'feat(onboarding): pullOwnVoiceCorpus via Apify\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: Extract `recommendTargets` from `generateTargetQueue`

**Files:**
- Modify: `src/server/target-queue.ts`
- Test: `src/server/target-queue.test.ts` (create)

Rationale: onboarding must recommend accounts from answer-derived pillars **before** anything is persisted, so we can't depend on `generateTargetQueue(profileId)` reading the DB. Extract the prompt+generate core into `recommendTargets(input)`; keep `generateTargetQueue` as a thin DB wrapper so existing callers and behavior are unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/target-queue.test.ts
import { describe, it, expect, vi } from "vitest";

const generateStructured = vi.fn();
vi.mock("@/lib/generate", () => ({ generateStructured: (...a: unknown[]) => generateStructured(...a) }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));

import { recommendTargets } from "@/server/target-queue";

describe("recommendTargets", () => {
  it("returns the model's target queue", async () => {
    generateStructured.mockResolvedValueOnce({
      data: { targets: [{ handle: "@a", reason: "r", priority: "high", suggested_approach: "x" }], generatedAt: "now" },
    });
    const q = await recommendTargets({ existingHandles: [], contentPillars: ["AI"], northStarMetric: "grow", date: "May 31, 2026" });
    expect(q.targets[0].handle).toBe("@a");
    expect(generateStructured).toHaveBeenCalledOnce();
  });

  it("throws when the model returns no data", async () => {
    generateStructured.mockResolvedValueOnce({ data: null });
    await expect(
      recommendTargets({ existingHandles: [], contentPillars: ["AI"], northStarMetric: null, date: "May 31, 2026" }),
    ).rejects.toThrow(/target queue/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/target-queue.test.ts`
Expected: FAIL — `recommendTargets` is not exported.

- [ ] **Step 3: Edit `src/server/target-queue.ts`**

Replace the whole file with:

```ts
"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { TargetQueue } from "@/lib/schemas";
import { buildTargetFinderPrompt } from "@/lib/voice-prompt";

function today(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Core: recommend accounts from pillars + north-star, no DB access. */
export async function recommendTargets(input: {
  existingHandles: string[];
  contentPillars: string[];
  northStarMetric: string | null;
  date?: string;
}): Promise<TargetQueue> {
  const r = await generateStructured(
    TargetQueue,
    buildTargetFinderPrompt(input.existingHandles, input.contentPillars, input.northStarMetric, input.date ?? today()),
    { research: true },
  );
  if (!r.data) throw new Error("could not generate target queue — try again");
  return r.data;
}

/** Thin wrapper: read pillars/north-star + existing handles for a profile, then recommend. */
export async function generateTargetQueue(profileId: string): Promise<TargetQueue> {
  const sb = await supabaseServer();
  const { data: profile, error } = await sb
    .from("profiles")
    .select("handle, content_pillars, north_star_metric")
    .eq("id", profileId)
    .single();
  if (error || !profile) throw new Error("profile not found");

  const { data: seedRows } = await sb
    .from("seed_targets")
    .select("handle")
    .eq("profile_id", profileId)
    .eq("active", true)
    .limit(20);

  const existingHandles = (seedRows ?? []).map((r) => r.handle).filter(Boolean) as string[];
  return recommendTargets({
    existingHandles,
    contentPillars: profile.content_pillars as string[],
    northStarMetric: profile.north_star_metric ?? null,
  });
}
```

- [ ] **Step 4: Run tests to verify pass (new + any existing callers)**

Run: `npx vitest run src/server/target-queue.test.ts`
Expected: PASS (2 tests).
Run: `npx vitest run` (full suite) — confirm nothing that imported `generateTargetQueue` broke.
Expected: PASS (same count as before + the 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/server/target-queue.ts src/server/target-queue.test.ts
git commit -m "$(printf 'refactor(targets): extract recommendTargets core from generateTargetQueue\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: Setup orchestration server actions

**Files:**
- Create: `src/server/setup.ts`
- Test: `src/server/setup.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/setup.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const synthesizePersona = vi.fn();
const savePersona = vi.fn();
const recommendTargets = vi.fn();
const updateEq = vi.fn().mockResolvedValue({ error: null });
const fromUpdate = vi.fn(() => ({ update: () => ({ eq: updateEq }) }));

vi.mock("@/server/persona", () => ({
  synthesizePersona: (...a: unknown[]) => synthesizePersona(...a),
  savePersona: (...a: unknown[]) => savePersona(...a),
}));
vi.mock("@/server/target-queue", () => ({ recommendTargets: (...a: unknown[]) => recommendTargets(...a) }));
vi.mock("@/lib/supabase/server", () => ({ supabaseService: () => ({ from: fromUpdate }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { buildSetupPreview, finalizeSetup } from "@/server/setup";
import { EMPTY_ANSWERS } from "@/lib/setup-steps";

const answers = {
  ...EMPTY_ANSWERS,
  handle: "@fcisco95", accountSize: "<500", premium: true,
  pillars: ["AI agents"], goal: "followers", capacity: "30m",
  voiceMethod: "pull" as const, voiceCorpus: ["my post one", "my post two"],
};

beforeEach(() => {
  synthesizePersona.mockReset();
  savePersona.mockReset();
  recommendTargets.mockReset();
});

describe("buildSetupPreview", () => {
  it("synthesizes the persona and recommends targets from synthesized pillars", async () => {
    synthesizePersona.mockResolvedValueOnce({ voiceSpec: "punchy", contentPillars: ["AI agents", "agents"], seedAccounts: [], samplePosts: [] });
    recommendTargets.mockResolvedValueOnce({ targets: [{ handle: "@a", reason: "r", priority: "high", suggested_approach: "x" }], generatedAt: "now" });

    const out = await buildSetupPreview(answers);
    expect(out.synth.voiceSpec).toBe("punchy");
    expect(out.targets.targets[0].handle).toBe("@a");
    expect(recommendTargets).toHaveBeenCalledWith(
      expect.objectContaining({ contentPillars: ["AI agents", "agents"], northStarMetric: "grow followers" }),
    );
  });

  it("returns empty targets (does not throw) when recommendation fails", async () => {
    synthesizePersona.mockResolvedValueOnce({ voiceSpec: "v", contentPillars: ["AI"], seedAccounts: [], samplePosts: [] });
    recommendTargets.mockRejectedValueOnce(new Error("model down"));
    const out = await buildSetupPreview(answers);
    expect(out.targets.targets).toEqual([]);
  });
});

describe("finalizeSetup", () => {
  it("updates profile basics then saves persona with curated handles", async () => {
    await finalizeSetup("p-1", {
      answers,
      voiceSpec: "punchy",
      contentPillars: ["AI agents"],
      seedHandles: ["alice", "bob"],
    });

    expect(fromUpdate).toHaveBeenCalledWith("profiles");
    expect(updateEq).toHaveBeenCalledWith("id", "p-1");
    expect(savePersona).toHaveBeenCalledWith("p-1", expect.objectContaining({
      voiceSpec: "punchy",
      contentPillars: ["AI agents"],
      seedAccounts: ["alice", "bob"],
      premiumAccount: true,
      northStarMetric: "grow followers",
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/setup.test.ts`
Expected: FAIL — cannot find module `@/server/setup`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/setup.ts
"use server";
import { supabaseService } from "@/lib/supabase/server";
import { synthesizePersona, savePersona } from "@/server/persona";
import { recommendTargets } from "@/server/target-queue";
import { answersToInterview, normHandle } from "@/lib/setup-logic";
import type { SetupAnswers } from "@/lib/setup-steps";
import type { PersonaSynthesis, TargetQueue } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

export async function getSetupProfileId(): Promise<string> {
  const fixed = process.env.FIXED_PROFILE_ID;
  if (fixed) return fixed;
  const sb = supabaseService();
  const { data } = await sb.from("profiles").select("id").order("created_at").limit(1).maybeSingle();
  if (data?.id) return data.id;
  const { data: created, error } = await sb
    .from("profiles")
    .insert({ handle: "new-account", voice_corpus: [] })
    .select("id")
    .single();
  if (error || !created) throw new Error("could not create a profile for setup");
  return created.id;
}

export interface SetupPreview {
  synth: PersonaSynthesis;
  targets: TargetQueue;
}

export async function buildSetupPreview(a: SetupAnswers): Promise<SetupPreview> {
  const interview = answersToInterview(a);
  const synth = await synthesizePersona(interview);
  let targets: TargetQueue = { targets: [], generatedAt: "" };
  try {
    targets = await recommendTargets({
      existingHandles: [],
      contentPillars: synth.contentPillars,
      northStarMetric: interview.northStarMetric ?? null,
    });
  } catch {
    // recommendations are best-effort; setup must proceed without them
  }
  return { synth, targets };
}

export async function finalizeSetup(
  profileId: string,
  payload: { answers: SetupAnswers; voiceSpec: string; contentPillars: string[]; seedHandles: string[] },
): Promise<void> {
  const a = payload.answers;
  const interview = answersToInterview(a);

  const sb = supabaseService();
  const { error: upErr } = await sb
    .from("profiles")
    .update({
      handle: normHandle(a.handle),
      niche_description: a.pillars.join(", "),
      voice_corpus: a.voiceCorpus ?? [],
      voice_notes: a.voiceMethod === "tags" ? a.voiceTags.join(", ") : "",
    })
    .eq("id", profileId);
  if (upErr) throw new Error(upErr.message);

  await savePersona(profileId, {
    voiceSpec: payload.voiceSpec,
    goals: interview.goals,
    contentPillars: payload.contentPillars,
    answers: interview,
    seedAccounts: payload.seedHandles,
    northStarMetric: interview.northStarMetric,
    premiumAccount: a.premium,
  });

  revalidatePath("/");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/setup.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/setup.ts src/server/setup.test.ts
git commit -m "$(printf 'feat(onboarding): setup orchestration server actions\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 6: SetupQuiz client component

**Files:**
- Create: `src/components/setup-quiz.tsx`

No unit test (the repo has no component-test infra; all logic is already unit-tested in Tasks 2/5). Verify via typecheck/build in Task 9. Keep the component thin — it only renders `STEPS`, holds `SetupAnswers`, and calls the server actions.

- [ ] **Step 1: Write the component**

```tsx
// src/components/setup-quiz.tsx
"use client";
import { useState } from "react";
import { STEPS, EMPTY_ANSWERS, type SetupAnswers, type StepDef } from "@/lib/setup-steps";
import { curatedSeedHandles } from "@/lib/setup-logic";
import { buildSetupPreview, finalizeSetup, type SetupPreview } from "@/server/setup";
import { pullOwnVoiceCorpus } from "@/server/voice-pull";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Phase = "questions" | "building" | "review" | "saving";

export function SetupQuiz({ profileId, onDone }: { profileId: string; onDone?: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<SetupAnswers>(EMPTY_ANSWERS);
  const [phase, setPhase] = useState<Phase>("questions");
  const [preview, setPreview] = useState<SetupPreview | null>(null);
  const [voiceSpec, setVoiceSpec] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState("");

  const step = STEPS[stepIndex];
  const total = STEPS.length;
  const set = (patch: Partial<SetupAnswers>) => setAnswers((a) => ({ ...a, ...patch }));

  function valueFor(s: StepDef): unknown {
    return (answers as Record<string, unknown>)[s.id];
  }
  function stepComplete(s: StepDef): boolean {
    if (!s.required) return true;
    const v = valueFor(s);
    if (s.id === "pillars") return answers.pillars.length > 0;
    if (s.id === "premium") return typeof answers.premium === "boolean";
    return typeof v === "string" ? v.trim().length > 0 : Boolean(v);
  }

  async function next() {
    if (stepIndex < total - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    // Last question answered → build preview.
    setPhase("building");
    try {
      if (answers.voiceMethod === "pull" && answers.handle.trim()) {
        try {
          const corpus = await pullOwnVoiceCorpus(answers.handle);
          set({ voiceCorpus: corpus });
        } catch {
          toast.message("Couldn't pull your posts — describe your voice with tags instead.");
        }
      }
      const p = await buildSetupPreview(answers);
      setPreview(p);
      setVoiceSpec(p.synth.voiceSpec);
      setPhase("review");
    } catch (e) {
      toast.error(String(e));
      setPhase("questions");
    }
  }

  async function finish() {
    if (!preview) return;
    setPhase("saving");
    const recommended = preview.targets.targets.map((t) => t.handle);
    const seedHandles = curatedSeedHandles({
      recommended,
      toggledOff: [...off],
      added: added.split(",").map((s) => s.trim()).filter(Boolean),
    });
    try {
      await finalizeSetup(profileId, {
        answers,
        voiceSpec,
        contentPillars: preview.synth.contentPillars,
        seedHandles,
      });
      toast.success("Account is set up");
      onDone?.();
      window.location.href = "/";
    } catch (e) {
      toast.error(String(e));
      setPhase("review");
    }
  }

  // ---- Render ----
  const progress = phase === "questions" ? (stepIndex + 1) / total : 1;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-10">
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
      </div>

      {phase === "questions" && (
        <div className="space-y-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Step {stepIndex + 1} of {total}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{step.question}</h1>
          <p className="text-sm text-muted-foreground">{step.explanation}</p>

          {step.kind === "text" && (
            <Input
              autoFocus
              placeholder="@yourhandle"
              value={answers.handle}
              onChange={(e) => set({ handle: e.target.value })}
            />
          )}

          {step.kind === "toggle" && (
            <div className="flex gap-2">
              {step.options!.map((o) => (
                <Button
                  key={o.value}
                  variant={(answers.premium ? "yes" : "no") === o.value ? "default" : "outline"}
                  onClick={() => set({ premium: o.value === "yes" })}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          )}

          {step.kind === "single" && (
            <div className="flex flex-col gap-2">
              {step.options!.map((o) => {
                const selected = (answers as Record<string, unknown>)[step.id] === o.value;
                return (
                  <Button
                    key={o.value}
                    variant={selected ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => set({ [step.id]: o.value } as Partial<SetupAnswers>)}
                  >
                    {o.label}
                  </Button>
                );
              })}
              {step.allowOpenText && step.id === "goal" && (
                <Input
                  placeholder="Or describe your goal…"
                  value={answers.goalOpen ?? ""}
                  onChange={(e) => set({ goalOpen: e.target.value })}
                />
              )}
              {step.id === "voiceMethod" && answers.voiceMethod === "paste" && (
                <Textarea
                  rows={5}
                  placeholder="Paste a few of your best posts, one per line"
                  onChange={(e) => set({ voiceCorpus: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                />
              )}
              {step.id === "voiceMethod" && answers.voiceMethod === "tags" && (
                <Input
                  placeholder="Tone tags, comma-separated (punchy, lowercase, technical)"
                  onChange={(e) => set({ voiceTags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              )}
            </div>
          )}

          {step.kind === "chips" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {step.options!.map((o) => {
                  const on = answers.pillars.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() =>
                        set({
                          pillars: on
                            ? answers.pillars.filter((p) => p !== o.value)
                            : [...answers.pillars, o.value],
                        })
                      }
                      className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {step.allowOpenText && (
                <Input
                  placeholder="Add your own, comma-separated"
                  onChange={(e) =>
                    set({
                      pillars: [
                        ...step.options!.map((o) => o.value).filter((v) => answers.pillars.includes(v)),
                        ...e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      ],
                    })
                  }
                />
              )}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="ghost" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)}>
              Back
            </Button>
            <Button disabled={!stepComplete(step)} onClick={next}>
              {stepIndex === total - 1 ? "Build my account" : "Next"}
            </Button>
          </div>
        </div>
      )}

      {phase === "building" && (
        <div className="py-20 text-center text-muted-foreground">
          Analyzing your voice and finding accounts to follow…
        </div>
      )}

      {phase === "review" && preview && (
        <div className="space-y-5">
          <h1 className="text-2xl font-bold tracking-tight">Review your account</h1>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Your voice</div>
            <Textarea rows={5} value={voiceSpec} onChange={(e) => setVoiceSpec(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Accounts I recommend watching — toggle off any that don&apos;t fit
            </div>
            {preview.targets.targets.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No recommendations right now — add accounts below, or do it later from the board.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {preview.targets.targets.map((t) => {
                const isOff = off.has(t.handle.toLowerCase());
                return (
                  <button
                    key={t.handle}
                    type="button"
                    onClick={() =>
                      setOff((prev) => {
                        const n = new Set(prev);
                        const k = t.handle.toLowerCase();
                        n.has(k) ? n.delete(k) : n.add(k);
                        return n;
                      })
                    }
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${isOff ? "opacity-40" : "border-primary"}`}
                  >
                    <div className="font-semibold">{t.handle}</div>
                    <div className="text-xs text-muted-foreground">{t.reason}</div>
                  </button>
                );
              })}
            </div>
            <Input
              placeholder="Add accounts you already know, comma-separated"
              value={added}
              onChange={(e) => setAdded(e.target.value)}
            />
          </div>
          <Button onClick={finish}>Finish setup</Button>
        </div>
      )}

      {phase === "saving" && <div className="py-20 text-center text-muted-foreground">Saving…</div>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck the component**

Run: `npx tsc --noEmit`
Expected: no errors in `setup-quiz.tsx`. If `Button` has no matching `variant` union member you used, switch the toggle/selected styling to `variant={selected ? "default" : "outline"}` only (already used) — do not invent variants.

- [ ] **Step 3: Commit**

```bash
git add src/components/setup-quiz.tsx
git commit -m "$(printf 'feat(onboarding): SetupQuiz client step-machine\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 7: `/setup` takeover route

**Files:**
- Create: `src/app/setup/page.tsx`

Placed at `src/app/setup/` (NOT inside `(app)/`) so it renders without the app nav/sidebar — a true takeover.

- [ ] **Step 1: Write the route**

```tsx
// src/app/setup/page.tsx
import { getSetupProfileId } from "@/server/setup";
import { SetupQuiz } from "@/components/setup-quiz";

export const metadata = { title: "Set up your account" };

export default async function SetupPage() {
  const profileId = await getSetupProfileId();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SetupQuiz profileId={profileId} />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/setup/page.tsx
git commit -m "$(printf 'feat(onboarding): /setup takeover route\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 8: Redirect empty accounts into `/setup`

**Files:**
- Modify: `src/app/(app)/page.tsx` (the dashboard, lines 43-57 region)

- [ ] **Step 1: Add the redirect using `needsSetup`**

At the top of `src/app/(app)/page.tsx`, add imports:

```tsx
import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/setup-logic";
```

Then inside `DashboardPage`, in the existing `try` block where the profile is fetched (currently lines 47-54), replace:

```tsx
    const profiles = await listProfiles()
    const profile = profiles?.[0]
    if (profile?.handle) handle = profile.handle.startsWith("@") ? profile.handle : `@${profile.handle}`
    if (profile?.id) {
      pending = await listPendingDrafts(profile.id)
      data = await getDashboardData(profile.id)
    }
```

with:

```tsx
    const profiles = await listProfiles()
    const profile = profiles?.[0]
    if (needsSetup(profile)) redirect("/setup")
    if (profile?.handle) handle = profile.handle.startsWith("@") ? profile.handle : `@${profile.handle}`
    if (profile?.id) {
      pending = await listPendingDrafts(profile.id)
      data = await getDashboardData(profile.id)
    }
```

Note: `redirect()` throws internally; it must NOT be swallowed by the surrounding `catch`. Next.js's `redirect` throws a special `NEXT_REDIRECT` error. Re-throw it from the catch. Update the catch block (currently lines 55-57):

```tsx
  } catch (e) {
    // Let Next.js redirects propagate; only swallow real DB errors.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e
    }
    // Render with empty states if the DB is unavailable.
  }
```

- [ ] **Step 2: Typecheck + full test suite**

Run: `npx tsc --noEmit`
Expected: no new errors.
Run: `npx vitest run`
Expected: all green (prior count + new tests; 1 skipped RLS).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "$(printf 'feat(onboarding): redirect empty accounts to /setup\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 9: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all pass, 1 skipped (`rls.test.ts`). Do NOT set `RUN_RLS_INTEGRATION=1` (writes to production).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: green; `/setup` appears in the route list.

- [ ] **Step 3: Manual smoke (optional, needs `npm run dev`)**

- `npm run dev`, open `http://localhost:3000` → with the current empty `fcisco95` profile you should be redirected to `/setup`.
- Tap through the 7 steps. On "Build my account", the voice spec + recommended accounts appear (recommendations require `OPENAI_API_KEY`/`claude`; without them the review still renders with an empty recommendation list and a manual-add field).
- "Finish setup" → returns to `/`, which now loads the dashboard (no redirect) because `voice_spec` + `content_pillars` are set.
- This run is also what produces the real `voice_spec` + `seed_targets` that unblock piece **A** (make Pulse real).

- [ ] **Step 4: Final commit (if any docs/notes changed)**

```bash
git status
# Only if there are stray tracked changes you own:
git commit -am "$(printf 'chore(onboarding): finalize setup flow\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:**
- Takeover, one-question-per-screen, progress bar → Task 6 (component) + Task 7 (route outside `(app)`). ✓
- Tap-first + open-text affordance → `STEPS` `allowOpenText` (Task 1) + chips/single/toggle rendering + open-text inputs (Task 6). ✓
- 7 questions mapped to DB columns → `STEPS` (Task 1), `answersToInterview` + `finalizeSetup` writes (Tasks 2, 5). ✓
- Auto-learn voice by pulling posts → Task 3 + wired in Task 6 `next()`. ✓
- App recommends who to follow → `recommendTargets` (Task 4) + `buildSetupPreview` (Task 5) + review toggles (Task 6). ✓
- Persist `voice_spec` + `seed_targets` → `finalizeSetup` (Task 5). ✓
- Empty-account trigger → `needsSetup` (Task 2) + redirect (Task 8). ✓
- No migration → all writes target existing columns; `account_size`/`capacity` go into `onboarding_answers` via the interview answers JSON. ✓
- Graceful fallback when integrations down → `buildSetupPreview` swallows recommend errors; voice-pull failure falls back to tags/paste (Task 6); empty recommendation list still completes. ✓
- Testing strategy (pure functions, mocked actions) → Tasks 1,2,3,4,5. ✓

**Note on `onboarding_answers`:** `savePersona` already persists the `InterviewAnswers` object to `onboarding_answers`. To also retain the raw `account_size`/`capacity` buckets verbatim, an optional enhancement is to widen `InterviewAnswers` — deferred as a §9 open question in the spec; not required for the acceptance criteria (non-empty `voice_spec` + ≥1 `seed_target`).

**Placeholder scan:** no TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `SetupAnswers`/`StepDef` (Task 1) used identically in Tasks 2/5/6; `buildSetupPreview`/`finalizeSetup`/`SetupPreview` signatures match between Task 5 and Task 6; `recommendTargets` input shape matches between Tasks 4 and 5. ✓
