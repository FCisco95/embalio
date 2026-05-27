# Engagement Engine — Spine 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local, subscription-powered onboarding interview that builds an editable brand-voice + goals persona, then generates the owner's first AI-researched original post (with selectable angles) in that voice — all reviewed by a human, nothing auto-posted.

**Architecture:** Extend the existing local Next.js 16 app. Introduce one `generate()` wrapper that runs free on the owner's Claude subscription via the `claude -p` CLI subprocess (with a Gemini free-tier fallback selected by env). Every AI task (voice synthesis, niche research, drafting) calls that wrapper. Live web research is performed *inside* the subscription-backed `claude -p` call using Claude Code's own WebSearch/WebFetch tools. Supabase (local) stays the store; persona fields go directly on `profiles`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (local), Zod 4, Vitest, `claude` CLI (subscription), `@ai-sdk/google` (Gemini fallback), shadcn/ui, Tailwind. `@` alias → `src/`.

**Spec:** `docs/superpowers/specs/2026-05-27-engagement-engine-spine1-design.md`

**Conventions:** TDD (red→green), one logical change per commit, never commit `.env.local`. Local Supabase must be running for the RLS test. Keep `npm test` and `npx tsc --noEmit` green before every commit.

---

## File Structure

```
src/lib/generate/
├── runner.ts          # spawn `claude -p`; injectable CliRunner type
├── runner.test.ts
├── parse.ts           # pure: extract+validate JSON from model text
├── parse.test.ts
├── gemini.ts          # Gemini fallback backend (AI SDK)
├── index.ts           # generateText / generateStructured (backend by env)
└── index.test.ts
src/lib/schemas.ts     # + PersonaSynthesis, AngleList, OriginalDraft
src/lib/voice-prompt.ts# buildVoiceSystem consumes voice_spec; + persona/angle/original prompt builders
src/lib/drafting.ts    # rewired to generate() wrapper (signatures unchanged)
src/server/persona.ts  # buildPersona / savePersona / getPersona ("use server")
src/server/original.ts # proposeAngles / draftFromAngle ("use server")
src/components/onboarding-wizard.tsx   # multi-step interview (client)
src/components/angle-composer.tsx      # angles-then-draft composer (client)
src/app/(app)/profiles/page.tsx        # mount the wizard for new/unconfigured profiles
src/app/(app)/compose/page.tsx         # mount the angle composer
supabase/migrations/0004_persona.sql   # voice_spec, goals, content_pillars, onboarding_answers
```

---

## Task 1: Subscription generation spike (GATING — manual)

**Files:** Create `docs/superpowers/notes/2026-05-27-subscription-spike.md` (findings).

This resolves the central risk: can we generate **headlessly through the Claude subscription**, including **web research returning parseable JSON**? Its outcome sets `GEN_BACKEND` and confirms the CLI flags the wrapper uses.

- [ ] **Step 1: Confirm the CLI exists and is authenticated**

Run: `claude --version`
Expected: prints a version (CLI installed). If missing, STOP — report; the subscription path is unavailable.

- [ ] **Step 2: Plain headless generation**

Run (PowerShell): `"Write one short sentence about agentic AI." | claude -p`
Expected: a one-sentence completion on stdout, exit 0. Confirms subscription-backed print mode works.

- [ ] **Step 3: Headless web research + JSON**

Run:
```
"Search the web for one recent (last 7 days) launch in agentic AI. Respond with ONLY JSON: {\"headline\":\"...\",\"url\":\"...\"}. No prose." | claude -p --allowedTools WebSearch WebFetch
```
Expected: stdout contains a JSON object with a real recent headline+url. Note the EXACT flags that made web tools work non-interactively (candidates if the above is blocked: `--permission-mode acceptEdits`, `--dangerously-skip-permissions`). Record what worked.

- [ ] **Step 4: Record findings + decide backend**

Write `docs/superpowers/notes/2026-05-27-subscription-spike.md` with: whether steps 2–3 succeeded, the exact working `claude -p` invocation + flags, and the decision:
- If steps 2–3 worked → `GEN_BACKEND=subscription` (default); record the research flags for Task 2.
- If they failed → `GEN_BACKEND=gemini`; the owner must create a free Google AI Studio key (`GOOGLE_GENERATIVE_AI_API_KEY`). Note that Gemini web-grounding differs; live research may require the `google` search-grounding option or pasted sources (flag for Task 9).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/notes/2026-05-27-subscription-spike.md
git commit -m "docs: subscription generation spike findings (gen backend decision)"
```

---

## Task 2: `generate()` wrapper — text backend

**Files:**
- Create: `src/lib/generate/runner.ts`, `src/lib/generate/runner.test.ts`, `src/lib/generate/gemini.ts`, `src/lib/generate/index.ts`, `src/lib/generate/index.test.ts`
- Install: `@ai-sdk/google`

- [ ] **Step 1: Install the Gemini fallback provider**

Run: `npm install @ai-sdk/google`
Expected: added to dependencies.

- [ ] **Step 2: Write the failing runner test**

Create `src/lib/generate/runner.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { buildClaudeArgs } from "@/lib/generate/runner";

describe("buildClaudeArgs", () => {
  it("uses print mode and no tools by default", () => {
    expect(buildClaudeArgs({})).toEqual(["-p"]);
  });
  it("allows web tools when research is requested", () => {
    expect(buildClaudeArgs({ research: true })).toEqual(["-p", "--allowedTools", "WebSearch", "WebFetch"]);
  });
});
```

- [ ] **Step 3: Run it — expect fail**

Run: `npm test -- runner`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the runner**

Create `src/lib/generate/runner.ts`:
```ts
import { spawn } from "node:child_process";

export interface RunnerOpts { research?: boolean }
export type CliRunner = (args: string[], stdin: string) => Promise<string>;

// Prompt is passed on stdin (avoids arg-length/escaping limits). Web tools are
// opt-in via --allowedTools; adjust flags per the Task 1 spike findings.
export function buildClaudeArgs(opts: RunnerOpts): string[] {
  const args = ["-p"];
  if (opts.research) args.push("--allowedTools", "WebSearch", "WebFetch");
  return args;
}

export const claudeCliRunner: CliRunner = (args, stdin) =>
  new Promise((resolve, reject) => {
    const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += String(d)));
    child.stderr.on("data", (d) => (err += String(d)));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${err}`))));
    child.stdin.write(stdin);
    child.stdin.end();
  });
```

- [ ] **Step 5: Run it — expect pass**

Run: `npm test -- runner`
Expected: PASS (2 tests).

- [ ] **Step 6: Gemini fallback backend**

Create `src/lib/generate/gemini.ts`:
```ts
import { generateText as aiGenerateText } from "ai";
import { google } from "@ai-sdk/google";

export async function generateTextGemini(prompt: string): Promise<string> {
  const { text } = await aiGenerateText({ model: google("gemini-2.0-flash"), prompt });
  return text;
}
```

- [ ] **Step 7: Write the failing index test**

Create `src/lib/generate/index.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { generateText } from "@/lib/generate";

describe("generateText (subscription backend)", () => {
  it("pipes the prompt to the claude runner and returns trimmed stdout", async () => {
    const runner = vi.fn().mockResolvedValue("  hello world  \n");
    const out = await generateText("say hi", { backend: "subscription" }, runner);
    expect(out).toBe("hello world");
    expect(runner).toHaveBeenCalledWith(["-p"], "say hi");
  });
  it("passes research flags through", async () => {
    const runner = vi.fn().mockResolvedValue("ok");
    await generateText("research X", { backend: "subscription", research: true }, runner);
    expect(runner).toHaveBeenCalledWith(["-p", "--allowedTools", "WebSearch", "WebFetch"], "research X");
  });
});
```

- [ ] **Step 8: Run it — expect fail**

Run: `npm test -- generate/index`
Expected: FAIL (module not found).

- [ ] **Step 9: Implement the wrapper**

Create `src/lib/generate/index.ts`:
```ts
import { buildClaudeArgs, claudeCliRunner, type CliRunner } from "./runner";
import { generateTextGemini } from "./gemini";

export type Backend = "subscription" | "gemini";
export interface GenerateOpts { research?: boolean; backend?: Backend }

function backend(opts: GenerateOpts): Backend {
  return opts.backend ?? (process.env.GEN_BACKEND as Backend) ?? "subscription";
}

export async function generateText(
  prompt: string,
  opts: GenerateOpts = {},
  runner: CliRunner = claudeCliRunner,
): Promise<string> {
  if (backend(opts) === "gemini") return (await generateTextGemini(prompt)).trim();
  const out = await runner(buildClaudeArgs(opts), prompt);
  return out.trim();
}
```

- [ ] **Step 10: Run it — expect pass**

Run: `npm test -- generate/index` then `npx tsc --noEmit`
Expected: PASS (2 tests), tsc clean.

- [ ] **Step 11: Commit**

```bash
git add src/lib/generate/runner.ts src/lib/generate/runner.test.ts src/lib/generate/gemini.ts src/lib/generate/index.ts src/lib/generate/index.test.ts package.json package-lock.json
git commit -m "feat(generate): subscription (claude -p) + gemini text wrapper"
```

---

## Task 3: JSON parse helper + `generateStructured`

**Files:**
- Create: `src/lib/generate/parse.ts`, `src/lib/generate/parse.test.ts`
- Modify: `src/lib/generate/index.ts` (add `generateStructured`)

- [ ] **Step 1: Write the failing parse test**

Create `src/lib/generate/parse.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseStructured } from "@/lib/generate/parse";

const S = z.object({ a: z.string() });

describe("parseStructured", () => {
  it("parses a fenced ```json block", () => {
    const r = parseStructured(S, 'here:\n```json\n{"a":"x"}\n```\nthanks');
    expect(r.ok && r.data.a).toBe("x");
  });
  it("parses a bare object", () => {
    const r = parseStructured(S, '{"a":"y"}');
    expect(r.ok && r.data.a).toBe("y");
  });
  it("fails on invalid shape", () => {
    const r = parseStructured(S, '{"b":1}');
    expect(r.ok).toBe(false);
  });
  it("fails when no JSON present", () => {
    expect(parseStructured(S, "no json here").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — expect fail**

Run: `npm test -- generate/parse`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement parse**

Create `src/lib/generate/parse.ts`:
```ts
import type { ZodType } from "zod";

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const objStart = body.indexOf("{");
  const arrStart = body.indexOf("[");
  const start = [objStart, arrStart].filter((n) => n >= 0).sort((a, b) => a - b)[0];
  if (start === undefined) return null;
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  if (end <= start) return null;
  return body.slice(start, end + 1);
}

export function parseStructured<T>(schema: ZodType<T>, text: string): ParseResult<T> {
  const json = extractJson(text);
  if (!json) return { ok: false, error: "no JSON found" };
  let value: unknown;
  try { value = JSON.parse(json); } catch (e) { return { ok: false, error: `invalid JSON: ${String(e)}` }; }
  const r = schema.safeParse(value);
  return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error.message };
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `npm test -- generate/parse`
Expected: PASS (4 tests).

- [ ] **Step 5: Add `generateStructured` to the wrapper**

Modify `src/lib/generate/index.ts` — append:
```ts
import type { ZodType } from "zod";
import { parseStructured } from "./parse";

export type StructuredResult<T> = { data: T } | { data: null; raw: string };

export async function generateStructured<T>(
  schema: ZodType<T>,
  prompt: string,
  opts: GenerateOpts = {},
  runner: CliRunner = claudeCliRunner,
): Promise<StructuredResult<T>> {
  const ask = `${prompt}\n\nRespond with ONLY valid JSON matching the requested shape. No prose, no markdown fences.`;
  let raw = await generateText(ask, opts, runner);
  let parsed = parseStructured(schema, raw);
  if (!parsed.ok) {
    raw = await generateText(`${ask}\n\nYour previous reply was not valid JSON. Return ONLY the JSON object.`, opts, runner);
    parsed = parseStructured(schema, raw);
  }
  return parsed.ok ? { data: parsed.data } : { data: null, raw };
}
```
Also add `import { claudeCliRunner, type CliRunner } from "./runner";` is already present; ensure `ZodType` import doesn't duplicate.

- [ ] **Step 6: Add a generateStructured test**

Append to `src/lib/generate/index.test.ts`:
```ts
import { z } from "zod";
import { generateStructured } from "@/lib/generate";

describe("generateStructured", () => {
  const S = z.object({ a: z.string() });
  it("returns parsed data on first valid reply", async () => {
    const runner = vi.fn().mockResolvedValue('{"a":"ok"}');
    const r = await generateStructured(S, "make a", { backend: "subscription" }, runner);
    expect("data" in r && r.data && (r.data as { a: string }).a).toBe("ok");
    expect(runner).toHaveBeenCalledTimes(1);
  });
  it("retries once then returns raw on persistent failure", async () => {
    const runner = vi.fn().mockResolvedValue("not json");
    const r = await generateStructured(S, "make a", { backend: "subscription" }, runner);
    expect(r.data).toBeNull();
    expect(runner).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 7: Run + typecheck**

Run: `npm test -- generate` then `npx tsc --noEmit`
Expected: all PASS, tsc clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/generate/parse.ts src/lib/generate/parse.test.ts src/lib/generate/index.ts src/lib/generate/index.test.ts
git commit -m "feat(generate): structured JSON output with parse + one retry"
```

---

## Task 4: Persona columns migration + types

**Files:**
- Create: `supabase/migrations/0004_persona.sql`
- Modify: `src/lib/supabase/types.ts` (regenerated)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0004_persona.sql`:
```sql
alter table profiles
  add column voice_spec text,
  add column goals text,
  add column content_pillars text[] not null default '{}',
  add column onboarding_answers jsonb not null default '{}';
```

- [ ] **Step 2: Apply locally**

Run: `npx supabase db reset`
Expected: applies 0001–0004, no errors.

- [ ] **Step 3: Regenerate types (strip any stray leading line)**

Run: `npx supabase gen types typescript --local > src/lib/supabase/types.ts`
Then open the file and ensure line 1 is valid TS (starts with `export type Json =`); if `gen types` printed a stray "Connecting to ..." line, delete only that line. Confirm `profiles` now has `voice_spec`, `goals`, `content_pillars`, `onboarding_answers`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` then `npm test`
Expected: tsc clean; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_persona.sql src/lib/supabase/types.ts
git commit -m "feat(db): persona columns on profiles (voice_spec, goals, pillars, answers)"
```

---

## Task 5: Schemas + voice-prompt builders

**Files:**
- Modify: `src/lib/schemas.ts` (add `PersonaSynthesis`, `AngleList`, `OriginalDraft`)
- Modify: `src/lib/voice-prompt.ts` (voice_spec-based system; persona/angle/original prompt builders)
- Create: `src/lib/voice-prompt.test.ts` cases (extend existing test file)

- [ ] **Step 1: Add schemas (write test first)**

Append to `src/lib/schemas.test.ts`:
```ts
import { PersonaSynthesis, AngleList, OriginalDraft } from "@/lib/schemas";

describe("PersonaSynthesis", () => {
  it("accepts a synthesized persona", () => {
    const r = PersonaSynthesis.safeParse({ voiceSpec: "lowercase, punchy", contentPillars: ["AI"], seedAccounts: ["@a"], samplePosts: ["gm"] });
    expect(r.success).toBe(true);
  });
});
describe("AngleList", () => {
  it("requires at least one angle with a valid mode", () => {
    const ok = AngleList.safeParse({ angles: [{ mode: "news-insight", hook: "x" }] });
    expect(ok.success).toBe(true);
    const bad = AngleList.safeParse({ angles: [{ mode: "nope", hook: "x" }] });
    expect(bad.success).toBe(false);
  });
});
describe("OriginalDraft", () => {
  it("accepts a single post and a short thread", () => {
    expect(OriginalDraft.safeParse({ posts: ["one"] }).success).toBe(true);
    expect(OriginalDraft.safeParse({ posts: ["a", "b", "c"], suggestedVisual: "chart" }).success).toBe(true);
  });
  it("rejects an empty thread and an over-long post", () => {
    expect(OriginalDraft.safeParse({ posts: [] }).success).toBe(false);
    expect(OriginalDraft.safeParse({ posts: ["x".repeat(281)] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- schemas`
Expected: FAIL (new exports missing).

- [ ] **Step 3: Implement schemas**

Append to `src/lib/schemas.ts`:
```ts
export const PersonaSynthesis = z.object({
  voiceSpec: z.string().min(1),
  contentPillars: z.array(z.string()).min(1),
  seedAccounts: z.array(z.string()).default([]),
  samplePosts: z.array(z.string()).max(3).default([]),
});
export type PersonaSynthesis = z.infer<typeof PersonaSynthesis>;

export const Angle = z.object({
  mode: z.enum(["news-insight", "experiment", "build-in-public"]),
  hook: z.string().min(1),
  source: z.string().optional(),
});
export const AngleList = z.object({ angles: z.array(Angle).min(1).max(5) });
export type Angle = z.infer<typeof Angle>;

export const OriginalDraft = z.object({
  posts: z.array(z.string().min(1).max(280)).min(1).max(7),
  suggestedVisual: z.string().max(500).optional(),
});
export type OriginalDraft = z.infer<typeof OriginalDraft>;
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- schemas`
Expected: PASS.

- [ ] **Step 5: Voice-prompt builders (write test first)**

Append to `src/lib/voice-prompt.test.ts`:
```ts
import { buildVoiceSystemFromSpec, buildSynthesisPrompt, buildAnglesPrompt, buildOriginalFromAnglePrompt } from "@/lib/voice-prompt";

describe("voice spec system", () => {
  it("embeds the voice spec and handle", () => {
    const s = buildVoiceSystemFromSpec({ handle: "@cisco", voice_spec: "lowercase, no emojis" });
    expect(s).toContain("@cisco");
    expect(s).toContain("lowercase, no emojis");
  });
});
describe("synthesis + angle + original prompts", () => {
  it("synthesis prompt includes the answers", () => {
    expect(buildSynthesisPrompt({ niche: "AI", goals: "grow", tone: "punchy" })).toContain("punchy");
  });
  it("angles prompt includes the pillars", () => {
    expect(buildAnglesPrompt(["AI", "agents"])).toContain("agents");
  });
  it("original-from-angle prompt includes the hook", () => {
    expect(buildOriginalFromAnglePrompt("@cisco voice", { mode: "news-insight", hook: "rollups" })).toContain("rollups");
  });
});
```

- [ ] **Step 6: Run — expect fail**

Run: `npm test -- voice-prompt`
Expected: FAIL.

- [ ] **Step 7: Implement builders**

Append to `src/lib/voice-prompt.ts`:
```ts
import type { Angle } from "@/lib/schemas";

export function buildVoiceSystemFromSpec(p: { handle: string; voice_spec: string | null }): string {
  return [
    `You write X (Twitter) posts as the account ${p.handle}.`,
    `Follow this brand-voice spec exactly:`,
    p.voice_spec ?? "(no voice spec yet — be clear, specific, and non-generic)",
    `Never use hashtags unless the spec says to. Never fabricate facts. Each post must be <=280 chars.`,
  ].join("\n\n");
}

export function buildSynthesisPrompt(a: {
  niche: string; goals: string; tone: string; doDont?: string; admired?: string;
}): string {
  return [
    `Synthesize a reusable X brand-voice spec from this onboarding interview.`,
    `Niche: ${a.niche}`,
    `Goals/audience: ${a.goals}`,
    `Desired tone/style: ${a.tone}`,
    a.doDont ? `Do/Don't: ${a.doDont}` : "",
    a.admired ? `Admired accounts: ${a.admired}` : "",
    `Produce: a concrete voiceSpec (casing, length, emoji/hashtag policy, cadence of ideas, what to avoid),`,
    `contentPillars (array), seedAccounts (array of @handles worth engaging in this niche, researched),`,
    `and 2-3 samplePosts written in the synthesized voice.`,
  ].filter(Boolean).join("\n");
}

export function buildAnglesPrompt(pillars: string[]): string {
  return [
    `Research the web for recent (last 7 days) developments across these niche pillars: ${pillars.join(", ")}.`,
    `Propose 3-5 distinct post angles. Each angle has: mode (one of "news-insight", "experiment", "build-in-public"),`,
    `a one-line hook, and a source URL when based on a finding. "experiment" = suggest a concrete thing to test and post about.`,
  ].join("\n");
}

export function buildOriginalFromAnglePrompt(voiceSystem: string, angle: Angle): string {
  return [
    voiceSystem,
    ``,
    `Write an original X post for this angle (mode: ${angle.mode}): "${angle.hook}".`,
    angle.source ? `Source: ${angle.source}` : "",
    `Return a "posts" array (1 post, or 2-5 for a short thread if it genuinely needs it), each <=280 chars,`,
    `plus an optional "suggestedVisual". Informative and specific — no generic filler.`,
  ].filter(Boolean).join("\n");
}
```

- [ ] **Step 8: Run + typecheck**

Run: `npm test -- voice-prompt` and `npm test -- schemas` then `npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 9: Commit**

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts src/lib/voice-prompt.ts src/lib/voice-prompt.test.ts
git commit -m "feat(voice): persona/angle/original prompt builders + Zod schemas"
```

---

## Task 6: Rewire drafting to the generate wrapper

**Files:**
- Modify: `src/lib/drafting.ts` (use `generateStructured` instead of AI SDK Anthropic)
- Modify: `src/lib/drafting.test.ts` (mock the wrapper, not `ai`/`@ai-sdk/anthropic`)

- [ ] **Step 1: Update the test to mock the wrapper**

Replace `src/lib/drafting.test.ts` with:
```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/generate", () => ({
  generateStructured: vi.fn().mockResolvedValue({ data: { body: "gm builders", suggestedVisual: "dashboard screenshot" } }),
}));

import { generateStructured } from "@/lib/generate";
import { draftReply } from "@/lib/drafting";

const profile = { handle: "@cisco", niche_description: "crypto/dev/AI", voice_corpus: ["gm"], voice_notes: null, voice_spec: "lowercase" };

describe("draftReply", () => {
  it("returns a validated DraftOutput via the generate wrapper", async () => {
    const d = await draftReply(profile, "rollups are underrated");
    expect(d.body).toBe("gm builders");
    expect(d.model_used).toBe("subscription");
    expect(generateStructured).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- drafting`
Expected: FAIL (drafting still imports the old path / model_used mismatch).

- [ ] **Step 3: Rewire drafting**

Replace `src/lib/drafting.ts` with:
```ts
import { generateStructured } from "@/lib/generate";
import { DraftOutput } from "@/lib/schemas";
import {
  buildVoiceSystem, buildVoiceSystemFromSpec, buildReplyPrompt, buildOriginalPrompt, type VoiceProfile,
} from "@/lib/voice-prompt";

export interface DraftResult extends DraftOutput { model_used: string }

type Profile = VoiceProfile & { voice_spec?: string | null };

function systemFor(p: Profile): string {
  return p.voice_spec ? buildVoiceSystemFromSpec({ handle: p.handle, voice_spec: p.voice_spec }) : buildVoiceSystem(p);
}

async function run(profile: Profile, userPrompt: string): Promise<DraftResult> {
  const prompt = `${systemFor(profile)}\n\n${userPrompt}\n\nReturn JSON: { "body": string (<=280), "suggestedVisual"?: string }.`;
  const r = await generateStructured(DraftOutput, prompt);
  if (!r.data) throw new Error("model did not return a valid draft");
  return { ...r.data, model_used: (process.env.GEN_BACKEND ?? "subscription") };
}

export function draftReply(profile: Profile, targetTweet: string): Promise<DraftResult> {
  return run(profile, buildReplyPrompt(targetTweet));
}
export function draftOriginal(profile: Profile, topic: string): Promise<DraftResult> {
  return run(profile, buildOriginalPrompt(topic));
}
```

- [ ] **Step 4: Run + typecheck + full suite**

Run: `npm test -- drafting` then `npm test` then `npx tsc --noEmit`
Expected: drafting passes; full suite green (targeting/compose import draftReply/draftOriginal — signatures unchanged); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/drafting.ts src/lib/drafting.test.ts
git commit -m "refactor(drafting): generate via subscription wrapper (voice_spec aware)"
```

---

## Task 7: Persona server actions

**Files:**
- Create: `src/server/persona.ts` (`"use server"`)
- Create: `src/server/persona.test.ts`

- [ ] **Step 1: Write the failing test (synthesis mapping is the testable core)**

Create `src/server/persona.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/generate", () => ({
  generateStructured: vi.fn().mockResolvedValue({
    data: { voiceSpec: "lowercase, punchy", contentPillars: ["AI", "agents"], seedAccounts: ["@balajis"], samplePosts: ["gm"] },
  }),
}));

import { synthesizePersona } from "@/server/persona";

describe("synthesizePersona", () => {
  it("returns the synthesized persona from the model", async () => {
    const p = await synthesizePersona({ niche: "AI", goals: "grow tech twitter", tone: "punchy" });
    expect(p.voiceSpec).toContain("punchy");
    expect(p.contentPillars).toContain("agents");
    expect(p.seedAccounts).toEqual(["@balajis"]);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- persona`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement persona actions**

Create `src/server/persona.ts`:
```ts
"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { PersonaSynthesis } from "@/lib/schemas";
import { buildSynthesisPrompt } from "@/lib/voice-prompt";
import { revalidatePath } from "next/cache";

export interface InterviewAnswers {
  niche: string; goals: string; tone: string; doDont?: string; admired?: string;
}

// Pure-ish: research+synthesize the persona (web tools enabled for seed-account suggestions).
export async function synthesizePersona(a: InterviewAnswers): Promise<PersonaSynthesis> {
  const r = await generateStructured(PersonaSynthesis, buildSynthesisPrompt(a), { research: true });
  if (!r.data) throw new Error("could not synthesize a voice spec — try again");
  return r.data;
}

export async function getPersona(profileId: string) {
  const sb = await supabaseServer();
  const { data } = await sb.from("profiles")
    .select("handle, voice_spec, goals, content_pillars, onboarding_answers").eq("id", profileId).single();
  return data;
}

export async function savePersona(profileId: string, input: {
  voiceSpec: string; goals: string; contentPillars: string[]; answers: InterviewAnswers; seedAccounts: string[];
}) {
  const sb = await supabaseServer();
  const { error } = await sb.from("profiles").update({
    voice_spec: input.voiceSpec, goals: input.goals,
    content_pillars: input.contentPillars, onboarding_answers: input.answers,
  }).eq("id", profileId);
  if (error) throw new Error(error.message);
  for (const handle of input.seedAccounts) {
    const h = handle.trim();
    if (h) await sb.from("seed_targets").insert({ profile_id: profileId, handle: h });
  }
  revalidatePath("/profiles");
}
```

- [ ] **Step 4: Run + typecheck**

Run: `npm test -- persona` then `npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/server/persona.ts src/server/persona.test.ts
git commit -m "feat(persona): synthesize + save brand-voice persona actions"
```

---

## Task 8: Onboarding wizard UI

**Files:**
- Create: `src/components/onboarding-wizard.tsx` (client)
- Modify: `src/app/(app)/profiles/page.tsx` (mount wizard per profile)

- [ ] **Step 1: Build the wizard**

Create `src/components/onboarding-wizard.tsx`:
```tsx
"use client";
import { useState } from "react";
import { synthesizePersona, savePersona, type InterviewAnswers } from "@/server/persona";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Synth = Awaited<ReturnType<typeof synthesizePersona>>;

export function OnboardingWizard({ profileId, defaults }: { profileId: string; defaults?: Partial<InterviewAnswers> }) {
  const [a, setA] = useState<InterviewAnswers>({
    niche: defaults?.niche ?? "AI, agentic & generative AI, new features, GitHub repos, building as a dev",
    goals: defaults?.goals ?? "", tone: defaults?.tone ?? "", doDont: "", admired: "",
  });
  const [synth, setSynth] = useState<Synth | null>(null);
  const [busy, setBusy] = useState(false);
  const upd = (k: keyof InterviewAnswers) => (e: { target: { value: string } }) => setA({ ...a, [k]: e.target.value });

  async function research() {
    setBusy(true);
    try { setSynth(await synthesizePersona(a)); toast.success("Voice spec drafted — review and edit"); }
    catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  }
  async function save() {
    if (!synth) return;
    try {
      await savePersona(profileId, {
        voiceSpec: synth.voiceSpec, goals: a.goals, contentPillars: synth.contentPillars,
        answers: a, seedAccounts: synth.seedAccounts,
      });
      toast.success("Persona saved");
    } catch (e) { toast.error(String(e)); }
  }

  return (
    <div className="space-y-3 max-w-xl border rounded p-3">
      <div className="font-medium text-sm">Brand-voice onboarding</div>
      <Textarea rows={2} placeholder="Niche & content pillars" value={a.niche} onChange={upd("niche")} />
      <Textarea rows={2} placeholder="Growth goal & target audience" value={a.goals} onChange={upd("goals")} />
      <Input placeholder="Tone/style (e.g. lowercase, punchy, technical)" value={a.tone} onChange={upd("tone")} />
      <Input placeholder="Do's / Don'ts (optional)" value={a.doDont} onChange={upd("doDont")} />
      <Input placeholder="Accounts you admire (optional)" value={a.admired} onChange={upd("admired")} />
      <Button disabled={busy} onClick={research}>{busy ? "Researching…" : "Draft my voice + plan"}</Button>
      {synth && (
        <div className="space-y-2 pt-2">
          <Textarea rows={6} value={synth.voiceSpec} onChange={(e) => setSynth({ ...synth, voiceSpec: e.target.value })} />
          <Input value={synth.contentPillars.join(", ")} onChange={(e) => setSynth({ ...synth, contentPillars: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          <Input value={synth.seedAccounts.join(", ")} onChange={(e) => setSynth({ ...synth, seedAccounts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          {synth.samplePosts.length > 0 && <div className="text-xs text-muted-foreground">Samples: {synth.samplePosts.join(" · ")}</div>}
          <Button size="sm" variant="secondary" onClick={save}>Save persona</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount it on the profiles page**

In `src/app/(app)/profiles/page.tsx`, import `OnboardingWizard` and render it inside each profile card area (below the existing seed-target form). Read the current file first; add:
```tsx
import { OnboardingWizard } from "@/components/onboarding-wizard";
// inside the profile list item, after seed targets:
<OnboardingWizard profileId={p.id} />
```
(If profile cards are rendered by `profile-card.tsx`, add `<OnboardingWizard profileId={profile.id} />` there instead — follow the existing structure.)

- [ ] **Step 3: Verify (typecheck + build + browser smoke)**

Run: `npx tsc --noEmit` and `npm run build` → both succeed.
Then with the dev server + a logged-in session: open `/profiles`, create/open a profile, fill the interview, click "Draft my voice + plan", confirm a voice spec returns and "Save persona" persists (reload shows it). NOTE: this requires the generate backend working (Task 1). If `GEN_BACKEND=subscription`, the dev server must be able to spawn `claude`. Report what you observe.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding-wizard.tsx "src/app/(app)/profiles/page.tsx" src/components/profile-card.tsx
git commit -m "feat(ui): brand-voice onboarding wizard"
```

---

## Task 9: Original-post angle + draft actions

**Files:**
- Create: `src/server/original.ts` (`"use server"`)
- Create: `src/server/original.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/original.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/generate", () => ({
  generateStructured: vi.fn()
    .mockResolvedValueOnce({ data: { angles: [{ mode: "news-insight", hook: "rollups", source: "https://x" }] } })
    .mockResolvedValueOnce({ data: { posts: ["rollups are underrated"], suggestedVisual: "diagram" } }),
}));

import { proposeAnglesForPillars, draftFromAngle } from "@/server/original";

describe("original post engine", () => {
  it("proposeAnglesForPillars returns researched angles", async () => {
    const angles = await proposeAnglesForPillars(["AI", "agents"]);
    expect(angles[0].mode).toBe("news-insight");
    expect(angles[0].hook).toBe("rollups");
  });
  it("draftFromAngle returns a thread of posts", async () => {
    const d = await draftFromAngle("@cisco voice", { mode: "news-insight", hook: "rollups" });
    expect(d.posts[0]).toContain("rollups");
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- original`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/server/original.ts`:
```ts
"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { AngleList, OriginalDraft, type Angle } from "@/lib/schemas";
import { buildAnglesPrompt, buildOriginalFromAnglePrompt, buildVoiceSystemFromSpec } from "@/lib/voice-prompt";
import { revalidatePath } from "next/cache";

export async function proposeAnglesForPillars(pillars: string[]): Promise<Angle[]> {
  const r = await generateStructured(AngleList, buildAnglesPrompt(pillars), { research: true });
  if (!r.data) throw new Error("could not research angles — try again");
  return r.data.angles;
}

export async function draftFromAngle(voiceSystem: string, angle: Angle): Promise<OriginalDraft> {
  const r = await generateStructured(OriginalDraft, buildOriginalFromAnglePrompt(voiceSystem, angle));
  if (!r.data) throw new Error("could not draft this angle — try again");
  return r.data;
}

// Convenience action used by the UI: research + draft for a profile, persist the draft.
export async function composeOriginalForProfile(profileId: string, angle: Angle) {
  const sb = await supabaseServer();
  const { data: profile, error } = await sb.from("profiles").select("handle, voice_spec").eq("id", profileId).single();
  if (error || !profile) throw new Error("profile not found");
  const voiceSystem = buildVoiceSystemFromSpec({ handle: profile.handle, voice_spec: profile.voice_spec });
  const draft = await draftFromAngle(voiceSystem, angle);
  const body = draft.posts.join("\n\n");
  const { data, error: insErr } = await sb.from("drafts").insert({
    profile_id: profileId, kind: "original", body, suggested_visual: draft.suggestedVisual,
    model_used: process.env.GEN_BACKEND ?? "subscription",
  }).select().single();
  if (insErr) throw new Error(insErr.message);
  revalidatePath("/compose");
  return { draft, saved: data };
}

export async function getProfilePillars(profileId: string): Promise<string[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("profiles").select("content_pillars").eq("id", profileId).single();
  return data?.content_pillars ?? [];
}
```

- [ ] **Step 4: Run + typecheck**

Run: `npm test -- original` then `npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/server/original.ts src/server/original.test.ts
git commit -m "feat(original): research angles + draft original post from angle"
```

---

## Task 10: Angle composer UI

**Files:**
- Create: `src/components/angle-composer.tsx` (client)
- Modify: `src/app/(app)/compose/page.tsx`

- [ ] **Step 1: Build the composer**

Create `src/components/angle-composer.tsx`:
```tsx
"use client";
import { useState } from "react";
import { proposeAnglesForPillars, composeOriginalForProfile, getProfilePillars } from "@/server/original";
import type { Angle } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function AngleComposer({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [angles, setAngles] = useState<Angle[]>([]);
  const [body, setBody] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function research() {
    setBusy(true);
    try {
      const pillars = await getProfilePillars(profileId);
      if (pillars.length === 0) { toast.error("Run onboarding first to set content pillars"); return; }
      setAngles(await proposeAnglesForPillars(pillars));
    } catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  }
  async function pick(angle: Angle) {
    setBusy(true);
    try { const { draft } = await composeOriginalForProfile(profileId, angle); setBody(draft.posts.join("\n\n")); toast.success("Drafted"); }
    catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 max-w-xl">
      <select className="border rounded px-2 py-1" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
        {profiles.map((p) => <option key={p.id} value={p.id}>{p.handle}</option>)}
      </select>
      <Button disabled={busy} onClick={research}>{busy ? "Researching…" : "Research angles"}</Button>
      {angles.length > 0 && (
        <div className="space-y-2">
          {angles.map((a, i) => (
            <div key={i} className="border rounded p-2 text-sm flex items-center justify-between gap-2">
              <span><span className="text-muted-foreground">[{a.mode}]</span> {a.hook}</span>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => pick(a)}>Draft this</Button>
            </div>
          ))}
        </div>
      )}
      {body && (
        <div className="space-y-2">
          <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button size="sm" onClick={() => { navigator.clipboard.writeText(body); toast.success("Copied"); }}>Copy</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount on the compose page**

Replace the body of `src/app/(app)/compose/page.tsx` to render the new composer (keep the existing `Composer` import removed or alongside — read the file first):
```tsx
import { listProfiles } from "@/server/profiles";
import { AngleComposer } from "@/components/angle-composer";

export default async function ComposePage() {
  const profiles = (await listProfiles()) ?? [];
  return <div className="p-6"><h1 className="text-xl font-semibold mb-3">Compose</h1><AngleComposer profiles={profiles} /></div>;
}
```

- [ ] **Step 3: Verify (typecheck + build + browser smoke)**

Run: `npx tsc --noEmit` and `npm run build` → succeed.
With dev server + a profile that has saved pillars: open `/compose`, click "Research angles", confirm angles list; click "Draft this", confirm an in-voice draft appears and Copy works. Requires the generate backend (Task 1). Report observations.

- [ ] **Step 4: Commit**

```bash
git add src/components/angle-composer.tsx "src/app/(app)/compose/page.tsx"
git commit -m "feat(ui): angle-research composer for original posts"
```

---

## Task 11: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Tests + typecheck + build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all tests pass, tsc clean, production build succeeds.

- [ ] **Step 2: End-to-end manual smoke (with the working generate backend)**

Log in locally → `/profiles`: run onboarding for a profile → save persona (voice_spec + pillars + seed accounts persist). → `/compose`: research angles → draft one → edit → copy. Confirm the draft reads in-voice and informative.

- [ ] **Step 3: Commit any fixes, then summarize**

Commit fixes if needed. Report final state: tests count, build status, and whether the live subscription generation produced a usable persona + post.

---

## Self-Review

**Spec coverage:**
- Subscription generation wrapper + Gemini fallback + Step 0 spike → Tasks 1, 2, 3. ✓
- Onboarding interview → synthesized editable voice spec + proposed pillars/seed accounts → Tasks 5 (prompts), 7 (actions), 8 (UI). ✓
- Persona stored on `profiles` (voice_spec, goals, content_pillars, onboarding_answers) → Task 4. ✓
- Voice-spec-driven generation (supersedes corpus) → Tasks 5, 6. ✓
- Original-post flow: live research → angles (news-insight / experiment / build-in-public) → draft (single or short thread) + suggested visual → review/copy → Tasks 5, 9, 10. ✓
- Human-in-the-loop, nothing auto-posts → drafts are copied out manually (Tasks 8, 10). ✓
- Reuse Supabase; drafts table unchanged → Tasks 4, 9. ✓
- Error handling (generation failure surfaced; parse retry then raw; research empty) → Tasks 3, 6, 7, 9. ✓

**Out of scope (correctly absent):** reply cues at scale, account-research planner, metrics/strategy loop, deployment, auto-posting.

**Placeholder scan:** No TBD/TODO; every code step has complete code. Task 1 (spike) and the UI smoke steps are manual by nature with exact commands. ✓

**Type consistency:** `generateText`/`generateStructured(schema, prompt, opts, runner)` consistent across Tasks 2–3 and consumers (6, 7, 9). `PersonaSynthesis`/`AngleList`/`Angle`/`OriginalDraft` defined in Task 5, used in 7/9/10. `InterviewAnswers` defined in Task 7, used in 8. `buildVoiceSystemFromSpec`/`buildSynthesisPrompt`/`buildAnglesPrompt`/`buildOriginalFromAnglePrompt` defined in Task 5, used in 6/7/9. ✓

**Risk note:** Tasks 8–10 live smoke depends on Task 1's outcome (subscription vs gemini). If `GEN_BACKEND=gemini`, live web research in Tasks 9/10 is weaker — angles may need a search-grounding option or a pasted source; acceptable for Spine 1, flagged.
