# Quiz Redesign — Chaptered, Archetype-Branched Setup (Implementation Plan, Plan C1 of "C")

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 7-step setup form with a **chaptered, archetype-branched** quiz — the control panel for the engagement engine — with Core/Optional questions, sectioned progress, reflective interstitials, and an animated "crafting your growth plan" climax; and fix the `goalOpen` "Next"-disabled bug along the way.

**Architecture:** Push all decision logic into **pure, unit-tested functions** in `setup-steps.ts` / `setup-logic.ts` (the chaptered step config, `activeSteps(archetype)` structural branching, a corrected pure `stepComplete(step, answers)`, `interstitialFor(...)`, and an extended `answersToInterview`). Then rebuild the `setup-quiz.tsx` client component around those functions, reusing the existing `buildSetupPreview` → review → `finalizeSetup` server flow unchanged. New answers ride in the `onboarding_answers` jsonb (no migration); the only persisted new column is `reply_playbook`, whose column already exists from Plan A.

**Tech Stack:** TypeScript, Vitest (`npm test` = `vitest run`), React client component (`"use client"`), Next.js App Router, Tailwind + the Dispatch design system (`Button`/`Input`/`Textarea`/`Card`), `@/` path alias → `src/`.

**Depends on:** **Plan A executed** — it adds the `account_size`, `daily_capacity`, `reply_playbook` columns to `profiles` and persists `account_size`/`daily_capacity` in `finalizeSetup` (Plan A Task 7). This plan adds `reply_playbook` persistence on top. If Plan A is NOT yet executed, do its Task 2 (the `0007_engagement_knobs.sql` migration + `types.ts` columns) **before** Task 7 of this plan, or the `reply_playbook` write will fail.

**Scope (C1):** the redesigned quiz UI + branching + Core/Optional + interstitials + crafting animation + the `goalOpen` fix + persisting the richer answer set. **Out (C2):** the **Growth Plan artifact** (its schema, the dedicated LLM synthesis call, the reveal screen, the dashboard card). C1's climax lands on the **existing** review (curate-targets) screen; C2 inserts the Growth Plan reveal and the dashboard surface. **Out (Plan A/B):** the engine + the Scan→Engage / Create-a-Post flows.

**Spec:** `docs/superpowers/specs/2026-06-01-engagement-engine-and-quiz-design.md` (§5 the quiz). **Validated mockups (gitignored, prose-described in spec §5):** `.superpowers/brainstorm/1109-1780263240/content/storyboard.html`, `.../1285-1780311956/content/{welcome,engine-reframe,crafting-moment}.html`, `.../1109-1780263240/content/layout-options-v2.html` (layout **A · full-screen** chosen — the current `/setup` takeover route).

**Owner decisions folded in (this session):** (1) C is split into C1 (this) + C2; (2) the Growth Plan is a **dedicated LLM call** — lives entirely in C2; (3) **structural** archetype branching — `activeSteps(archetype)` filters steps via `showFor`, and `optionsByArchetype` tailors option presets.

---

## The archetype + answer contract (locked before tasks — C2 consumes this verbatim)

Five archetypes (keystone answer, drives branching + engine knobs + plan copy):

```typescript
export type Archetype = "dev" | "founder" | "creator" | "trader" | "protocol";
```

Seven chapters (sectioned progress; spec §5):

```typescript
export type ChapterId = "you" | "goal" | "niche" | "channels" | "voice" | "inspirations" | "rhythm";
```

The extended `SetupAnswers` (new fields beyond today's `handle/accountSize/premium/pillars/goal/goalOpen/capacity/voiceMethod/voiceCorpus/voiceTags`). **Core** = `required`; **Optional** = `optional` (skippable):

| Field | Chapter | Kind | Core/Opt | Notes |
|-------|---------|------|----------|-------|
| `archetype` | you | single | Core | keystone; branches the rest |
| `zoneOfGenius` | you | longtext | Opt | "where you're 10× better" |
| `motive` | you | longtext | Opt | why you're really doing this |
| `handle` | you | text | Core | identity + voice pull |
| `goal` | goal | single (+open) | Core | the `goalOpen` bug lives here |
| `goalTarget` | goal | text | Core | the 90-day number/metric (plan north-star) |
| `accountSize` | goal | single | Core | stage → 5–20× band |
| `intensity` | goal | single | Opt | how hard you'll push |
| `pillars` | niche | chips (+open) | Core | content pillars |
| `angle` | niche | longtext | Core | why-follow-YOU (plan "Your edge") |
| `audience` | niche | text | Opt | who you serve |
| `platforms` | channels | chips | Core | X acts; others stored |
| `premium` | channels | toggle | Core | algorithm rules |
| `formats` | channels | chips | Core | post types you'll make |
| `showFace` | channels | toggle | Opt | willing to show face |
| `creativeTools` | channels | taglist | Opt | can you make visuals / use AI |
| `advantages` | channels | longtext | Opt | unfair advantages |
| `voiceMethod` | voice | single (+conditional) | Core | pull/paste/tags |
| `voiceCorpus` | voice | (derived) | — | pulled/pasted posts |
| `voiceTags` | voice | (derived) | — | tone tags |
| `replyPlaybook` | voice | longtext | Opt | never-do guardrails (first-class; persisted to its column) |
| `inspirations` | inspirations | taglist | Core | accounts to grow like → seed_targets + voice modeling |
| `engageNow` | inspirations | taglist | Opt | who to engage now |
| `capacity` | rhythm | single | Core | time/day → cadence |
| `consistency` | rhythm | single | Opt | how consistent you've been |
| `commitment` | rhythm | single | Opt | "show up on slow days?" |

Plus one **archetype-specific Optional** question per archetype (structural branching via `showFor`), in the `you` chapter after `zoneOfGenius`:

| id | showFor | question |
|----|---------|----------|
| `buildingNow` | `["dev"]` | "What are you building right now?" |
| `companyDoes` | `["founder"]` | "What does your company do?" |
| `bestFormat` | `["creator"]` | "What format is your bread and butter?" |
| `edgeTrack` | `["trader"]` | "What's your edge or track record?" |
| `projectStage` | `["protocol"]` | "What stage is the project / protocol?" |

These five share one answer field `archetypeDetail` (only one is ever shown). Count: ~13 Core + ~10 Optional across 7 chapters (matches spec §11 "~10 Core + ~9 Optional").

`InterviewAnswers` (persona.ts) gains optional fields so the richer answers persist into `onboarding_answers` jsonb: `archetype`, `archetypeDetail`, `angle`, `zoneOfGenius`, `platforms`, `formats`, `motive`, `replyPlaybook`, `inspirations`.

---

## File structure (locked before tasks)

- Modify `src/lib/setup-steps.ts` — add `Archetype`, `ChapterId`, `CHAPTERS`, the extended `StepKind`/`SetupFieldId`/`StepDef`/`SetupAnswers`/`EMPTY_ANSWERS`, the new chaptered `STEPS` array, and pure `activeSteps(archetype)`.
- Create `src/lib/setup-steps.test.ts` — config integrity + `activeSteps` branching.
- Modify `src/lib/setup-logic.ts` — add pure `stepComplete(step, answers)` (with the `goalOpen` fix), `interstitialFor(chapterId, answers)`, and extend `answersToInterview`.
- Modify `src/lib/setup-logic.test.ts` — `stepComplete` (incl. `goalOpen`), `interstitialFor`, extended `answersToInterview`. (Create the file if it doesn't exist.)
- Modify `src/server/persona.ts` — extend the `InterviewAnswers` interface (optional fields only).
- Modify `src/server/setup.ts` — persist `reply_playbook` in `finalizeSetup`; feed `inspirations` into seed handles.
- Modify `src/components/setup-quiz.tsx` — rebuild around `activeSteps` + pure `stepComplete`: chaptered progress, generic kind rendering, interstitials, the crafting-moment animation. Review/finalize flow preserved.

---

## Task 1: Extend the step config + archetype branching (pure)

**Files:**
- Modify: `src/lib/setup-steps.ts`
- Create: `src/lib/setup-steps.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/setup-steps.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { STEPS, CHAPTERS, activeSteps, EMPTY_ANSWERS, type Archetype } from "@/lib/setup-steps";

describe("step config integrity", () => {
  it("every step belongs to a known chapter", () => {
    const ids = new Set(CHAPTERS.map((c) => c.id));
    for (const s of STEPS) expect(ids.has(s.chapter)).toBe(true);
  });

  it("has the keystone archetype step first and required", () => {
    expect(STEPS[0].id).toBe("archetype");
    expect(STEPS[0].required).toBe(true);
  });

  it("EMPTY_ANSWERS has every required array field initialized", () => {
    expect(EMPTY_ANSWERS.pillars).toEqual([]);
    expect(EMPTY_ANSWERS.platforms).toEqual([]);
    expect(EMPTY_ANSWERS.formats).toEqual([]);
    expect(EMPTY_ANSWERS.inspirations).toEqual([]);
    expect(EMPTY_ANSWERS.archetype).toBe("");
  });
});

describe("activeSteps — structural archetype branching", () => {
  it("shows only the matching archetype-specific detail step", () => {
    const dev = activeSteps("dev").map((s) => s.id);
    expect(dev).toContain("archetypeDetail");
    // the dev-only detail step is present exactly once
    const detailSteps = activeSteps("dev").filter((s) => s.id === "archetypeDetail");
    expect(detailSteps).toHaveLength(1);
    expect(detailSteps[0].showFor).toContain("dev");
  });

  it("a founder sees a different archetypeDetail step than a dev", () => {
    const devDetail = activeSteps("dev").find((s) => s.id === "archetypeDetail");
    const founderDetail = activeSteps("founder").find((s) => s.id === "archetypeDetail");
    expect(devDetail?.question).not.toBe(founderDetail?.question);
  });

  it("an unset archetype hides all archetype-specific steps", () => {
    const none = activeSteps("").map((s) => s.id);
    expect(none).not.toContain("archetypeDetail");
  });

  it("Core (non-optional) steps are identical across archetypes", () => {
    const core = (a: Archetype | "") => activeSteps(a).filter((s) => s.required && !s.optional).map((s) => s.id);
    expect(core("dev")).toEqual(core("founder"));
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/setup-steps.test.ts`
Expected: FAIL — `activeSteps`/`CHAPTERS`/new fields don't exist.

- [ ] **Step 3: Implement** — replace the entire contents of `src/lib/setup-steps.ts` with:

```typescript
export type Archetype = "dev" | "founder" | "creator" | "trader" | "protocol";
export type ChapterId = "you" | "goal" | "niche" | "channels" | "voice" | "inspirations" | "rhythm";
export type StepKind = "text" | "longtext" | "single" | "chips" | "toggle" | "taglist";

export type SetupFieldId =
  | "archetype" | "zoneOfGenius" | "motive" | "archetypeDetail" | "handle"
  | "goal" | "goalTarget" | "accountSize" | "intensity"
  | "pillars" | "angle" | "audience"
  | "platforms" | "premium" | "formats" | "showFace" | "creativeTools" | "advantages"
  | "voiceMethod" | "replyPlaybook"
  | "inspirations" | "engageNow"
  | "capacity" | "consistency" | "commitment";

export interface StepOption { value: string; label: string }

export interface StepDef {
  id: SetupFieldId;
  chapter: ChapterId;
  question: string;
  explanation: string;
  kind: StepKind;
  options?: StepOption[];
  optionsByArchetype?: Partial<Record<Archetype, StepOption[]>>;
  allowOpenText?: boolean;
  required?: boolean;   // Core
  optional?: boolean;   // skippable
  showFor?: Archetype[]; // structural branching; omit = all archetypes
}

export interface SetupAnswers {
  // you
  archetype: Archetype | "";
  zoneOfGenius: string;
  motive: string;
  archetypeDetail: string;
  handle: string;
  // goal
  goal: string;
  goalOpen?: string;
  goalTarget: string;
  accountSize: string;
  intensity: string;
  // niche
  pillars: string[];
  angle: string;
  audience: string;
  // channels
  platforms: string[];
  premium: boolean;
  formats: string[];
  showFace: boolean;
  creativeTools: string[];
  advantages: string;
  // voice
  voiceMethod: "pull" | "paste" | "tags";
  voiceCorpus: string[];
  voiceTags: string[];
  replyPlaybook: string;
  // inspirations
  inspirations: string[];
  engageNow: string[];
  // rhythm
  capacity: string;
  consistency: string;
  commitment: string;
}

export const EMPTY_ANSWERS: SetupAnswers = {
  archetype: "", zoneOfGenius: "", motive: "", archetypeDetail: "", handle: "",
  goal: "", goalOpen: "", goalTarget: "", accountSize: "", intensity: "",
  pillars: [], angle: "", audience: "",
  platforms: [], premium: false, formats: [], showFace: false, creativeTools: [], advantages: "",
  voiceMethod: "pull", voiceCorpus: [], voiceTags: [], replyPlaybook: "",
  inspirations: [], engageNow: [],
  capacity: "", consistency: "", commitment: "",
};

export const CHAPTERS: { id: ChapterId; label: string }[] = [
  { id: "you", label: "You" },
  { id: "goal", label: "Goal" },
  { id: "niche", label: "Niche & edge" },
  { id: "channels", label: "Channels" },
  { id: "voice", label: "Voice" },
  { id: "inspirations", label: "Inspirations" },
  { id: "rhythm", label: "Rhythm" },
];

const ARCHETYPE_OPTIONS: StepOption[] = [
  { value: "dev", label: "Developer / Builder" },
  { value: "founder", label: "Founder / Operator" },
  { value: "creator", label: "Creator / Educator" },
  { value: "trader", label: "Trader / Investor" },
  { value: "protocol", label: "Project / Protocol" },
];

const PILLARS_BY_ARCHETYPE: Partial<Record<Archetype, StepOption[]>> = {
  dev: [
    { value: "AI agents", label: "AI agents" },
    { value: "Dev tools", label: "Dev tools" },
    { value: "Building in public", label: "Building in public" },
    { value: "Infra", label: "Infra / systems" },
  ],
  founder: [
    { value: "Startups", label: "Startups" },
    { value: "Building in public", label: "Building in public" },
    { value: "Go-to-market", label: "Go-to-market" },
    { value: "Fundraising", label: "Fundraising" },
  ],
  creator: [
    { value: "Education", label: "Education" },
    { value: "Tutorials", label: "Tutorials" },
    { value: "Creator economy", label: "Creator economy" },
    { value: "Productivity", label: "Productivity" },
  ],
  trader: [
    { value: "Markets", label: "Markets" },
    { value: "Trading", label: "Trading" },
    { value: "Macro", label: "Macro" },
    { value: "DeFi", label: "DeFi" },
  ],
  protocol: [
    { value: "Protocol", label: "Protocol / product" },
    { value: "Ecosystem", label: "Ecosystem" },
    { value: "Governance", label: "Governance" },
    { value: "Onchain", label: "Onchain" },
  ],
};

export const STEPS: StepDef[] = [
  // ── Chapter: You ──
  {
    id: "archetype", chapter: "you", kind: "single", required: true,
    question: "Which of these is closest to you?",
    explanation: "This is the keystone — there's no universal growth formula, so I tailor everything to your type.",
    options: ARCHETYPE_OPTIONS,
  },
  {
    id: "zoneOfGenius", chapter: "you", kind: "longtext", optional: true,
    question: "Where are you 10× better than most?",
    explanation: "Your zone of genius — what I lean on when drafting in your voice. Skip if unsure.",
  },
  {
    id: "archetypeDetail", chapter: "you", kind: "text", optional: true, showFor: ["dev"],
    question: "What are you building right now?",
    explanation: "Grounds your replies in real, current work.",
  },
  {
    id: "archetypeDetail", chapter: "you", kind: "text", optional: true, showFor: ["founder"],
    question: "What does your company do?",
    explanation: "Grounds your replies in what you actually ship.",
  },
  {
    id: "archetypeDetail", chapter: "you", kind: "text", optional: true, showFor: ["creator"],
    question: "What format is your bread and butter?",
    explanation: "So I draft to the shape your audience already expects from you.",
  },
  {
    id: "archetypeDetail", chapter: "you", kind: "text", optional: true, showFor: ["trader"],
    question: "What's your edge or track record?",
    explanation: "What makes your take worth reading in a noisy market.",
  },
  {
    id: "archetypeDetail", chapter: "you", kind: "text", optional: true, showFor: ["protocol"],
    question: "What stage is the project / protocol?",
    explanation: "Pre-launch vs live changes who you should be engaging.",
  },
  {
    id: "motive", chapter: "you", kind: "longtext", optional: true,
    question: "Why are you really doing this?",
    explanation: "The honest reason. It keeps the plan pointed at what you actually want.",
  },
  {
    id: "handle", chapter: "you", kind: "text", required: true,
    question: "What's your X handle?",
    explanation: "So I can label your account and pull your recent posts to learn your voice.",
  },

  // ── Chapter: Goal ──
  {
    id: "goal", chapter: "goal", kind: "single", required: true, allowOpenText: true,
    question: "What's your main growth goal?",
    explanation: "I tailor scoring, reply objective, and framing to what you actually want.",
    options: [
      { value: "followers", label: "More followers" },
      { value: "reach", label: "More reach / impressions" },
      { value: "leads", label: "Inbound leads / clients" },
      { value: "authority", label: "Authority in my niche" },
    ],
  },
  {
    id: "goalTarget", chapter: "goal", kind: "text", required: true,
    question: "Your 90-day target — put a number on it.",
    explanation: "e.g. “2,000 engaged followers”. This becomes your north-star on the plan.",
  },
  {
    id: "accountSize", chapter: "goal", kind: "single", required: true,
    question: "How big is the account today?",
    explanation: "This calibrates the 5–20× band of accounts worth engaging and what goals are realistic.",
    options: [
      { value: "<500", label: "Just starting (under 500)" },
      { value: "500-5k", label: "500 – 5k" },
      { value: "5k-50k", label: "5k – 50k" },
      { value: "50k+", label: "50k+" },
    ],
  },
  {
    id: "intensity", chapter: "goal", kind: "single", optional: true,
    question: "How hard do you want to push?",
    explanation: "Sets how aggressive the cadence and targets are.",
    options: [
      { value: "steady", label: "Steady & sustainable" },
      { value: "ambitious", label: "Ambitious" },
      { value: "allin", label: "All-in sprint" },
    ],
  },

  // ── Chapter: Niche & edge ──
  {
    id: "pillars", chapter: "niche", kind: "chips", required: true, allowOpenText: true,
    question: "What do you post about?",
    explanation: "Your content pillars drive relevance scoring and account recommendations.",
    options: PILLARS_BY_ARCHETYPE.dev,
    optionsByArchetype: PILLARS_BY_ARCHETYPE,
  },
  {
    id: "angle", chapter: "niche", kind: "longtext", required: true,
    question: "Why should someone follow YOU and not the other accounts in your niche?",
    explanation: "Your edge. This is the sharpest input I have — it shapes every draft.",
  },
  {
    id: "audience", chapter: "niche", kind: "text", optional: true,
    question: "Who are you trying to reach?",
    explanation: "The people you want following you. Helps me pick the right accounts.",
  },

  // ── Chapter: Channels & superpowers ──
  {
    id: "platforms", chapter: "channels", kind: "chips", required: true,
    question: "Which platforms are you growing?",
    explanation: "X is active now; the others I capture for later.",
    options: [
      { value: "x", label: "X / Twitter" },
      { value: "linkedin", label: "LinkedIn" },
      { value: "youtube", label: "YouTube" },
    ],
  },
  {
    id: "premium", chapter: "channels", kind: "toggle", required: true,
    question: "Are you on X Premium?",
    explanation: "Premium changes the algorithm rules I write to (post length, reach weighting).",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
  },
  {
    id: "formats", chapter: "channels", kind: "chips", required: true,
    question: "What formats will you actually make?",
    explanation: "I only suggest post types you're willing to create.",
    options: [
      { value: "text", label: "Text posts" },
      { value: "threads", label: "Threads" },
      { value: "images", label: "Images / screenshots" },
      { value: "video", label: "Video" },
    ],
  },
  {
    id: "showFace", chapter: "channels", kind: "toggle", optional: true,
    question: "Willing to show your face?",
    explanation: "Affects which formats I lean on.",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
  },
  {
    id: "creativeTools", chapter: "channels", kind: "taglist", optional: true,
    question: "Can you make visuals / use AI tools?",
    explanation: "List what you've got (Figma, Midjourney, none…). Comma-separated.",
  },
  {
    id: "advantages", chapter: "channels", kind: "longtext", optional: true,
    question: "Any unfair advantages?",
    explanation: "Audiences elsewhere, a network, a credential, a story — anything.",
  },

  // ── Chapter: Voice ──
  {
    id: "voiceMethod", chapter: "voice", kind: "single", required: true, allowOpenText: true,
    question: "How should your voice sound — and how do I learn it?",
    explanation: "So drafts sound like the same person wrote them — not a bot.",
    options: [
      { value: "pull", label: "Pull my recent posts (recommended)" },
      { value: "paste", label: "I'll paste a few posts" },
      { value: "tags", label: "Just describe it with tags" },
    ],
  },
  {
    id: "replyPlaybook", chapter: "voice", kind: "longtext", optional: true,
    question: "Anything you'll NEVER do?",
    explanation: "Hard guardrails — topics, tones, words to avoid. I obey these strictly.",
  },

  // ── Chapter: Inspirations & rivals ──
  {
    id: "inspirations", chapter: "inspirations", kind: "taglist", required: true,
    question: "Which accounts do you want to grow like?",
    explanation: "Comma-separated handles. These seed who I watch and how I model your voice.",
  },
  {
    id: "engageNow", chapter: "inspirations", kind: "taglist", optional: true,
    question: "Anyone you want to start engaging right now?",
    explanation: "Comma-separated handles I'll prioritize from day one.",
  },

  // ── Chapter: Rhythm & commitment ──
  {
    id: "capacity", chapter: "rhythm", kind: "single", required: true,
    question: "How much time can you spend per day?",
    explanation: "This sets how many opportunities I surface and how often I draft.",
    options: [
      { value: "10m", label: "~10 minutes" },
      { value: "30m", label: "~30 minutes" },
      { value: "60m+", label: "1 hour or more" },
    ],
  },
  {
    id: "consistency", chapter: "rhythm", kind: "single", optional: true,
    question: "How consistent have you been so far?",
    explanation: "No judgment — it just calibrates the plan.",
    options: [
      { value: "rarely", label: "Rarely post" },
      { value: "sometimes", label: "On and off" },
      { value: "daily", label: "Most days" },
    ],
  },
  {
    id: "commitment", chapter: "rhythm", kind: "single", optional: true,
    question: "Will you show up on slow days?",
    explanation: "Growth compounds from showing up. Be honest.",
    options: [
      { value: "in", label: "I'm in" },
      { value: "remind", label: "Be honest — remind me" },
    ],
  },
];

/** Structural branching: drop archetype-specific steps that don't match. */
export function activeSteps(archetype: Archetype | ""): StepDef[] {
  return STEPS.filter((s) => !s.showFor || (archetype !== "" && s.showFor.includes(archetype)));
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/lib/setup-steps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/setup-steps.ts src/lib/setup-steps.test.ts
git commit -m "feat(quiz): chaptered, archetype-branched step config"
```

---

## Task 2: Pure `stepComplete` with the `goalOpen` fix

**Files:**
- Modify: `src/lib/setup-logic.ts`
- Modify/Create: `src/lib/setup-logic.test.ts`

- [ ] **Step 1: Write the failing test** — add to `src/lib/setup-logic.test.ts` (create the file with this content if it doesn't exist):

```typescript
import { describe, it, expect } from "vitest";
import { stepComplete } from "@/lib/setup-logic";
import { STEPS, EMPTY_ANSWERS } from "@/lib/setup-steps";

const stepById = (id: string) => STEPS.find((s) => s.id === id)!;

describe("stepComplete", () => {
  it("optional steps are always complete", () => {
    expect(stepComplete(stepById("motive"), EMPTY_ANSWERS)).toBe(true);
  });

  it("a required single is incomplete until chosen", () => {
    expect(stepComplete(stepById("archetype"), EMPTY_ANSWERS)).toBe(false);
    expect(stepComplete(stepById("archetype"), { ...EMPTY_ANSWERS, archetype: "dev" })).toBe(true);
  });

  it("a required chips field needs at least one selection", () => {
    expect(stepComplete(stepById("pillars"), EMPTY_ANSWERS)).toBe(false);
    expect(stepComplete(stepById("pillars"), { ...EMPTY_ANSWERS, pillars: ["AI agents"] })).toBe(true);
  });

  it("goal is complete when an option is selected", () => {
    expect(stepComplete(stepById("goal"), { ...EMPTY_ANSWERS, goal: "reach" })).toBe(true);
  });

  it("GOAL_OPEN FIX: goal is complete when only the open-text is typed", () => {
    expect(stepComplete(stepById("goal"), { ...EMPTY_ANSWERS, goal: "", goalOpen: "launch a paid course" })).toBe(true);
  });

  it("goal is incomplete when neither option nor open-text is set", () => {
    expect(stepComplete(stepById("goal"), { ...EMPTY_ANSWERS, goal: "", goalOpen: "  " })).toBe(false);
  });

  it("a required toggle (premium) counts as complete (default is a real answer)", () => {
    expect(stepComplete(stepById("premium"), EMPTY_ANSWERS)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/setup-logic.test.ts`
Expected: FAIL — `stepComplete` is not exported from `setup-logic.ts` (it currently lives, buggy, inside the component).

- [ ] **Step 3: Implement** — add to `src/lib/setup-logic.ts` (keep existing exports). Add the import for the types and the function:

```typescript
import type { StepDef, SetupAnswers } from "@/lib/setup-steps";
```

```typescript
/** Pure step-completion check. Fixes the goalOpen bug: a custom goal counts. */
export function stepComplete(step: StepDef, a: SetupAnswers): boolean {
  if (step.optional || !step.required) return true;
  if (step.id === "goal") {
    return a.goal.trim().length > 0 || !!a.goalOpen?.trim();
  }
  const v = (a as unknown as Record<string, unknown>)[step.id];
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "boolean") return true; // a toggle always carries a value
  return typeof v === "string" ? v.trim().length > 0 : Boolean(v);
}
```

(Place the `import type` line next to the existing `import type { SetupAnswers }` at the top — merge them: `import type { StepDef, SetupAnswers } from "@/lib/setup-steps";`, and drop the now-duplicate import.)

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/lib/setup-logic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/setup-logic.ts src/lib/setup-logic.test.ts
git commit -m "fix(quiz): pure stepComplete honors goalOpen open-text"
```

---

## Task 3: Reflective interstitials (pure)

**Files:**
- Modify: `src/lib/setup-logic.ts`
- Modify: `src/lib/setup-logic.test.ts`

- [ ] **Step 1: Write the failing test** — append to `src/lib/setup-logic.test.ts`:

```typescript
import { interstitialFor } from "@/lib/setup-logic";

describe("interstitialFor", () => {
  it("mirrors the goal back as a piece of the plan forming", () => {
    const i = interstitialFor("goal", { ...EMPTY_ANSWERS, goal: "reach" });
    expect(i).not.toBeNull();
    expect(i!.body.toLowerCase()).toContain("rising");
  });

  it("returns null for a chapter with no interstitial copy", () => {
    expect(interstitialFor("channels", EMPTY_ANSWERS)).toBeNull();
  });

  it("names the archetype in the 'you' interstitial", () => {
    const i = interstitialFor("you", { ...EMPTY_ANSWERS, archetype: "founder" });
    expect(i!.body.toLowerCase()).toContain("founder");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/setup-logic.test.ts`
Expected: FAIL — `interstitialFor` not exported.

- [ ] **Step 3: Implement** — add to `src/lib/setup-logic.ts`:

```typescript
import type { ChapterId } from "@/lib/setup-steps";

export interface Interstitial { title: string; body: string }

const ARCHETYPE_LABEL: Record<string, string> = {
  dev: "developer / builder", founder: "founder / operator",
  creator: "creator / educator", trader: "trader / investor", protocol: "project / protocol",
};

const GOAL_MIRROR: Record<string, string> = {
  followers: "so I'll prioritize peer-tier accounts and replies that earn the profile click.",
  reach: "so I'll prioritize larger rising posts and write for the repost-and-reply, not the like.",
  leads: "so I'll favor question- and DM-able posts and position you as the credible practitioner.",
  authority: "so I'll favor depth — technical replies that bring the precise detail others miss.",
};

/** A short reflective screen shown after a chapter, mirroring the answer back. */
export function interstitialFor(chapter: ChapterId, a: SetupAnswers): Interstitial | null {
  if (chapter === "you" && a.archetype) {
    return {
      title: "Got it.",
      body: `You're a ${ARCHETYPE_LABEL[a.archetype] ?? a.archetype} — I'll tune what “good engagement” means to that.`,
    };
  }
  if (chapter === "goal") {
    const key = a.goalOpen?.trim() ? "" : a.goal;
    const mirror = GOAL_MIRROR[key];
    if (mirror) return { title: "That changes the play.", body: `Goal: ${a.goal} — ${mirror}` };
    if (a.goalOpen?.trim()) return { title: "That changes the play.", body: `Goal: ${a.goalOpen.trim()} — I'll point the engine at exactly that.` };
  }
  if (chapter === "niche" && a.angle.trim()) {
    return { title: "That's your edge.", body: "Every draft will lean on it instead of saying what everyone else says." };
  }
  return null;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/lib/setup-logic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/setup-logic.ts src/lib/setup-logic.test.ts
git commit -m "feat(quiz): reflective interstitial copy (pure)"
```

---

## Task 4: Extend the persisted answer payload

**Files:**
- Modify: `src/server/persona.ts` (the `InterviewAnswers` interface)
- Modify: `src/lib/setup-logic.ts` (`answersToInterview`)
- Modify: `src/lib/setup-logic.test.ts`

- [ ] **Step 1: Write the failing test** — append to `src/lib/setup-logic.test.ts`:

```typescript
import { answersToInterview } from "@/lib/setup-logic";

describe("answersToInterview — extended fields", () => {
  const a = {
    ...EMPTY_ANSWERS,
    archetype: "dev" as const, angle: "I ship agent infra and show the failure modes",
    pillars: ["AI agents"], goal: "authority", goalTarget: "2000 engaged followers",
    platforms: ["x", "linkedin"], formats: ["threads"], replyPlaybook: "never dunk on people",
    inspirations: ["@swyx", "@hwchase17"], voiceMethod: "tags" as const, voiceTags: ["technical", "lowercase"],
  };

  it("carries archetype, angle, platforms, formats, replyPlaybook, inspirations into the interview", () => {
    const iv = answersToInterview(a);
    expect(iv.archetype).toBe("dev");
    expect(iv.angle).toContain("agent infra");
    expect(iv.platforms).toEqual(["x", "linkedin"]);
    expect(iv.formats).toEqual(["threads"]);
    expect(iv.replyPlaybook).toBe("never dunk on people");
    expect(iv.inspirations).toEqual(["@swyx", "@hwchase17"]);
  });

  it("uses goalTarget as the north-star metric when present", () => {
    expect(answersToInterview(a).northStarMetric).toBe("2000 engaged followers");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/setup-logic.test.ts`
Expected: FAIL — `InterviewAnswers` has no `archetype`/`angle`/etc., and `answersToInterview` doesn't map them.

- [ ] **Step 3a: Extend `InterviewAnswers`** in `src/server/persona.ts` — replace the interface (currently `niche/goals/tone/doDont?/admired?/northStarMetric?/premiumAccount?`) with:

```typescript
export interface InterviewAnswers {
  niche: string;
  goals: string;
  tone: string;
  doDont?: string;
  admired?: string;
  northStarMetric?: string;
  premiumAccount?: boolean;
  // Engagement-engine context (capture-now, wire-later — persisted in onboarding_answers jsonb)
  archetype?: string;
  archetypeDetail?: string;
  angle?: string;
  zoneOfGenius?: string;
  motive?: string;
  platforms?: string[];
  formats?: string[];
  replyPlaybook?: string;
  inspirations?: string[];
}
```

- [ ] **Step 3b: Extend `answersToInterview`** in `src/lib/setup-logic.ts` — replace the function body:

```typescript
export function answersToInterview(a: SetupAnswers): InterviewAnswers {
  const goal = a.goalOpen?.trim() || GOAL_TO_NORTHSTAR[a.goal] || a.goal;
  const clean = (s: string) => (s.trim() ? s.trim() : undefined);
  const arr = (xs: string[]) => (xs.length ? xs : undefined);
  return {
    niche: a.pillars.join(", "),
    goals: goal,
    tone: a.voiceMethod === "tags" ? a.voiceTags.join(", ") : "",
    northStarMetric: clean(a.goalTarget) ?? goal,
    premiumAccount: a.premium,
    archetype: a.archetype || undefined,
    archetypeDetail: clean(a.archetypeDetail),
    angle: clean(a.angle),
    zoneOfGenius: clean(a.zoneOfGenius),
    motive: clean(a.motive),
    platforms: arr(a.platforms),
    formats: arr(a.formats),
    replyPlaybook: clean(a.replyPlaybook),
    inspirations: arr(a.inspirations),
  };
}
```

- [ ] **Step 4: Run test + the existing setup suite, verify pass**

Run: `npx vitest run src/lib/setup-logic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/persona.ts src/lib/setup-logic.ts src/lib/setup-logic.test.ts
git commit -m "feat(quiz): persist archetype/angle/platforms/playbook in onboarding answers"
```

---

## Task 5: Persist `reply_playbook` + seed `inspirations` in `finalizeSetup`

**Files:**
- Modify: `src/server/setup.ts`

> **Dependency check:** the `reply_playbook` column comes from Plan A's `0007_engagement_knobs.sql`. Confirm it exists before this task: `select column_name from information_schema.columns where table_name='profiles' and column_name='reply_playbook';` (via Supabase SQL editor / MCP). If absent, run Plan A Task 2 first.

- [ ] **Step 1: Read** `src/server/setup.ts` and locate the `supabaseService().from("profiles").update({...}).eq("id", profileId)` block inside `finalizeSetup` (lines 54-62) and the `savePersona(...)` call (lines 65-73).

- [ ] **Step 2: Add `reply_playbook` to the profile update** — in that `.update({...})` object (which, after Plan A Task 7, also sets `account_size` and `daily_capacity`), add:

```typescript
      reply_playbook: a.replyPlaybook?.trim() || null,
```

So the object reads (Plan A's two lines shown for context — keep them):

```typescript
    .update({
      handle: normHandle(a.handle),
      niche_description: a.pillars.join(", "),
      voice_corpus: a.voiceCorpus ?? [],
      voice_notes: a.voiceMethod === "tags" ? a.voiceTags.join(", ") : "",
      account_size: a.accountSize,        // from Plan A Task 7
      daily_capacity: a.capacity,         // from Plan A Task 7
      reply_playbook: a.replyPlaybook?.trim() || null,
    })
```

- [ ] **Step 3: Feed `inspirations` into the seed handles** — `finalizeSetup` receives `payload.seedHandles` already curated by the client. To make the user's named inspirations first-class seeds even if recommendations failed, merge them in. Replace the `savePersona(...)` call's `seedAccounts` argument so it unions inspirations:

```typescript
  await savePersona(profileId, {
    voiceSpec: payload.voiceSpec,
    goals: interview.goals,
    contentPillars: payload.contentPillars,
    answers: interview,
    seedAccounts: [...new Set([...payload.seedHandles, ...a.inspirations])],
    northStarMetric: interview.northStarMetric,
    premiumAccount: a.premium,
  });
```

(`savePersona` already normalizes + dedupes handles, so raw `@handle` strings are safe here.)

- [ ] **Step 4: Verify build + the server suite**

Run: `npm run build && npx vitest run src/server`
Expected: build clean; server tests pass. (If `npm run build` flags `reply_playbook` as unknown on the `profiles` type, Plan A Task 2's `types.ts` change hasn't landed — apply it.)

- [ ] **Step 5: Commit**

```bash
git add src/server/setup.ts
git commit -m "feat(quiz): persist reply_playbook + seed inspirations on finalize"
```

---

## Task 6: Rebuild the quiz component (chapters, branching, interstitials)

**Files:**
- Modify: `src/components/setup-quiz.tsx`

This is a UI rebuild verified by `npm run build` + manual smoke (no unit test — matches the repo convention for client panels, e.g. `reply-queue.tsx`). The pure logic it depends on is already tested in Tasks 1–4.

- [ ] **Step 1: Replace** the entire contents of `src/components/setup-quiz.tsx` with:

```tsx
"use client";
import { useMemo, useState } from "react";
import {
  EMPTY_ANSWERS, CHAPTERS, activeSteps,
  type SetupAnswers, type StepDef, type Archetype, type ChapterId,
} from "@/lib/setup-steps";
import { curatedSeedHandles, stepComplete, interstitialFor } from "@/lib/setup-logic";
import { buildSetupPreview, finalizeSetup, type SetupPreview } from "@/server/setup";
import { pullOwnVoiceCorpus } from "@/server/voice-pull";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Phase = "questions" | "interstitial" | "crafting" | "review" | "saving";

export function SetupQuiz({ profileId, onDone }: { profileId: string; onDone?: () => void }) {
  const [answers, setAnswers] = useState<SetupAnswers>(EMPTY_ANSWERS);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("questions");
  const [interChapter, setInterChapter] = useState<ChapterId | null>(null);
  const [preview, setPreview] = useState<SetupPreview | null>(null);
  const [voiceSpec, setVoiceSpec] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState("");

  const steps = useMemo(() => activeSteps(answers.archetype), [answers.archetype]);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const total = steps.length;
  const set = (patch: Partial<SetupAnswers>) => setAnswers((a) => ({ ...a, ...patch }));

  const chapterIndex = CHAPTERS.findIndex((c) => c.id === step?.chapter);
  const progress = phase === "questions" ? (stepIndex + 1) / total : 1;

  function toggleInArray(field: keyof SetupAnswers, value: string) {
    setAnswers((a) => {
      const cur = (a[field] as string[]) ?? [];
      const nextArr = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...a, [field]: nextArr };
    });
  }

  async function advance() {
    const isLast = stepIndex >= total - 1;
    // Show a reflective interstitial when leaving the last step of a chapter.
    const nextStep = steps[stepIndex + 1];
    const leavingChapter = isLast || nextStep?.chapter !== step.chapter;
    const inter = leavingChapter ? interstitialFor(step.chapter, answers) : null;
    if (inter && !isLast) {
      setInterChapter(step.chapter);
      setPhase("interstitial");
      return;
    }
    if (!isLast) { setStepIndex((i) => i + 1); return; }
    await craft();
  }

  function continueFromInterstitial() {
    setPhase("questions");
    setInterChapter(null);
    setStepIndex((i) => i + 1);
  }

  async function craft() {
    setPhase("crafting");
    try {
      if (answers.voiceMethod === "pull" && answers.handle.trim()) {
        try {
          const corpus = await pullOwnVoiceCorpus(answers.handle);
          set({ voiceCorpus: corpus });
        } catch {
          toast.message("Couldn't pull your posts — I'll work from your tags / pasted posts.");
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
      added: [...added.split(","), ...answers.inspirations].map((s) => s.trim()).filter(Boolean),
    });
    try {
      await finalizeSetup(profileId, { answers, voiceSpec, contentPillars: preview.synth.contentPillars, seedHandles });
      toast.success("Account is set up");
      onDone?.();
      window.location.href = "/";
    } catch (e) {
      toast.error(String(e));
      setPhase("review");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-10">
      {/* Sectioned chapter progress */}
      <div className="mb-6 flex gap-1.5">
        {CHAPTERS.map((c, i) => (
          <div key={c.id} className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: phase !== "questions" || i < chapterIndex ? "100%" : i === chapterIndex ? `${progress * 100}%` : "0%" }}
              />
            </div>
            <div className={`mt-1 text-[10px] uppercase tracking-wide ${i === chapterIndex ? "text-brand-text" : "text-muted-foreground"}`}>{c.label}</div>
          </div>
        ))}
      </div>

      {phase === "questions" && step && (
        <div className="space-y-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {CHAPTERS[chapterIndex]?.label} {step.optional && <span className="ml-1 normal-case text-[11px]">· optional</span>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{step.question}</h1>
          <p className="text-sm text-muted-foreground">{step.explanation}</p>

          <StepBody step={step} answers={answers} set={set} toggleInArray={toggleInArray} />

          <div className="flex justify-between pt-2">
            <Button variant="ghost" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)}>Back</Button>
            <div className="flex gap-2">
              {step.optional && (
                <Button variant="outline" onClick={advance}>Skip</Button>
              )}
              <Button disabled={!stepComplete(step, answers)} onClick={advance}>
                {stepIndex === total - 1 ? "Craft my plan" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {phase === "interstitial" && interChapter && (() => {
        const i = interstitialFor(interChapter, answers);
        return (
          <div className="space-y-4 text-center">
            <div className="text-3xl">✨</div>
            <h1 className="text-2xl font-bold tracking-tight">{i?.title}</h1>
            <p className="text-base text-muted-foreground">{i?.body}</p>
            <div className="pt-2"><Button onClick={continueFromInterstitial}>Keep going</Button></div>
          </div>
        );
      })()}

      {phase === "crafting" && <CraftingMoment />}

      {phase === "review" && preview && (
        <div className="space-y-5">
          <h1 className="text-2xl font-bold tracking-tight">Review your account</h1>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Your voice</div>
            <Textarea rows={5} value={voiceSpec} onChange={(e) => setVoiceSpec(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Accounts I recommend watching — toggle off any that don&apos;t fit</div>
            {preview.targets.targets.length === 0 && (
              <p className="text-sm text-muted-foreground">No recommendations right now — add accounts below, or do it later from the board.</p>
            )}
            <div className="flex flex-col gap-2">
              {preview.targets.targets.map((t) => {
                const isOff = off.has(t.handle.toLowerCase());
                return (
                  <button
                    key={t.handle}
                    type="button"
                    onClick={() => setOff((prev) => { const n = new Set(prev); const k = t.handle.toLowerCase(); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${isOff ? "opacity-40" : "border-primary"}`}
                  >
                    <div className="font-semibold">{t.handle}</div>
                    <div className="text-xs text-muted-foreground">{t.reason}</div>
                  </button>
                );
              })}
            </div>
            <Input placeholder="Add accounts you already know, comma-separated" value={added} onChange={(e) => setAdded(e.target.value)} />
          </div>
          <Button onClick={finish}>Finish setup</Button>
        </div>
      )}

      {phase === "saving" && <div className="py-20 text-center text-muted-foreground">Saving…</div>}
    </div>
  );
}

function StepBody({ step, answers, set, toggleInArray }: {
  step: StepDef;
  answers: SetupAnswers;
  set: (p: Partial<SetupAnswers>) => void;
  toggleInArray: (field: keyof SetupAnswers, value: string) => void;
}) {
  const options = (step.optionsByArchetype && answers.archetype && step.optionsByArchetype[answers.archetype as Archetype]) || step.options || [];

  if (step.kind === "text") {
    return <Input autoFocus placeholder={step.id === "handle" ? "@yourhandle" : "Type your answer…"} value={(answers[step.id] as string) ?? ""} onChange={(e) => set({ [step.id]: e.target.value } as Partial<SetupAnswers>)} />;
  }

  if (step.kind === "longtext") {
    return <Textarea autoFocus rows={4} placeholder="A sentence or two…" value={(answers[step.id] as string) ?? ""} onChange={(e) => set({ [step.id]: e.target.value } as Partial<SetupAnswers>)} />;
  }

  if (step.kind === "taglist") {
    return <Input autoFocus placeholder="Comma-separated (e.g. @swyx, @hwchase17)" defaultValue={(answers[step.id] as string[] ?? []).join(", ")} onChange={(e) => set({ [step.id]: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } as Partial<SetupAnswers>)} />;
  }

  if (step.kind === "toggle") {
    const current = answers[step.id] as boolean;
    return (
      <div className="flex gap-2">
        {(step.options ?? []).map((o) => (
          <Button key={o.value} variant={(current ? "yes" : "no") === o.value ? "default" : "outline"} onClick={() => set({ [step.id]: o.value === "yes" } as Partial<SetupAnswers>)}>
            {o.label}
          </Button>
        ))}
      </div>
    );
  }

  if (step.kind === "single") {
    return (
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const selected = (answers as unknown as Record<string, unknown>)[step.id] === o.value;
          return (
            <Button key={o.value} variant={selected ? "default" : "outline"} className="justify-start" onClick={() => set({ [step.id]: o.value } as Partial<SetupAnswers>)}>
              {o.label}
            </Button>
          );
        })}
        {step.allowOpenText && step.id === "goal" && (
          <Input placeholder="Or describe your goal…" value={answers.goalOpen ?? ""} onChange={(e) => set({ goalOpen: e.target.value })} />
        )}
        {step.id === "voiceMethod" && answers.voiceMethod === "paste" && (
          <Textarea rows={5} placeholder="Paste a few of your best posts, one per line" onChange={(e) => set({ voiceCorpus: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
        )}
        {step.id === "voiceMethod" && answers.voiceMethod === "tags" && (
          <Input placeholder="Tone tags, comma-separated (punchy, lowercase, technical)" onChange={(e) => set({ voiceTags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        )}
      </div>
    );
  }

  // chips (multi-select into the step's own array field)
  const selectedArr = (answers[step.id] as string[]) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selectedArr.includes(o.value);
          return (
            <button key={o.value} type="button" onClick={() => toggleInArray(step.id, o.value)}
              className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
              {o.label}
            </button>
          );
        })}
      </div>
      {step.allowOpenText && (
        <Input placeholder="Add your own, comma-separated"
          onChange={(e) => set({ [step.id]: [...options.map((o) => o.value).filter((v) => selectedArr.includes(v)), ...e.target.value.split(",").map((s) => s.trim()).filter(Boolean)] } as Partial<SetupAnswers>)} />
      )}
    </div>
  );
}

function CraftingMoment() {
  const rows = [
    { label: "Reading your voice", w: "100%" },
    { label: "Finding accounts to engage", w: "60%" },
    { label: "Setting your weekly rhythm", w: "25%" },
  ];
  return (
    <div className="mx-auto max-w-md space-y-6 py-10 text-center">
      <div className="text-5xl">🛠️</div>
      <h1 className="text-2xl font-bold tracking-tight">We&apos;re crafting <span className="text-brand-text">your growth plan…</span></h1>
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.label} className="space-y-1 text-left">
            <div className="text-sm font-semibold">{r.label}</div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-1000" style={{ width: r.w }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">the engine is actually running behind this screen</p>
    </div>
  );
}
```

> Notes for the implementer:
> - The `"yes"/"no"` toggle `variant` comparison mirrors the existing code's pattern (`(current ? "yes" : "no") === o.value`). The `Button` `variant` prop only needs to resolve to a real variant for the *selected* branch; the existing component already relied on this exact expression, so behavior is unchanged.
> - `voiceCorpus`/`voiceTags` are written by the conditional `voiceMethod` inputs exactly as before — they are not their own steps.
> - The crafting animation is **decorative**; the real gating is the awaited `buildSetupPreview` inside `craft()`. C2 will extend `craft()` to also generate the Growth Plan and add a `"plan"` phase before `"review"`.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean. (Watch for TS errors on `answers[step.id]` indexing — the `as unknown as Record<...>` / `as string` casts above are deliberate to satisfy the union.)

- [ ] **Step 3: Manual smoke** (optional but recommended) — `npm run dev`, open `/setup`:
  - Pick an archetype → confirm the matching "What are you building / What does your company do" question appears and others don't.
  - On the Goal step, type only the open-text → "Next" enables (the bug is fixed).
  - Skip an optional step → it advances.
  - Cross a chapter boundary → a reflective interstitial shows, then "Keep going".
  - Reach the end → the crafting animation shows while `buildSetupPreview` runs → review screen.

> Dev gotcha (from the snapshot): if `/setup` enters a reload loop, stop dev, `rm -rf .next`, restart. Never edit `.env.local` while `next dev` is running.

- [ ] **Step 4: Commit**

```bash
git add src/components/setup-quiz.tsx
git commit -m "feat(quiz): chaptered, branched quiz UI with interstitials + crafting moment"
```

---

## Task 7: Full verification

- [ ] **Step 1: Run the whole suite** (NEVER with `RUN_RLS_INTEGRATION=1`)

Run: `npm test`
Expected: all green, ≤1 skipped (RLS). New: `setup-steps.test.ts`, expanded `setup-logic.test.ts`.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "test(quiz): green suite + clean build for quiz redesign"
```

---

## Self-review (against spec §5 + owner decisions)

- **Chaptered, one-question-per-screen, sectioned progress** → Task 1 (`CHAPTERS`) + Task 6 (the segmented progress bar with chapter labels).
- **Core vs Optional, skippable** → `required`/`optional` on `StepDef`; `stepComplete` returns true for optional (Task 2); the UI shows a "Skip" button + "· optional" label (Task 6).
- **Structural archetype branching** (owner decision) → `showFor` + `activeSteps` (Task 1); per-archetype `optionsByArchetype` pillar presets (Task 1/6); one archetype-specific question each.
- **Reflective interstitials mirroring the answer** → `interstitialFor` (Task 3) + the `interstitial` phase (Task 6).
- **Crafting moment filling real latency** → `CraftingMoment` over the awaited `buildSetupPreview` (Task 6).
- **`goalOpen` bug fix** → pure `stepComplete` (Task 2), unit-tested incl. the open-text-only case.
- **Knob persistence** → `reply_playbook` column write + richer `onboarding_answers` (Tasks 4–5); `account_size`/`daily_capacity` rely on Plan A Task 7 (dependency stated).
- **inspirations → seed_targets** → unioned into seed handles in `finalizeSetup` (Task 5).
- **Design-system fidelity (spec §5)** → only `Button`/`Input`/`Textarea` + brand tokens (`bg-primary`, `text-brand-text`, `bg-muted`) — no bespoke primitives; mirrors `setup-quiz.tsx`'s existing usage.
- **Out of scope (correctly absent):** the Growth Plan schema/LLM call/reveal/dashboard card (all C2); engine + flows (A/B).
- **Placeholder scan:** every code step is complete; the component is given in full.
- **Type consistency:** `SetupAnswers`/`StepDef`/`Archetype`/`ChapterId` defined in Task 1 are imported unchanged by Tasks 2/3/6; `InterviewAnswers` extension (Task 4) matches `answersToInterview`'s returned object; `activeSteps` / `stepComplete` / `interstitialFor` signatures match their call sites in Task 6.
- **Open verify item:** `npm run build` depends on Plan A's `types.ts` carrying `reply_playbook` (and `account_size`/`daily_capacity`); confirm before Task 5.
```
