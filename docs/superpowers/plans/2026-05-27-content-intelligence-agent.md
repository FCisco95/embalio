# Content Intelligence Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current angle-composer with a full content intelligence agent — a "Generate this week's posts" flow that researches the world in parallel, cross-references with what Cisco is actually building, and produces 3-5 posts + a daily reply queue, all sounding like a builder texting a peer.

**Architecture:** Shared infrastructure (schemas + handoff reader + prompt builders) feeds two parallel features: (1) weekly post generation via parallel research → synthesis → batch drafting, and (2) reply queue generation via seed account scanning → filter → parallel reply drafts. Both run through the existing `generateText`/`generateStructured` wrappers — no new infrastructure needed.

**Tech Stack:** Next.js App Router, Vitest, Zod, `generateText`/`generateStructured` wrappers over `claude -p`, Supabase (read-only for new features)

---

## Task 1: New schemas

**Files:**
- Modify: `src/lib/schemas.ts`
- Modify: `src/lib/schemas.test.ts`

- [ ] **Step 1: Write failing tests for new schemas**

Add to `src/lib/schemas.test.ts`:

```typescript
import { WeeklyAngle, WeeklyAngleList, WeeklyPost, WeeklyPostPlan, ReplyCandidate, ReplyCandidateList, ReplyDraft, ReplyOpportunity, ReplyQueue } from "@/lib/schemas";

describe("WeeklyAngle", () => {
  it("accepts all valid formats", () => {
    for (const format of ["quick-take", "experiment", "tool-find", "observation", "reaction"] as const) {
      expect(WeeklyAngle.safeParse({ format, hook: "test hook", connection: "why" }).success).toBe(true);
    }
  });
  it("rejects unknown format", () => {
    expect(WeeklyAngle.safeParse({ format: "newsletter", hook: "x", connection: "y" }).success).toBe(false);
  });
  it("allows source and sourceDate to be omitted", () => {
    expect(WeeklyAngle.safeParse({ format: "quick-take", hook: "x", connection: "y" }).success).toBe(true);
  });
});

describe("WeeklyAngleList", () => {
  it("accepts 1-5 angles", () => {
    const angle = { format: "quick-take", hook: "x", connection: "y" };
    expect(WeeklyAngleList.safeParse({ angles: [angle] }).success).toBe(true);
    expect(WeeklyAngleList.safeParse({ angles: [angle, angle, angle, angle, angle] }).success).toBe(true);
  });
  it("rejects empty array", () => {
    expect(WeeklyAngleList.safeParse({ angles: [] }).success).toBe(false);
  });
  it("rejects more than 5 angles", () => {
    const angle = { format: "quick-take", hook: "x", connection: "y" };
    expect(WeeklyAngleList.safeParse({ angles: Array(6).fill(angle) }).success).toBe(false);
  });
});

describe("WeeklyPost", () => {
  it("accepts a valid weekly post", () => {
    expect(WeeklyPost.safeParse({
      format: "experiment",
      hook: "tried X",
      posts: ["ran it, broke it"],
      context: "relevant because",
    }).success).toBe(true);
  });
  it("requires at least one post string", () => {
    expect(WeeklyPost.safeParse({ format: "quick-take", hook: "x", posts: [], context: "y" }).success).toBe(false);
  });
  it("allows source, sourceDate, suggestedVisual to be omitted", () => {
    expect(WeeklyPost.safeParse({ format: "quick-take", hook: "x", posts: ["short take"], context: "y" }).success).toBe(true);
  });
});

describe("WeeklyPostPlan", () => {
  it("accepts a plan with posts", () => {
    const post = { format: "quick-take", hook: "x", posts: ["take"], context: "y" };
    expect(WeeklyPostPlan.safeParse({ weekOf: "May 27, 2026", posts: [post] }).success).toBe(true);
  });
});

describe("ReplyCandidate", () => {
  it("accepts a valid candidate with defaults", () => {
    expect(ReplyCandidate.safeParse({ targetHandle: "@kaito", targetPost: "Why MacBook?", reason: "technical" }).success).toBe(true);
  });
});

describe("ReplyDraft", () => {
  it("accepts a reply", () => {
    expect(ReplyDraft.safeParse({ reply: "Apple integrates CPU and GPU on same die.", skip: false }).success).toBe(true);
  });
  it("accepts a skip signal", () => {
    expect(ReplyDraft.safeParse({ skip: true }).success).toBe(true);
  });
});

describe("ReplyOpportunity", () => {
  it("requires a reply string", () => {
    expect(ReplyOpportunity.safeParse({ targetHandle: "@k", targetPost: "post", reason: "r", reply: "fact." }).success).toBe(true);
    expect(ReplyOpportunity.safeParse({ targetHandle: "@k", targetPost: "post", reason: "r" }).success).toBe(false);
  });
});

describe("ReplyQueue", () => {
  it("accepts an empty opportunities array", () => {
    expect(ReplyQueue.safeParse({ generatedAt: "May 27, 2026", opportunities: [] }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/lib/schemas.test.ts
```

Expected: multiple failures — types not yet exported.

- [ ] **Step 3: Add new schemas to `src/lib/schemas.ts`**

Append to the end of the file (after the existing `OriginalDraft` export):

```typescript
export const WeeklyAngle = z.object({
  format: z.enum(["quick-take", "experiment", "tool-find", "observation", "reaction"]),
  hook: z.string().min(1),
  connection: z.string(),
  source: z.string().optional(),
  sourceDate: z.string().optional(),
});
export const WeeklyAngleList = z.object({ angles: z.array(WeeklyAngle).min(1).max(5) });
export type WeeklyAngle = z.infer<typeof WeeklyAngle>;

export const WeeklyPost = z.object({
  format: z.enum(["quick-take", "experiment", "tool-find", "observation", "reaction"]),
  hook: z.string(),
  posts: z.array(z.string().min(1).max(280)).min(1).max(7),
  context: z.string(),
  source: z.string().optional(),
  sourceDate: z.string().optional(),
  suggestedVisual: z.string().optional(),
});
export type WeeklyPost = z.infer<typeof WeeklyPost>;

export const WeeklyPostPlan = z.object({
  weekOf: z.string(),
  posts: z.array(WeeklyPost).min(1).max(5),
});
export type WeeklyPostPlan = z.infer<typeof WeeklyPostPlan>;

export const ReplyCandidate = z.object({
  targetHandle: z.string(),
  targetPost: z.string(),
  targetUrl: z.string().default(""),
  targetLikes: z.number().default(0),
  postedAt: z.string().default(""),
  reason: z.string(),
});
export const ReplyCandidateList = z.object({ opportunities: z.array(ReplyCandidate) });
export type ReplyCandidate = z.infer<typeof ReplyCandidate>;

export const ReplyDraft = z.object({
  reply: z.string().max(560).optional(),
  skip: z.boolean().default(false),
});
export type ReplyDraft = z.infer<typeof ReplyDraft>;

export const ReplyOpportunity = ReplyCandidate.extend({
  reply: z.string().max(560),
});
export type ReplyOpportunity = z.infer<typeof ReplyOpportunity>;

export const ReplyQueue = z.object({
  generatedAt: z.string(),
  opportunities: z.array(ReplyOpportunity).min(0).max(5),
});
export type ReplyQueue = z.infer<typeof ReplyQueue>;
```

- [ ] **Step 4: Run tests — all should pass**

```
npx vitest run src/lib/schemas.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add src/lib/schemas.ts src/lib/schemas.test.ts
git commit -m "feat(schemas): add WeeklyPost, WeeklyPostPlan, ReplyCandidate, ReplyOpportunity, ReplyQueue"
```

---

## Task 2: Handoff reader

**Files:**
- Create: `src/lib/handoff-reader.ts`
- Create: `src/lib/handoff-reader.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/handoff-reader.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs/promises";

vi.mock("node:fs/promises");

import { readHandoff } from "@/lib/handoff-reader";

describe("readHandoff", () => {
  it("returns the full handoff text when file exists", async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce("# Resonance Handoff\n\n## What was built\n\nSpine 1" as unknown as Buffer);
    const text = await readHandoff();
    expect(text).toContain("Spine 1");
  });

  it("returns a fallback string when file does not exist", async () => {
    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("ENOENT"));
    const text = await readHandoff();
    expect(text).toContain("no handoff file found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/lib/handoff-reader.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/handoff-reader.ts`**

```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function readHandoff(): Promise<string> {
  try {
    const filePath = join(process.cwd(), "docs", "HANDOFF.md");
    return await readFile(filePath, "utf-8");
  } catch {
    return "(no handoff file found — describe what you're building in the journal entry above)";
  }
}
```

- [ ] **Step 4: Run tests — all should pass**

```
npx vitest run src/lib/handoff-reader.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```
git add src/lib/handoff-reader.ts src/lib/handoff-reader.test.ts
git commit -m "feat(handoff-reader): read docs/HANDOFF.md for cisco context block"
```

---

## Task 3: New prompt builders

**Files:**
- Modify: `src/lib/voice-prompt.ts`
- Modify: `src/lib/voice-prompt.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/lib/voice-prompt.test.ts`:

```typescript
import {
  buildCiscoContextBlock,
  buildWorldResearchPrompt,
  buildCrossRefSynthesisPrompt,
  buildWeeklyDraftPrompt,
  buildAlgorithmRulesBlock,
  buildSeedScanPrompt,
  buildReplyFilterPrompt,
  buildReplyDraftPrompt,
} from "@/lib/voice-prompt";

describe("buildCiscoContextBlock", () => {
  it("includes handle, voice spec, pillars, and handoff text", () => {
    const block = buildCiscoContextBlock(
      { handle: "@cisco", voice_spec: "lowercase, no hype", content_pillars: ["AI", "agents"] },
      "## What was built\n\nSpine 1"
    );
    expect(block).toContain("@cisco");
    expect(block).toContain("lowercase, no hype");
    expect(block).toContain("AI");
    expect(block).toContain("Spine 1");
  });

  it("includes journal entry when provided", () => {
    const block = buildCiscoContextBlock(
      { handle: "@cisco", voice_spec: "spec", content_pillars: [] },
      "handoff text",
      "shipped the handoff reader"
    );
    expect(block).toContain("shipped the handoff reader");
  });

  it("omits journal entry section when not provided", () => {
    const block = buildCiscoContextBlock(
      { handle: "@cisco", voice_spec: "spec", content_pillars: [] },
      "handoff text"
    );
    expect(block).not.toContain("working on this week");
  });
});

describe("buildWorldResearchPrompt", () => {
  it("x-topics prompt references the date and 48h window", () => {
    const p = buildWorldResearchPrompt("x-topics", "May 27, 2026");
    expect(p).toContain("May 27, 2026");
    expect(p).toContain("48 hours");
  });
  it("github prompt fetches github.com/trending", () => {
    expect(buildWorldResearchPrompt("github", "May 27, 2026")).toContain("github.com/trending");
  });
  it("news prompt mentions Anthropic and OpenAI", () => {
    expect(buildWorldResearchPrompt("news", "May 27, 2026")).toContain("Anthropic");
  });
});

describe("buildCrossRefSynthesisPrompt", () => {
  it("includes cisco context, all three research threads, and date", () => {
    const p = buildCrossRefSynthesisPrompt(
      "cisco context block",
      { xTopics: "topic A", github: "repo B", news: "news C" },
      "May 27, 2026"
    );
    expect(p).toContain("cisco context block");
    expect(p).toContain("topic A");
    expect(p).toContain("repo B");
    expect(p).toContain("news C");
    expect(p).toContain("May 27, 2026");
  });
  it("includes the WeeklyAngleList JSON shape instruction", () => {
    const p = buildCrossRefSynthesisPrompt("ctx", { xTopics: "", github: "", news: "" }, "today");
    expect(p).toContain("quick-take");
    expect(p).toContain("experiment");
  });
});

describe("buildWeeklyDraftPrompt", () => {
  it("includes voice system and angle hook", () => {
    const p = buildWeeklyDraftPrompt("cisco voice system", { format: "experiment", hook: "ran vitest" }, "");
    expect(p).toContain("cisco voice system");
    expect(p).toContain("ran vitest");
  });
  it("includes format-specific instructions", () => {
    const exp = buildWeeklyDraftPrompt("v", { format: "experiment", hook: "test" }, "");
    expect(exp).toContain("what I tried");
    const qt = buildWeeklyDraftPrompt("v", { format: "quick-take", hook: "test" }, "");
    expect(qt).toContain("200 chars");
  });
  it("appends algorithm rules when provided", () => {
    const p = buildWeeklyDraftPrompt("v", { format: "quick-take", hook: "test" }, "end with a question");
    expect(p).toContain("end with a question");
  });
  it("includes anti-AI-tell rules", () => {
    const p = buildWeeklyDraftPrompt("v", { format: "quick-take", hook: "test" }, "");
    expect(p).toContain("em dashes");
    expect(p).toContain("game-changer");
  });
});

describe("buildAlgorithmRulesBlock", () => {
  it("returns empty string (stub)", () => {
    expect(buildAlgorithmRulesBlock("quick-take")).toBe("");
    expect(buildAlgorithmRulesBlock("experiment")).toBe("");
  });
});

describe("buildSeedScanPrompt", () => {
  it("includes all handles and the date", () => {
    const p = buildSeedScanPrompt(["@karpathy", "@simonw"], "May 27, 2026");
    expect(p).toContain("@karpathy");
    expect(p).toContain("@simonw");
    expect(p).toContain("May 27, 2026");
    expect(p).toContain("24 hours");
  });
});

describe("buildReplyFilterPrompt", () => {
  it("includes cisco context and scanned posts", () => {
    const p = buildReplyFilterPrompt("post A by @kaito", "cisco context");
    expect(p).toContain("post A by @kaito");
    expect(p).toContain("cisco context");
  });
  it("includes the ReplyCandidateList JSON shape", () => {
    expect(buildReplyFilterPrompt("posts", "ctx")).toContain("targetHandle");
  });
});

describe("buildReplyDraftPrompt", () => {
  it("includes the voice system and target post", () => {
    const p = buildReplyDraftPrompt("cisco voice", { targetHandle: "@kaito", targetPost: "Why MacBook?", reason: "technical" });
    expect(p).toContain("cisco voice");
    expect(p).toContain("Why MacBook?");
    expect(p).toContain("@kaito");
  });
  it("includes the no-preamble rule", () => {
    const p = buildReplyDraftPrompt("v", { targetHandle: "@k", targetPost: "post", reason: "r" });
    expect(p).toContain("great question");
  });
  it("includes the skip signal instruction", () => {
    const p = buildReplyDraftPrompt("v", { targetHandle: "@k", targetPost: "post", reason: "r" });
    expect(p).toContain('skip');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/lib/voice-prompt.test.ts
```

Expected: many failures — new functions not yet exported.

- [ ] **Step 3: Add new prompt builders to `src/lib/voice-prompt.ts`**

Append to end of `src/lib/voice-prompt.ts`:

```typescript
import type { WeeklyAngle } from "@/lib/schemas";

export function buildCiscoContextBlock(
  profile: { handle: string; voice_spec: string | null; content_pillars: string[] },
  handoffText: string,
  journalEntry?: string
): string {
  return [
    `You are generating content for ${profile.handle}.`,
    `Voice spec: ${profile.voice_spec ?? "(none yet — be lowercase, concrete, first-person)"}`,
    `Content pillars: ${profile.content_pillars.join(", ")}`,
    `Current projects and context:\n${handoffText}`,
    journalEntry ? `What ${profile.handle} is working on this week: ${journalEntry}` : "",
  ].filter(Boolean).join("\n\n");
}

export function buildWorldResearchPrompt(thread: "x-topics" | "github" | "news", date: string): string {
  if (thread === "x-topics") {
    return `Search X/Twitter for the most discussed topics in AI, developer tools, and crypto right now. Today is ${date}. Only include posts from the last 48 hours — skip anything older. For each topic give: the subject, approximate engagement level (viral/high/medium), 1-2 representative post excerpts, and the date. Return 3-5 topics as plain text.`;
  }
  if (thread === "github") {
    return `Fetch https://github.com/trending and https://github.com/trending?since=weekly. Today is ${date}. Filter for repos related to: AI tools, agentic workflows, LLMs, developer infrastructure, crypto/web3 tooling. For each relevant repo give: name, star count, one-sentence description, and why a builder in AI/agentic/crypto might care. Return 3-5 repos as plain text.`;
  }
  return `Search for major tech announcements, model releases, pricing changes, and developer-relevant news from the last 48 hours. Today is ${date}. Focus on: Anthropic, OpenAI, AI tooling, developer infrastructure, crypto/web3. For each item give: headline, date, source URL, and a one-sentence summary. Return 3-5 items as plain text.`;
}

export function buildCrossRefSynthesisPrompt(
  ciscoContext: string,
  research: { xTopics: string; github: string; news: string },
  date: string
): string {
  return [
    ciscoContext,
    `---`,
    `Today is ${date}. Here is what is happening in the world right now:`,
    `X/Twitter hot topics:\n${research.xTopics}`,
    `GitHub trending:\n${research.github}`,
    `Tech news:\n${research.news}`,
    `---`,
    `Find 3-5 post angles for this week. One per format: quick-take, experiment, tool-find, observation, reaction.`,
    `Rules:`,
    `- Only propose an angle if the connection to this person is real, not forced.`,
    `- For "reaction": only include if this person directly uses or has experience with the thing discussed. Skip and add a second "observation" if not.`,
    `- For "tool-find": only include if a GitHub repo genuinely overlaps their work.`,
    `- Never pad to hit 5 — 3 strong angles beats 5 weak ones.`,
    `Return exactly this JSON shape:`,
    `{"angles": [{"format": "quick-take"|"experiment"|"tool-find"|"observation"|"reaction", "hook": "one line", "connection": "why this fits this person specifically", "source": "https://..." (optional), "sourceDate": "May 27, 2026" (optional)}]}`,
  ].filter(Boolean).join("\n\n");
}

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  "quick-take": `Write a quick-take post. 1-3 sentences max. No setup. State the opinion directly. Under 200 chars preferred.`,
  "experiment": `Write an experiment post. Structure: what I tried → what happened → what I learned. 4-8 sentences, one per line. End with one genuine question that invites replies ("anyone else hit this?" or "what do you use for X?").`,
  "tool-find": `Write a tool-find post about this repo/tool. Structure: what it is (one sentence) → what I find interesting about it specifically → what I'd use it for. 3-5 sentences. Must reference my specific context, not generic "useful for developers".`,
  "observation": `Write an observation post. Pattern I've noticed while building → what it means → my take. Use confident labeling ("that's not a coincidence, that's X"). Qualify honestly before the punch. Use a pivot question ("but for [your audience]?") to reframe if it fits. 4-8 sentences, one per line.`,
  "reaction": `Write a reaction post. Structure: before state → trigger/event → now state → numbers/proof if available. Narrative arc, one sentence per line. Suggest a suggestedVisual if there is a screenshot or metric I could attach.`,
};

export function buildWeeklyDraftPrompt(
  voiceSystem: string,
  angle: Pick<WeeklyAngle, "format" | "hook" | "source" | "sourceDate">,
  algorithmRules: string
): string {
  return [
    voiceSystem,
    `Write a post for this angle (format: ${angle.format}): "${angle.hook}"`,
    angle.source ? `Source: ${angle.source}${angle.sourceDate ? ` (${angle.sourceDate})` : ""}` : "",
    FORMAT_INSTRUCTIONS[angle.format] ?? "",
    algorithmRules,
    `Anti-AI-tell rules: no em dashes (—), no "delve", "game-changer", "revolutionary", "it's worth noting", "in conclusion". No rhetorical questions as hooks. Write like a builder texting a peer.`,
    `Voice rules: lowercase sentence starts. first-person ("I ran X" not "X has been shown to"). one sentence per line for multi-line posts. specific over vague — name the tool, the number, the date. real numbers when available. max 1 emoji, only if genuinely earned.`,
    `Return exactly this JSON: {"posts": ["..."], "suggestedVisual": "..."} (suggestedVisual optional.)`,
  ].filter(Boolean).join("\n\n");
}

export function buildAlgorithmRulesBlock(_format: string): string {
  // Stub — Cisco's 10 X algorithm skills will populate this when complete.
  return "";
}

export function buildSeedScanPrompt(handles: string[], date: string): string {
  return [
    `Search X/Twitter for recent posts from these accounts: ${handles.join(", ")}.`,
    `Today is ${date}. Only include posts from the last 24 hours — skip anything older.`,
    `For each post found, give: author handle, the post text, approximate like count, post date/time, and post URL if available.`,
    `Focus on posts that ask questions, make technical claims, share data, or make statements that a builder in AI/dev/crypto could add genuine technical information to.`,
    `Return as plain text, one post per section.`,
  ].join("\n");
}

export function buildReplyFilterPrompt(scannedPosts: string, ciscoContext: string): string {
  return [
    ciscoContext,
    `---`,
    `Here are recent posts from seed accounts:\n${scannedPosts}`,
    `---`,
    `Select 3-5 posts worth replying to. A post is worth replying to if:`,
    `1. This person has direct technical knowledge about the topic`,
    `2. The reply would add information the original post did not have`,
    `3. The post has engagement potential (asking a question, making a claim, inviting discussion)`,
    `4. The post is recent (less than 24h old)`,
    `Skip posts that are: pure reshares, opinions with no technical hook, or topics this person has no specific knowledge about.`,
    `Return exactly this JSON:`,
    `{"opportunities": [{"targetHandle": "@handle", "targetPost": "the post text", "targetUrl": "url or empty string", "targetLikes": 0, "postedAt": "date string", "reason": "one sentence: why reply here"}]}`,
  ].filter(Boolean).join("\n\n");
}

export function buildReplyDraftPrompt(
  voiceSystem: string,
  opportunity: { targetHandle: string; targetPost: string; reason: string }
): string {
  return [
    voiceSystem,
    `Draft a reply to this post by ${opportunity.targetHandle}:\n"${opportunity.targetPost}"`,
    `Reply rules:`,
    `- Start with the core technical fact. No "great question", no wind-up, no restating what they said.`,
    `- Second sentence explains the implication of that fact, or gives a contrast.`,
    `- Stop at 2-4 sentences. Do not list multiple reasons.`,
    `- If you have nothing genuinely technical or specific to add, return {"skip": true} instead.`,
    `- Never sycophantic openers. Never summarize the original post. Add information it did not have.`,
    `Return exactly this JSON: {"reply": "...", "skip": false} or {"skip": true}`,
  ].filter(Boolean).join("\n\n");
}
```

- [ ] **Step 4: Run tests — all should pass**

```
npx vitest run src/lib/voice-prompt.test.ts
```

Expected: all pass.

- [ ] **Step 5: Run full test suite to check nothing broke**

```
npx vitest run
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```
git add src/lib/voice-prompt.ts src/lib/voice-prompt.test.ts
git commit -m "feat(voice-prompt): add weekly post + reply queue prompt builders"
```

---

## Task 4: generateWeeklyPosts server action

**Files:**
- Modify: `src/server/original.ts`
- Modify: `src/server/original.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/server/original.test.ts` (after existing mocks and imports):

```typescript
// Add to the existing vi.mock at the top — replace the whole mock block:
vi.mock("@/lib/generate", () => ({
  generateStructured: vi.fn()
    // existing calls used by proposeAnglesForPillars and draftFromAngle
    .mockResolvedValueOnce({ data: { angles: [{ mode: "news-insight", hook: "rollups", source: "https://x" }] } })
    .mockResolvedValueOnce({ data: { posts: ["rollups are underrated"], suggestedVisual: "diagram" } }),
  generateText: vi.fn()
    .mockResolvedValue("some research text"),
}));

// Add new mock for supabase
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { handle: "@cisco", voice_spec: "lowercase", content_pillars: ["AI"] },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/handoff-reader", () => ({
  readHandoff: vi.fn().mockResolvedValue("Spine 1 was built"),
}));
```

Add new test describe block:

```typescript
describe("generateWeeklyPosts", () => {
  it("returns a WeeklyPostPlan with at least one post", async () => {
    // Reset mocks for this test
    const { generateStructured, generateText } = await import("@/lib/generate");
    vi.mocked(generateText).mockResolvedValue("research text");
    vi.mocked(generateStructured)
      .mockResolvedValueOnce({
        data: {
          angles: [
            { format: "quick-take", hook: "vitest is fast", connection: "cisco uses vitest", source: undefined, sourceDate: undefined },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: { posts: ["vitest is faster than jest"], suggestedVisual: undefined },
      });

    const { generateWeeklyPosts } = await import("@/server/original");
    const plan = await generateWeeklyPosts("profile-123");
    expect(plan.posts.length).toBeGreaterThan(0);
    expect(plan.posts[0].format).toBe("quick-take");
    expect(plan.posts[0].posts[0]).toContain("vitest");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/server/original.test.ts
```

Expected: FAIL — `generateWeeklyPosts` not exported.

- [ ] **Step 3: Add `generateWeeklyPosts` to `src/server/original.ts`**

Add imports at the top (after existing imports):

```typescript
import { generateText } from "@/lib/generate";
import { WeeklyAngleList, WeeklyPostPlan, WeeklyPost } from "@/lib/schemas";
import {
  buildCiscoContextBlock,
  buildWorldResearchPrompt,
  buildCrossRefSynthesisPrompt,
  buildWeeklyDraftPrompt,
  buildAlgorithmRulesBlock,
} from "@/lib/voice-prompt";
import { readHandoff } from "@/lib/handoff-reader";
```

Add function at the end of `src/server/original.ts`:

```typescript
export async function generateWeeklyPosts(profileId: string, journalEntry?: string): Promise<WeeklyPostPlan> {
  const sb = await supabaseServer();

  // Step 1: Load context
  const { data: profile, error } = await sb
    .from("profiles")
    .select("handle, voice_spec, content_pillars")
    .eq("id", profileId)
    .single();
  if (error || !profile) throw new Error("profile not found");

  const handoffText = await readHandoff();
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const ciscoContext = buildCiscoContextBlock(profile, handoffText, journalEntry);
  const voiceSystem = buildVoiceSystemFromSpec({ handle: profile.handle, voice_spec: profile.voice_spec });

  // Step 2: Parallel research
  const [xTopics, github, news] = await Promise.all([
    generateText(buildWorldResearchPrompt("x-topics", date), { research: true }),
    generateText(buildWorldResearchPrompt("github", date), { research: true }),
    generateText(buildWorldResearchPrompt("news", date), { research: true }),
  ]);

  // Step 3: Synthesis
  const synthesis = await generateStructured(
    WeeklyAngleList,
    buildCrossRefSynthesisPrompt(ciscoContext, { xTopics, github, news }, date)
  );
  if (!synthesis.data) throw new Error("could not find angles — try again");

  // Step 4: Draft in parallel
  const draftResults = await Promise.all(
    synthesis.data.angles.map((angle) =>
      generateStructured(
        OriginalDraft,
        buildWeeklyDraftPrompt(voiceSystem, angle, buildAlgorithmRulesBlock(angle.format))
      )
    )
  );

  // Step 5: Assemble plan
  const posts: WeeklyPost[] = synthesis.data.angles.map((angle, i) => ({
    format: angle.format,
    hook: angle.hook,
    posts: draftResults[i].data?.posts ?? ["(draft failed — regenerate)"],
    context: angle.connection,
    source: angle.source,
    sourceDate: angle.sourceDate,
    suggestedVisual: draftResults[i].data?.suggestedVisual,
  }));

  revalidatePath("/compose");
  return { weekOf: date, posts };
}
```

- [ ] **Step 4: Run tests — all should pass**

```
npx vitest run src/server/original.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```
git add src/server/original.ts src/server/original.test.ts
git commit -m "feat(original): add generateWeeklyPosts — parallel research + synthesis + batch drafting"
```

---

## Task 5: WeeklyComposer UI

**Files:**
- Create: `src/components/weekly-composer.tsx`
- Modify: `src/app/(app)/compose/page.tsx`

- [ ] **Step 1: Create `src/components/weekly-composer.tsx`**

```typescript
"use client";
import { useState } from "react";
import { generateWeeklyPosts } from "@/server/original";
import type { WeeklyPost, WeeklyPostPlan } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const FORMAT_LABELS: Record<string, string> = {
  "quick-take": "quick take",
  "experiment": "experiment",
  "tool-find": "tool find",
  "observation": "observation",
  "reaction": "reaction",
};

const PROGRESS_MESSAGES = [
  "Researching the world...",
  "Checking GitHub...",
  "Reading the news...",
  "Finding your angles...",
  "Drafting...",
];

function PostCard({ post }: { post: WeeklyPost }) {
  const [body, setBody] = useState(post.posts.join("\n\n"));
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{FORMAT_LABELS[post.format]}</Badge>
        {post.sourceDate && (
          <span className="text-xs text-muted-foreground">{post.sourceDate}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground italic">{post.context}</p>
      <Textarea
        rows={Math.min(10, body.split("\n").length + 2)}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="font-mono text-sm"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => { navigator.clipboard.writeText(body); toast.success("Copied"); }}
        >
          Copy
        </Button>
        {post.source && (
          <a href={post.source} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground underline">
            source
          </a>
        )}
        {post.suggestedVisual && (
          <span className="text-xs text-muted-foreground">Visual: {post.suggestedVisual}</span>
        )}
      </div>
    </div>
  );
}

export function WeeklyComposer({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [journal, setJournal] = useState("");
  const [plan, setPlan] = useState<WeeklyPostPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);

  async function generate() {
    setBusy(true);
    setProgressIdx(0);
    const ticker = setInterval(() => setProgressIdx((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1)), 20_000);
    try {
      const result = await generateWeeklyPosts(profileId, journal || undefined);
      setPlan(result);
    } catch (e) {
      toast.error(String(e));
    } finally {
      clearInterval(ticker);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <select
        className="border rounded px-2 py-1 text-sm"
        value={profileId}
        onChange={(e) => setProfileId(e.target.value)}
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>{p.handle}</option>
        ))}
      </select>

      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">
          What are you working on this week? (optional)
        </label>
        <Textarea
          rows={3}
          placeholder="shipped X, broke Y, noticed Z while building..."
          value={journal}
          onChange={(e) => setJournal(e.target.value)}
          disabled={busy}
        />
      </div>

      <Button disabled={busy} onClick={generate} className="w-full sm:w-auto">
        {busy ? PROGRESS_MESSAGES[progressIdx] : "Generate this week's posts"}
      </Button>

      {plan && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Week of {plan.weekOf} · {plan.posts.length} posts</p>
          {plan.posts.map((post, i) => (
            <PostCard key={i} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `src/app/(app)/compose/page.tsx`**

Replace the entire file content:

```typescript
import { listProfiles } from "@/server/profiles";
import { WeeklyComposer } from "@/components/weekly-composer";

export default async function ComposePage() {
  const profiles = (await listProfiles()) ?? [];
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Compose</h1>
      <WeeklyComposer profiles={profiles} />
    </div>
  );
}
```

- [ ] **Step 3: Run tsc to check for type errors**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add src/components/weekly-composer.tsx src/app/(app)/compose/page.tsx
git commit -m "feat(compose): replace angle-composer with weekly-composer — generate 3-5 posts in one shot"
```

---

## Task 6: generateReplyQueue server action

**Files:**
- Create: `src/server/engage.ts`
- Create: `src/server/engage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/engage.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/generate", () => ({
  generateText: vi.fn().mockResolvedValue("@karpathy posted: scaling laws hold\n@simonw posted: django 5.1 ships"),
  generateStructured: vi.fn()
    .mockResolvedValueOnce({
      data: {
        opportunities: [
          { targetHandle: "@karpathy", targetPost: "scaling laws hold", targetUrl: "", targetLikes: 200, postedAt: "May 27", reason: "cisco knows this" },
        ],
      },
    })
    .mockResolvedValueOnce({
      data: { reply: "scaling laws are about compute, not data quality", skip: false },
    }),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { handle: "@cisco", voice_spec: "lowercase", content_pillars: ["AI"] },
            error: null,
          }),
          // For seed_targets query
          mockResolvedValue: undefined,
        }),
      }),
    })),
  }),
}));

vi.mock("@/lib/handoff-reader", () => ({
  readHandoff: vi.fn().mockResolvedValue("Spine 1"),
}));

import { generateReplyQueue } from "@/server/engage";

describe("generateReplyQueue", () => {
  it("returns a ReplyQueue with at least one opportunity", async () => {
    const queue = await generateReplyQueue("profile-123", ["@karpathy", "@simonw"]);
    expect(queue.opportunities.length).toBeGreaterThan(0);
    expect(queue.opportunities[0].targetHandle).toBe("@karpathy");
    expect(queue.opportunities[0].reply).toContain("scaling");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/server/engage.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/server/engage.ts`**

```typescript
"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateText, generateStructured } from "@/lib/generate";
import { ReplyCandidateList, ReplyDraft, ReplyQueue, ReplyOpportunity } from "@/lib/schemas";
import {
  buildCiscoContextBlock,
  buildSeedScanPrompt,
  buildReplyFilterPrompt,
  buildReplyDraftPrompt,
  buildVoiceSystemFromSpec,
} from "@/lib/voice-prompt";
import { readHandoff } from "@/lib/handoff-reader";

export async function generateReplyQueue(profileId: string, handleOverride?: string[]): Promise<ReplyQueue> {
  const sb = await supabaseServer();

  // Step 1: Load profile context
  const { data: profile, error } = await sb
    .from("profiles")
    .select("handle, voice_spec, content_pillars")
    .eq("id", profileId)
    .single();
  if (error || !profile) throw new Error("profile not found");

  // Load seed handles (from DB or caller override for testing)
  let handles: string[] = handleOverride ?? [];
  if (!handleOverride) {
    const { data: seeds } = await sb
      .from("seed_targets")
      .select("handle")
      .eq("profile_id", profileId)
      .eq("active", true);
    handles = (seeds ?? []).map((s) => s.handle).filter(Boolean) as string[];
  }

  if (handles.length === 0) throw new Error("no seed accounts found — run onboarding first");

  const handoffText = await readHandoff();
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const ciscoContext = buildCiscoContextBlock(profile, handoffText);
  const voiceSystem = buildVoiceSystemFromSpec({ handle: profile.handle, voice_spec: profile.voice_spec });

  // Step 2: Scan recent posts from seed accounts
  const scannedPosts = await generateText(buildSeedScanPrompt(handles, date), { research: true });

  // Step 3: Filter to reply-worthy opportunities
  const filter = await generateStructured(
    ReplyCandidateList,
    buildReplyFilterPrompt(scannedPosts, ciscoContext)
  );
  if (!filter.data || filter.data.opportunities.length === 0) {
    return { generatedAt: date, opportunities: [] };
  }

  // Step 4: Draft replies in parallel
  const draftResults = await Promise.all(
    filter.data.opportunities.map((opp) =>
      generateStructured(ReplyDraft, buildReplyDraftPrompt(voiceSystem, opp))
    )
  );

  // Step 5: Assemble — skip entries where model returned skip:true or no reply
  const opportunities: ReplyOpportunity[] = [];
  for (let i = 0; i < filter.data.opportunities.length; i++) {
    const draft = draftResults[i].data;
    if (!draft || draft.skip || !draft.reply) continue;
    opportunities.push({ ...filter.data.opportunities[i], reply: draft.reply });
  }

  return { generatedAt: date, opportunities };
}
```

- [ ] **Step 4: Run tests**

```
npx vitest run src/server/engage.test.ts
```

Expected: PASS. (Note: the mock structure may need adjusting for the nested supabase chain — if the test fails due to mock shape, adjust `vi.mock("@/lib/supabase/server"...)` to return the right chain for both `profiles` and `seed_targets` queries.)

- [ ] **Step 5: Run full test suite**

```
npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```
git add src/server/engage.ts src/server/engage.test.ts
git commit -m "feat(engage): generateReplyQueue — scan seed accounts, filter, draft replies"
```

---

## Task 7: ReplyQueue UI and /engage page

**Files:**
- Create: `src/components/reply-queue.tsx`
- Create: `src/app/(app)/engage/page.tsx`

- [ ] **Step 1: Create `src/components/reply-queue.tsx`**

```typescript
"use client";
import { useState } from "react";
import { generateReplyQueue } from "@/server/engage";
import type { ReplyOpportunity, ReplyQueue } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function ReplyCard({ opp }: { opp: ReplyOpportunity }) {
  const [reply, setReply] = useState(opp.reply);
  const [skipped, setSkipped] = useState(false);

  if (skipped) return null;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{opp.targetHandle}</span>
          {opp.targetLikes > 0 && (
            <span className="text-muted-foreground">{opp.targetLikes} likes</span>
          )}
          {opp.postedAt && (
            <span className="text-muted-foreground">{opp.postedAt}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground border-l-2 pl-3">{opp.targetPost}</p>
        <p className="text-xs text-muted-foreground italic">{opp.reason}</p>
      </div>
      <Textarea
        rows={3}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        className="font-mono text-sm"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => { navigator.clipboard.writeText(reply); toast.success("Copied"); }}
        >
          Copy reply
        </Button>
        {opp.targetUrl && (
          <a href={opp.targetUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">View post</Button>
          </a>
        )}
        <Button size="sm" variant="ghost" onClick={() => setSkipped(true)}>
          Skip
        </Button>
      </div>
    </div>
  );
}

export function ReplyQueuePanel({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [queue, setQueue] = useState<ReplyQueue | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const result = await generateReplyQueue(profileId);
      setQueue(result);
      if (result.opportunities.length === 0) {
        toast.info("No reply opportunities found in the last 24h — try again later");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <select
          className="border rounded px-2 py-1 text-sm"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.handle}</option>
          ))}
        </select>
        <Button disabled={busy} onClick={generate}>
          {busy ? "Scanning seed accounts..." : "Generate reply queue"}
        </Button>
      </div>

      {queue && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {queue.generatedAt} · {queue.opportunities.length} opportunities
          </p>
          {queue.opportunities.length === 0 && (
            <p className="text-muted-foreground text-sm">Nothing worth replying to right now.</p>
          )}
          {queue.opportunities.map((opp, i) => (
            <ReplyCard key={i} opp={opp} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(app)/engage/page.tsx`**

```typescript
import { listProfiles } from "@/server/profiles";
import { ReplyQueuePanel } from "@/components/reply-queue";

export default async function EngagePage() {
  const profiles = (await listProfiles()) ?? [];
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Engage</h1>
      <p className="text-sm text-muted-foreground mb-4">Reply opportunities from your seed accounts in the last 24h.</p>
      <ReplyQueuePanel profiles={profiles} />
    </div>
  );
}
```

- [ ] **Step 3: Run tsc**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add src/components/reply-queue.tsx src/app/(app)/engage/page.tsx
git commit -m "feat(engage): reply queue UI — scan seed accounts, draft replies, copy in one click"
```

---

## Task 8: Add Engage to nav + smoke test

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Add Engage link to nav**

In `src/app/(app)/layout.tsx`, replace the nav content:

```typescript
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex gap-4 border-b p-3 text-sm">
        <a href="/board" className="underline">Board</a>
        <a href="/compose" className="underline">Compose</a>
        <a href="/engage" className="underline">Engage</a>
        <a href="/performance" className="underline">Performance</a>
        <a href="/profiles" className="underline">Profiles</a>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Run build to verify no type or compile errors**

```
npx next build
```

Expected: build succeeds.

- [ ] **Step 4: Start dev server and verify both pages load**

```
npm run dev
```

Open:
- `http://localhost:3000/compose` — should show WeeklyComposer with journal textarea and "Generate this week's posts" button
- `http://localhost:3000/engage` — should show ReplyQueuePanel with "Generate reply queue" button

Do NOT click the generate buttons yet (they call `claude -p` which takes 3-5 minutes). Just confirm the pages render without errors.

- [ ] **Step 5: Commit**

```
git add src/app/(app)/layout.tsx
git commit -m "feat(nav): add Engage link — reply queue now accessible from nav"
```

---

## Self-review

**Spec coverage check:**
- ✅ §3 Orchestration flow — Tasks 4 (weekly) and 6 (reply queue)
- ✅ §3.2 Context layer — `buildCiscoContextBlock` in Task 3, `readHandoff` in Task 2
- ✅ §3.3 Research layer — `buildWorldResearchPrompt`, parallel calls in Task 4
- ✅ §3.4 Synthesis layer — `buildCrossRefSynthesisPrompt`, `WeeklyAngleList` in Tasks 1+3+4
- ✅ §3.5 Draft layer — `buildWeeklyDraftPrompt` in Task 3, parallel drafts in Task 4
- ✅ §3.6 Algorithm hook — `buildAlgorithmRulesBlock` stub in Task 3
- ✅ §4 All 5 formats — format instructions in `FORMAT_INSTRUCTIONS` in Task 3
- ✅ §5 Voice rules — enforced in `buildWeeklyDraftPrompt` in Task 3
- ✅ §6 Schemas — all types in Task 1
- ✅ §7 `handoff-reader.ts` — Task 2
- ✅ §7 `voice-prompt.ts` additions — Task 3
- ✅ §7 `generateWeeklyPosts` — Task 4
- ✅ §7 `weekly-composer.tsx` — Task 5
- ✅ §9 `generateReplyQueue` — Task 6
- ✅ §9 `reply-queue.tsx` + `/engage` page — Task 7
- ✅ §11 Algorithm hook for replies — `buildAlgorithmRulesBlock` stub used in Task 4; a `buildAlgorithmReplyRulesBlock` stub is not separately implemented (same stub function suffices for now)

**Type consistency check:**
- `WeeklyAngle` defined in Task 1, imported by `buildWeeklyDraftPrompt` in Task 3 — ✅
- `WeeklyAngleList` used in `generateWeeklyPosts` — ✅
- `ReplyCandidate` / `ReplyCandidateList` used in `generateReplyQueue` filter step — ✅
- `ReplyDraft` used for per-reply draft output — ✅
- `ReplyOpportunity` assembled from `ReplyCandidate` + `reply` field — ✅
- `OriginalDraft` (existing) reused for weekly draft output — ✅
- `buildVoiceSystemFromSpec` already exported from `voice-prompt.ts`, imported in `engage.ts` — ✅

**Placeholder scan:** No TBD, no TODO, no "similar to Task N" shortcuts. All code blocks are complete.
