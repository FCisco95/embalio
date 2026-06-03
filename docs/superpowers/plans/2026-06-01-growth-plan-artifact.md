# Growth Plan Artifact — LLM-Synthesized, Saved & Surfaced (Implementation Plan, Plan C2 of "C")

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the quiz's climax into a **real, saved Growth Plan artifact** — a dedicated `claude -p` synthesis that produces the 7-section plan (voice · pillars+edge · who-to-watch · rhythm · north-star · what-Embalio-does · first-moves), persisted to the profile and surfaced both at the end of setup and on the dashboard.

**Architecture:** A pure prompt-builder (`buildGrowthPlanPrompt`) + a Zod `GrowthPlan` schema feed a single `generateStructured` call in `generateGrowthPlan` (a `"use server"` action). The plan is generated during the quiz's existing **crafting** phase (alongside `buildSetupPreview`), shown via a `GrowthPlanReveal` component (Dispatch design system), persisted to a new `profiles.growth_plan` jsonb column in `finalizeSetup`, and read back onto the dashboard via `getGrowthPlan`.

**Tech Stack:** TypeScript, Vitest (golden-prompt + schema tests), Zod, Supabase (jsonb column + generated types), `claude -p` via `generateStructured`, Next.js App Router + the Dispatch design system (`Card`/`CardContent`/`BrandAvatar`/`Button`).

**Depends on:** **Plan C1 executed** (the extended `SetupAnswers` with `archetype`/`angle`/`goalTarget`/`inspirations`, and the `setup-quiz.tsx` rebuilt with the `crafting` phase + `craft()` function this plan extends) and **Plan A** (`knobsFromProfile`, used to ground the rhythm). Plan B is **not** required.

**Scope (C2):** the `GrowthPlan` schema + prompt + generation + persistence + reveal screen + dashboard card (+ a `/plan` view reusing the reveal). **Out:** the quiz itself (C1); the engine + flows (A/B).

**Spec:** `docs/superpowers/specs/2026-06-01-engagement-engine-and-quiz-design.md` (§6 the Growth Plan). **Validated mockup (gitignored):** `.superpowers/brainstorm/3618-1780319540/content/growth-plan.html` — the 7 numbered sections, hero badge "Developer / Builder · 90-day plan", "Start engaging →" CTA.

**Owner decision folded in:** the plan is produced by a **dedicated LLM synthesis call** (not deterministic assembly).

---

## Contract (locked before tasks)

The `GrowthPlan` object maps 1:1 to the mockup's seven sections:

```typescript
GrowthPlan = {
  archetypeLabel: string;        // hero badge, e.g. "Developer / Builder · 90-day plan"
  headline: string;              // hero subline, e.g. "@fcisco95 · build authority in AI agents → 2,000 engaged followers"
  voiceSummary: string;          // ① your voice (1–2 sentences, in-character)
  voiceTags: string[];           // ① chips (technical, lowercase, …)
  pillars: string[];             // ② your pillars
  edge: string;                  // ② your angle / edge
  whoToWatch: { handle: string; why: string }[];  // ③ accounts + a one-line "why this, for you"
  rhythm: { count: string; label: string }[];     // ④ e.g. {count:"5/day", label:"strategic replies"}
  northStar: { metric: string; detail: string };  // ⑤ the 90-day number + how it's tracked
  embalioDoes: string[];         // ⑥ what Embalio does for you
  firstMoves: string[];          // ⑦ 2–3 starting actions
}
```

**Generation inputs:** the quiz `SetupAnswers` (archetype, angle, goalTarget, pillars, capacity, handle), the `PersonaSynthesis` (voiceSpec, contentPillars), the `TargetQueue` (recommended handles + reasons), and the capacity-derived reply target from `knobsFromProfile`. The model writes the "why, for you" lines and the prose; it must **not** fabricate follower multiples (no live follower data at plan time — size badges are deferred).

---

## File structure (locked)

- Modify `src/lib/schemas.ts` — add `GrowthPlanWatch` + `GrowthPlan` Zod schemas.
- Create `src/lib/growth-plan/prompt.ts` — `buildGrowthPlanPrompt(input)` (pure).
- Create `src/lib/growth-plan/prompt.test.ts` — golden-prompt assertions.
- Create `src/server/growth-plan.ts` — `generateGrowthPlan(...)` + `saveGrowthPlan(...)` + `getGrowthPlan(...)` (`"use server"`).
- Create `supabase/migrations/0008_growth_plan.sql` — add `growth_plan jsonb` to `profiles`.
- Modify `src/lib/supabase/types.ts` — add `growth_plan` to the `profiles` Row/Insert/Update.
- Modify `src/server/setup.ts` — accept + persist `growthPlan` in `finalizeSetup`.
- Create `src/components/growth-plan-reveal.tsx` — the reveal screen (Dispatch components).
- Modify `src/components/setup-quiz.tsx` — generate the plan in `craft()`; add a `"plan"` phase that renders the reveal before review; pass the plan into `finalizeSetup`.
- Create `src/components/growth-plan-card.tsx` — the compact dashboard surface.
- Modify `src/server/dashboard.ts` — `getGrowthPlan` is read here (or imported) for the page.
- Modify `src/app/(app)/page.tsx` — render the Growth Plan card when present.
- Create `src/app/(app)/plan/page.tsx` — full-page reveal (reuses `GrowthPlanReveal`).

---

## Task 1: `GrowthPlan` schema

**Files:**
- Modify: `src/lib/schemas.ts`
- Test: `src/lib/schemas.test.ts` (append; create if absent)

- [ ] **Step 1: Write the failing test** — append to `src/lib/schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GrowthPlan } from "@/lib/schemas";

describe("GrowthPlan schema", () => {
  it("parses a complete plan", () => {
    const p = GrowthPlan.parse({
      archetypeLabel: "Developer / Builder · 90-day plan",
      headline: "@fcisco95 · authority in AI agents → 2,000 engaged followers",
      voiceSummary: "Technical and concrete. Lowercase, no fluff.",
      voiceTags: ["technical", "lowercase"],
      pillars: ["AI agents"],
      edge: "you ship real agent infra and show the failure modes",
      whoToWatch: [{ handle: "@swyx", why: "AI-eng audience overlap — high-leverage replies" }],
      rhythm: [{ count: "5/day", label: "strategic replies" }],
      northStar: { metric: "2,000 engaged followers in 90 days", detail: "tracked weekly" },
      embalioDoes: ["Scans your accounts daily and surfaces posts worth your reply"],
      firstMoves: ["Reply to the 3 rising posts waiting in your scan"],
    });
    expect(p.whoToWatch[0].handle).toBe("@swyx");
    expect(p.rhythm[0].count).toBe("5/day");
  });

  it("defaults array sections to empty", () => {
    const p = GrowthPlan.parse({
      archetypeLabel: "x", headline: "y", voiceSummary: "z", edge: "e",
      northStar: { metric: "m", detail: "d" },
    });
    expect(p.voiceTags).toEqual([]);
    expect(p.whoToWatch).toEqual([]);
    expect(p.firstMoves).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/schemas.test.ts`
Expected: FAIL — `GrowthPlan` not exported.

- [ ] **Step 3: Implement** — add to `src/lib/schemas.ts` (near the other persona schemas; match the file's `import { z } from "zod"`):

```typescript
export const GrowthPlanWatch = z.object({
  handle: z.string(),
  why: z.string(),
});

export const GrowthPlan = z.object({
  archetypeLabel: z.string().min(1),
  headline: z.string().min(1),
  voiceSummary: z.string().min(1),
  voiceTags: z.array(z.string()).max(8).default([]),
  pillars: z.array(z.string()).max(8).default([]),
  edge: z.string().min(1),
  whoToWatch: z.array(GrowthPlanWatch).max(10).default([]),
  rhythm: z.array(z.object({ count: z.string(), label: z.string() })).max(4).default([]),
  northStar: z.object({ metric: z.string(), detail: z.string() }),
  embalioDoes: z.array(z.string()).max(6).default([]),
  firstMoves: z.array(z.string()).max(5).default([]),
});
export type GrowthPlan = z.infer<typeof GrowthPlan>;
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/lib/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts
git commit -m "feat(growth-plan): GrowthPlan zod schema"
```

---

## Task 2: Growth Plan prompt (pure)

**Files:**
- Create: `src/lib/growth-plan/prompt.ts`
- Test: `src/lib/growth-plan/prompt.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/growth-plan/prompt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildGrowthPlanPrompt } from "@/lib/growth-plan/prompt";

const input = {
  handle: "fcisco95",
  archetypeLabel: "Developer / Builder",
  voiceSpec: "Technical and concrete. Lowercase, no fluff.",
  pillars: ["AI agents", "Dev tools"],
  angle: "I ship agent infra and show the failure modes nobody talks about",
  goalNarrative: "build authority in AI agents",
  northStarTarget: "2,000 engaged followers",
  dailyReplyTarget: 5,
  targets: [
    { handle: "@swyx", reason: "AI-eng audience overlap" },
    { handle: "@hwchase17", reason: "ships agent frameworks" },
  ],
};

describe("buildGrowthPlanPrompt", () => {
  const p = buildGrowthPlanPrompt(input);

  it("includes the handle, angle, and north-star target", () => {
    expect(p).toContain("fcisco95");
    expect(p).toContain("agent infra");
    expect(p).toContain("2,000 engaged followers");
  });

  it("grounds rhythm in the daily reply target", () => {
    expect(p).toContain("5");
    expect(p.toLowerCase()).toMatch(/repl(y|ies)/);
  });

  it("passes the recommended accounts so the model writes 'why, for you' lines", () => {
    expect(p).toContain("@swyx");
    expect(p).toContain("@hwchase17");
  });

  it("forbids fabricating follower counts / multiples", () => {
    expect(p.toLowerCase()).toMatch(/do not (invent|fabricate)/);
  });

  it("asks for the GrowthPlan JSON shape (all 7 sections)", () => {
    for (const key of ["archetypeLabel", "voiceSummary", "whoToWatch", "rhythm", "northStar", "embalioDoes", "firstMoves"]) {
      expect(p).toContain(key);
    }
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/growth-plan/prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `src/lib/growth-plan/prompt.ts`:

```typescript
import { sanitizeForPrompt } from "@/lib/generate/sanitize";

export interface GrowthPlanPromptInput {
  handle: string;
  archetypeLabel: string;        // "Developer / Builder"
  voiceSpec: string;             // from PersonaSynthesis
  pillars: string[];
  angle: string;                 // the user's edge
  goalNarrative: string;         // "build authority in AI agents"
  northStarTarget: string;       // "2,000 engaged followers"
  dailyReplyTarget: number;      // from knobsFromProfile
  targets: { handle: string; reason: string }[];
}

export function buildGrowthPlanPrompt(i: GrowthPlanPromptInput): string {
  const accounts = i.targets.length
    ? i.targets.map((t) => `- ${sanitizeForPrompt(t.handle, 60)}: ${sanitizeForPrompt(t.reason, 200)}`).join("\n")
    : "(none recommended — leave whoToWatch empty)";
  return [
    `You are writing a personalized 90-day X growth plan for @${sanitizeForPrompt(i.handle, 60)} — a ${sanitizeForPrompt(i.archetypeLabel, 60)}.`,
    `Their voice spec (write the plan IN this voice where prose appears):\n${sanitizeForPrompt(i.voiceSpec, 1200)}`,
    `Their content pillars: ${i.pillars.map((p) => sanitizeForPrompt(p, 40)).join(", ") || "(unspecified)"}.`,
    `Their edge (why follow THEM): ${sanitizeForPrompt(i.angle, 400) || "(unspecified)"}.`,
    `Their goal narrative: ${sanitizeForPrompt(i.goalNarrative, 200)}. North-star target: ${sanitizeForPrompt(i.northStarTarget, 120)}.`,
    `Their capacity supports about ${i.dailyReplyTarget} strategic replies/day — ground the "rhythm" section in that (e.g. "${i.dailyReplyTarget}/day strategic replies", plus a realistic original-post + thread cadence).`,
    `Accounts to watch (rewrite each "why" as a sharp one-liner about why THIS account matters FOR THEM — do NOT invent follower counts or "x your size" multiples; we have no follower data):\n${accounts}`,
    `The plan must optimize for the engine's law: replies engineered to make the author reply back, posts built for replies + bookmarks + dwell — never for likes. "embalioDoes" should say, in plain terms, what Embalio does for them daily (scans, drafts in-voice replies built for the author's reply-back, pings their phone, tracks reach). "firstMoves" = 2–3 concrete starting actions.`,
    `Return EXACTLY this JSON (no markdown): {"archetypeLabel": "...", "headline": "@handle · goal → target", "voiceSummary": "...", "voiceTags": ["..."], "pillars": ["..."], "edge": "...", "whoToWatch": [{"handle": "...", "why": "..."}], "rhythm": [{"count": "5/day", "label": "strategic replies"}], "northStar": {"metric": "...", "detail": "..."}, "embalioDoes": ["..."], "firstMoves": ["..."]}.`,
  ].join("\n\n");
}
```

> Verify the import: `sanitizeForPrompt` lives in `@/lib/generate/sanitize` (used by `reply-craft.ts` in Plan A and `post-craft.ts` in Plan B). If your tree names it differently, match the existing import used in `src/lib/voice-prompt.ts`.

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/lib/growth-plan/prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/growth-plan/prompt.ts src/lib/growth-plan/prompt.test.ts
git commit -m "feat(growth-plan): research-grounded growth-plan prompt"
```

---

## Task 3: `growth_plan` column + types

**Files:**
- Create: `supabase/migrations/0008_growth_plan.sql`
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Write the migration** `supabase/migrations/0008_growth_plan.sql`:

```sql
-- 0008_growth_plan.sql
-- The saved Growth Plan artifact produced at the end of setup.
alter table profiles add column if not exists growth_plan jsonb;
```

- [ ] **Step 2: Apply the migration** — `supabase db push` (or paste via the Supabase SQL editor / MCP `apply_migration`). Expected: one column added, idempotent.

- [ ] **Step 3: Update generated types** — in `src/lib/supabase/types.ts`, add to the `profiles` table's `Row`, `Insert`, and `Update` (match the formatting of other `jsonb` columns like `onboarding_answers`, which uses the `Json` type):

```typescript
growth_plan: Json | null
```

(In `Insert`/`Update`: `growth_plan?: Json | null`.)

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_growth_plan.sql src/lib/supabase/types.ts
git commit -m "feat(growth-plan): add profiles.growth_plan jsonb column"
```

---

## Task 4: Generate / save / read the plan (server)

**Files:**
- Create: `src/server/growth-plan.ts`

- [ ] **Step 1: Implement** `src/server/growth-plan.ts` (server reads/writes + one LLM call; pure logic already tested in Tasks 1–2):

```typescript
"use server";
import { supabaseService, supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { GrowthPlan } from "@/lib/schemas";
import { buildGrowthPlanPrompt } from "@/lib/growth-plan/prompt";
import { knobsFromProfile } from "@/lib/engagement/knobs";
import type { SetupAnswers } from "@/lib/setup-steps";
import type { PersonaSynthesis, TargetQueue } from "@/lib/schemas";

const ARCHETYPE_LABEL: Record<string, string> = {
  dev: "Developer / Builder", founder: "Founder / Operator",
  creator: "Creator / Educator", trader: "Trader / Investor", protocol: "Project / Protocol",
};

export async function generateGrowthPlan(
  answers: SetupAnswers,
  synth: PersonaSynthesis,
  targets: TargetQueue,
): Promise<GrowthPlan> {
  // Capacity → daily reply target via the Plan A knob mapping (account_size/capacity columns
  // aren't written until finalize, so map straight off the answers here).
  const knobs = knobsFromProfile({
    account_size: answers.accountSize || null,
    daily_capacity: answers.capacity || null,
    north_star_metric: answers.goalTarget || null,
    reply_playbook: answers.replyPlaybook || null,
  });
  const prompt = buildGrowthPlanPrompt({
    handle: answers.handle.replace(/^@+/, ""),
    archetypeLabel: ARCHETYPE_LABEL[answers.archetype] ?? "Builder",
    voiceSpec: synth.voiceSpec,
    pillars: synth.contentPillars,
    angle: answers.angle,
    goalNarrative: answers.goalOpen?.trim() || answers.goal,
    northStarTarget: answers.goalTarget,
    dailyReplyTarget: knobs.dailyReplyTarget,
    targets: targets.targets.map((t) => ({ handle: t.handle, reason: t.reason })),
  });
  const r = await generateStructured(GrowthPlan, prompt);
  if (!r.data) throw new Error("could not craft your growth plan — try again");
  return r.data;
}

export async function saveGrowthPlan(profileId: string, plan: GrowthPlan): Promise<void> {
  const sb = supabaseService();
  const { error } = await sb.from("profiles").update({ growth_plan: plan }).eq("id", profileId);
  if (error) throw new Error(error.message);
}

export async function getGrowthPlan(profileId: string): Promise<GrowthPlan | null> {
  const sb = await supabaseServer();
  const { data } = await sb.from("profiles").select("growth_plan").eq("id", profileId).single();
  const raw = data?.growth_plan;
  if (!raw) return null;
  const parsed = GrowthPlan.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
```

> `generateStructured` defaults to no web research here (the plan synthesizes from supplied inputs; the research already happened in `synthesizePersona`). If your `generateStructured` requires an options arg, pass `{}`. Confirm `knobsFromProfile`'s input shape matches Plan A (`{ account_size, daily_capacity, north_star_metric, reply_playbook }`).

- [ ] **Step 2: Verify build** — `npm run build` → clean.

- [ ] **Step 3: Commit**

```bash
git add src/server/growth-plan.ts
git commit -m "feat(growth-plan): generate + save + read the plan (server)"
```

---

## Task 5: Persist the plan in `finalizeSetup`

**Files:**
- Modify: `src/server/setup.ts`

- [ ] **Step 1: Add the import** at the top of `src/server/setup.ts`:

```typescript
import { saveGrowthPlan } from "@/server/growth-plan";
import type { GrowthPlan } from "@/lib/schemas";
```

- [ ] **Step 2: Extend the `finalizeSetup` payload + persist** — change the signature's `payload` type to include the optional plan, and save it after `savePersona`:

```typescript
export async function finalizeSetup(
  profileId: string,
  payload: { answers: SetupAnswers; voiceSpec: string; contentPillars: string[]; seedHandles: string[]; growthPlan?: GrowthPlan },
): Promise<void> {
```

…and immediately before the closing `revalidatePath("/")`:

```typescript
  if (payload.growthPlan) await saveGrowthPlan(profileId, payload.growthPlan);

  revalidatePath("/");
```

- [ ] **Step 3: Verify build + server suite** — `npm run build && npx vitest run src/server` → clean / green.

- [ ] **Step 4: Commit**

```bash
git add src/server/setup.ts
git commit -m "feat(growth-plan): persist the plan on finalizeSetup"
```

---

## Task 6: `GrowthPlanReveal` component

**Files:**
- Create: `src/components/growth-plan-reveal.tsx`

- [ ] **Step 1: Implement** `src/components/growth-plan-reveal.tsx` (reuses `Card`/`CardContent`/`BrandAvatar`/`Button`; mirrors the mockup's 7 sections + Dispatch tokens):

```tsx
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandAvatar } from "@/components/ui/brand-avatar";
import type { GrowthPlan } from "@/lib/schemas";

function Section({ n, title, extra, children }: { n: string; title: string; extra?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-2.5 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
          {n} {title} {extra && <span className="font-semibold text-brand-text/60">· {extra}</span>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function GrowthPlanReveal({ plan, onStart, ctaLabel = "Start engaging →" }: {
  plan: GrowthPlan;
  onStart?: () => void;
  ctaLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="mb-2 text-center">
        <div className="mb-2 text-4xl">🗺️</div>
        <span className="inline-block rounded-full bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-text">{plan.archetypeLabel}</span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Your Growth Plan</h1>
        <p className="text-sm text-muted-foreground">{plan.headline}</p>
      </div>

      <Section n="①" title="Your voice">
        <p className="text-[14px] italic leading-relaxed text-foreground">&ldquo;{plan.voiceSummary}&rdquo;</p>
        {plan.voiceTags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {plan.voiceTags.map((t) => <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">{t}</span>)}
          </div>
        )}
      </Section>

      <Section n="②" title="Your pillars & edge">
        {plan.pillars.length > 0 && <div className="text-[14px] font-bold">{plan.pillars.join(" · ")}</div>}
        <div className="mt-1 text-[13px] text-muted-foreground"><span className="font-semibold text-foreground">Your edge:</span> {plan.edge}</div>
      </Section>

      {plan.whoToWatch.length > 0 && (
        <Section n="③" title="Who to watch" extra={`${plan.whoToWatch.length} accounts`}>
          <div className="flex flex-col">
            {plan.whoToWatch.map((w) => (
              <div key={w.handle} className="flex items-center gap-2.5 border-b border-border py-2 last:border-none">
                <BrandAvatar name={w.handle} size="sm" />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold">{w.handle}</div>
                  <div className="text-[12px] text-muted-foreground">{w.why}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {plan.rhythm.length > 0 && (
        <Section n="④" title="Your rhythm">
          <div className="flex gap-2.5">
            {plan.rhythm.map((r) => (
              <div key={r.label} className="flex-1 rounded-xl bg-muted/60 px-2 py-3.5 text-center">
                <div className="text-xl font-bold text-brand-text">{r.count}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{r.label}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section n="⑤" title="Your north-star">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold">{plan.northStar.metric}</div>
          <div className="text-[13px] text-muted-foreground">{plan.northStar.detail}</div>
        </div>
      </Section>

      {plan.embalioDoes.length > 0 && (
        <Section n="⑥" title="What Embalio does for you">
          <ul className="space-y-1.5 text-[14px] leading-relaxed text-foreground">
            {plan.embalioDoes.map((d, i) => <li key={i}>· {d}</li>)}
          </ul>
        </Section>
      )}

      {plan.firstMoves.length > 0 && (
        <Section n="⑦" title="Your first moves">
          <ul className="space-y-1.5 text-[14px] leading-relaxed text-foreground">
            {plan.firstMoves.map((m, i) => <li key={i} className="text-brand-text">→ <span className="text-foreground">{m}</span></li>)}
          </ul>
        </Section>
      )}

      {onStart && <Button className="w-full" onClick={onStart}>{ctaLabel}</Button>}
    </div>
  );
}
```

- [ ] **Step 2: Verify build** — `npm run build` → clean. (Confirm `BrandAvatar` accepts `size="sm"` — per the design-system catalog it does.)

- [ ] **Step 3: Commit**

```bash
git add src/components/growth-plan-reveal.tsx
git commit -m "feat(growth-plan): GrowthPlanReveal screen"
```

---

## Task 7: Wire the reveal into the quiz climax

**Files:**
- Modify: `src/components/setup-quiz.tsx` (the C1 component)

- [ ] **Step 1: Add imports** to `src/components/setup-quiz.tsx`:

```typescript
import { generateGrowthPlan } from "@/server/growth-plan";
import { GrowthPlanReveal } from "@/components/growth-plan-reveal";
import type { GrowthPlan } from "@/lib/schemas";
```

- [ ] **Step 2: Add the phase + state** — extend the `Phase` union and add plan state:

```typescript
type Phase = "questions" | "interstitial" | "crafting" | "plan" | "review" | "saving";
```

```typescript
  const [plan, setPlan] = useState<GrowthPlan | null>(null);
```

- [ ] **Step 3: Generate the plan inside `craft()`** — after `setPreview(p)` / `setVoiceSpec(p.synth.voiceSpec)`, generate the plan and land on the `"plan"` phase instead of `"review"`. Replace the success tail of `craft()`:

```typescript
      const p = await buildSetupPreview(answers);
      setPreview(p);
      setVoiceSpec(p.synth.voiceSpec);
      try {
        const gp = await generateGrowthPlan(answers, p.synth, p.targets);
        setPlan(gp);
        setPhase("plan");
      } catch {
        // plan is a bonus; if it fails, fall straight through to review
        setPhase("review");
      }
```

- [ ] **Step 4: Render the `"plan"` phase** — add, just before the `phase === "review"` block:

```tsx
      {phase === "plan" && plan && (
        <GrowthPlanReveal plan={plan} onStart={() => setPhase("review")} ctaLabel="Looks right → curate accounts" />
      )}
```

- [ ] **Step 5: Pass the plan into `finalizeSetup`** — in `finish()`, add `growthPlan: plan ?? undefined` to the `finalizeSetup` payload:

```typescript
      await finalizeSetup(profileId, { answers, voiceSpec, contentPillars: preview.synth.contentPillars, seedHandles, growthPlan: plan ?? undefined });
```

- [ ] **Step 6: Verify build + manual** — `npm run build` → clean. Manual (`npm run dev`, `/setup`): finishing the quiz now shows the crafting animation → **the Growth Plan reveal** → curate → finish. (Requires `APIFY_TOKEN`/`OPENAI_API_KEY` only if voice-pull is used; the plan synthesis itself is `claude -p`.)

- [ ] **Step 7: Commit**

```bash
git add src/components/setup-quiz.tsx
git commit -m "feat(growth-plan): reveal the plan at the quiz climax + persist it"
```

---

## Task 8: Dashboard surface + `/plan` page

**Files:**
- Create: `src/components/growth-plan-card.tsx`
- Modify: `src/app/(app)/page.tsx`
- Create: `src/app/(app)/plan/page.tsx`

- [ ] **Step 1: Implement the compact card** `src/components/growth-plan-card.tsx`:

```tsx
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { GrowthPlan } from "@/lib/schemas";

export function GrowthPlanCard({ plan }: { plan: GrowthPlan }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-text">{plan.archetypeLabel}</span>
          <Link href="/plan" className={buttonVariants({ size: "sm", variant: "outline" })}>View plan</Link>
        </div>
        <div className="text-[13.5px] font-semibold">North-star: {plan.northStar.metric}</div>
        {plan.firstMoves.length > 0 && (
          <ul className="space-y-1 text-[13px] text-muted-foreground">
            {plan.firstMoves.slice(0, 3).map((m, i) => <li key={i} className="text-brand-text">→ <span className="text-foreground">{m}</span></li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Render it on the dashboard** — in `src/app/(app)/page.tsx`, import `getGrowthPlan` + `GrowthPlanCard`, fetch the plan alongside the existing `getDashboardData` call (inside the `if (profile?.id)` block), and render the card near the top of the grid when present:

```typescript
import { getGrowthPlan } from "@/server/growth-plan";
import { GrowthPlanCard } from "@/components/growth-plan-card";
```

```typescript
  let growthPlan = null;
  if (profile?.id) {
    pending = await listPendingDrafts(profile.id);
    data = await getDashboardData(profile.id);
    growthPlan = await getGrowthPlan(profile.id);
  }
```

```tsx
  {growthPlan && <GrowthPlanCard plan={growthPlan} />}
```

(Place the card where it reads naturally in the existing card layout — e.g. directly under the reach hero. Follow the file's existing JSX structure.)

- [ ] **Step 3: Full-page view** `src/app/(app)/plan/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { listProfiles } from "@/server/profiles";
import { getGrowthPlan } from "@/server/growth-plan";
import { GrowthPlanReveal } from "@/components/growth-plan-reveal";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const profiles = await listProfiles();
  const profile = profiles?.[0];
  if (!profile?.id) redirect("/setup");
  const plan = await getGrowthPlan(profile.id);
  if (!plan) redirect("/");
  return (
    <main className="px-4 py-8">
      <GrowthPlanReveal plan={plan} />
    </main>
  );
}
```

> Confirm `listProfiles` is imported from the same module the dashboard uses (`src/app/(app)/page.tsx` imports it — match that path).

- [ ] **Step 4: Verify** — `npm run build` → clean. Manual: complete `/setup`, land on the dashboard → the Growth Plan card shows; "View plan" → `/plan` renders the full reveal.

- [ ] **Step 5: Commit**

```bash
git add src/components/growth-plan-card.tsx src/app/(app)/page.tsx src/app/(app)/plan/page.tsx
git commit -m "feat(growth-plan): dashboard card + /plan full view"
```

---

## Task 9: Full verification

- [ ] **Step 1: Run the whole suite** (NEVER with `RUN_RLS_INTEGRATION=1`)

Run: `npm test`
Expected: all green, ≤1 skipped (RLS). New: `GrowthPlan` schema test, `growth-plan/prompt.test.ts`.

- [ ] **Step 2: Build** — `npm run build` → clean.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "test(growth-plan): green suite + clean build"
```

---

## Self-review (against spec §6 + owner decision)

- **Saved artifact, 7 sections** → `GrowthPlan` schema (Task 1) maps 1:1 to the mockup; persisted to `profiles.growth_plan` (Tasks 3, 5).
- **Dedicated LLM synthesis** (owner decision) → `buildGrowthPlanPrompt` + `generateGrowthPlan` (Tasks 2, 4), one `generateStructured` call, grounded in the synth + targets + capacity-knob; explicitly forbids fabricating follower multiples.
- **Shown at the end of setup** → `"plan"` phase + `GrowthPlanReveal` wired into `craft()`/`finish()` (Tasks 6, 7).
- **Living on the dashboard** → `GrowthPlanCard` + `/plan` full view (Task 8); `getGrowthPlan` read (Task 4).
- **Rhythm grounded in capacity** → `dailyReplyTarget` from `knobsFromProfile` flows into the prompt (Tasks 2, 4).
- **Graceful degradation** → plan generation is wrapped in try/catch; failure falls through to the existing review (Task 7); `getGrowthPlan` tolerates malformed/absent jsonb (Task 4).
- **Design-system fidelity (spec §5)** → reveal + card use only `Card`/`CardContent`/`BrandAvatar`/`Button`/`buttonVariants` + brand tokens (Tasks 6, 8).
- **Out of scope (correctly absent):** the quiz mechanics (C1); engine + flows (A/B); live follower-count size badges (deferred — no data source).
- **Placeholder scan:** every code step is complete; components given in full.
- **Type consistency:** `GrowthPlan` (Task 1) is the single source consumed by `prompt.ts`, `growth-plan.ts`, `setup.ts`, `growth-plan-reveal.tsx`, `growth-plan-card.tsx`; `generateGrowthPlan(answers, synth, targets)` signature matches its call in `setup-quiz.tsx` (Task 7); `knobsFromProfile` input shape matches Plan A.
- **Open verify items:** `sanitizeForPrompt` import path; `generateStructured` options arg; `knobsFromProfile` input shape; `listProfiles` import path — all flagged inline.
```
