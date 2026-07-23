# Composer Reach-Lint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-post checklist in the composers enforcing the Rank-2 reach-audit rules — warn on external link in the main tweet ("move to reply 1"), suggest a thread split for long/multi-paragraph drafts (hook line solo), nudge for native media. **Warnings, never blocks.**

**Architecture:** One pure lib `src/lib/engagement/reach-lint.ts` (`reachLint(text, kind)` → findings) + one tiny client component `src/components/reach-lint.tsx` rendering the findings, dropped into the three composer edit surfaces: `weekly-composer.tsx` PostCard, `thread-composer.tsx` TweetCard (hook rules on tweet #1 only), `create-post-panel.tsx` draft box.

**Tech Stack:** vitest for the lib; plain client component (no server code, no schema, no migration).

**Rank-2 rules being encoded (Session 19 audit — handoff):** main tweet = hook + native media; every link goes in reply 1; long multi-paragraph posts ship as threads with the hook line solo.

---

### Task 1: Pure lib — `reachLint`

**Files:**
- Create: `src/lib/engagement/reach-lint.ts`
- Test: `src/lib/engagement/reach-lint.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// src/lib/engagement/reach-lint.test.ts
import { describe, it, expect } from "vitest";
import { reachLint, type ReachLintFinding } from "./reach-lint";

const codes = (fs: ReachLintFinding[]) => fs.map((f) => f.code);

describe("reachLint — post kind", () => {
  it("clean short post → only the native-media nudge (info)", () => {
    const fs = reachLint("shipped the manual sniper mode today. zero Apify.", "post");
    expect(codes(fs)).toEqual(["native_media"]);
    expect(fs[0].severity).toBe("info");
  });

  it("warns on an external link in the first paragraph (main tweet)", () => {
    const fs = reachLint("new post is live https://blog.example.com/x\n\nmore context here", "post");
    expect(codes(fs)).toContain("link_in_main");
    expect(fs.find((f) => f.code === "link_in_main")?.severity).toBe("warn");
  });

  it("does NOT warn when the link sits in a later paragraph (that's reply-1 material)", () => {
    const fs = reachLint("hook line solo\n\ndetails…\n\nlink: https://x.com/foo/status/1", "post");
    expect(codes(fs)).not.toContain("link_in_main");
  });

  it("suggests a thread split for >280 chars", () => {
    const fs = reachLint("a".repeat(300), "post");
    expect(codes(fs)).toContain("thread_split");
  });

  it("suggests a thread split for 3+ paragraphs even under 280 chars", () => {
    const fs = reachLint("one\n\ntwo\n\nthree", "post");
    expect(codes(fs)).toContain("thread_split");
  });

  it("no thread-split warning for a tight 2-paragraph post under 280", () => {
    const fs = reachLint("hook line\n\nsecond beat", "post");
    expect(codes(fs)).not.toContain("thread_split");
  });

  it("all findings are advisory — every finding carries a message", () => {
    const fs = reachLint("x https://a.b\n\n1\n\n2\n\n3" + "y".repeat(300), "post");
    expect(fs.length).toBeGreaterThanOrEqual(3);
    for (const f of fs) expect(f.message.length).toBeGreaterThan(10);
  });
});

describe("reachLint — hook kind (thread tweet #1)", () => {
  it("clean one-liner hook → only the media nudge", () => {
    expect(codes(reachLint("the 0.66% OON stat nobody talks about:", "hook"))).toEqual(["native_media"]);
  });

  it("warns on a link in the hook", () => {
    expect(codes(reachLint("read this https://example.com", "hook"))).toContain("link_in_main");
  });

  it("warns when the hook is not a solo line (multi-paragraph or >200 chars)", () => {
    expect(codes(reachLint("line one\n\nline two", "hook"))).toContain("hook_not_solo");
    expect(codes(reachLint("h".repeat(220), "hook"))).toContain("hook_not_solo");
  });

  it("hook kind never emits thread_split (it is already a thread)", () => {
    expect(codes(reachLint("x".repeat(300), "hook"))).not.toContain("thread_split");
  });
});

describe("reachLint — body kind (thread tweets 2+)", () => {
  it("links are fine in body tweets (reply-1 rule) and no media nudge either", () => {
    expect(reachLint("details + link https://example.com", "body")).toEqual([]);
  });
});

describe("reachLint — edge cases", () => {
  it("empty/whitespace text → no findings", () => {
    expect(reachLint("", "post")).toEqual([]);
    expect(reachLint("   \n ", "hook")).toEqual([]);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/engagement/reach-lint.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implementation**

```ts
// src/lib/engagement/reach-lint.ts
/**
 * Reach-lint: the Rank-2 reach-audit rules (Session-19 handoff) as a pure
 * pre-post checklist. Advisory ONLY — findings are rendered as warnings and
 * nudges next to the composer textarea; nothing ever blocks a post. Rules:
 *   main tweet = hook + native media · every link goes in reply 1 ·
 *   long multi-paragraph posts ship as threads with the hook line solo.
 */

export type ReachLintKind = "post" | "hook" | "body";
export type ReachLintSeverity = "warn" | "info";

export interface ReachLintFinding {
  code: "link_in_main" | "thread_split" | "hook_not_solo" | "native_media";
  severity: ReachLintSeverity;
  message: string;
}

const URL_RE = /https?:\/\/\S+/i;
const MAIN_TWEET_MAX = 280;   // X single-tweet limit — beyond it this is a thread
const HOOK_SOLO_MAX = 200;    // a hook should be one punchy line, not a paragraph
const SPLIT_PARAGRAPHS = 3;   // 3+ paragraphs read as an essay → thread it

const paragraphsOf = (t: string): string[] =>
  t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/**
 * Lint one composer text box. kind:
 *  - "post": a standalone tweet draft (main tweet rules + split suggestion)
 *  - "hook": tweet #1 of a thread (main tweet rules + solo-line rule, no split)
 *  - "body": tweets 2+ of a thread (anything goes — links live here by design)
 */
export function reachLint(text: string, kind: ReachLintKind): ReachLintFinding[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (kind === "body") return [];

  const findings: ReachLintFinding[] = [];
  const paragraphs = paragraphsOf(trimmed);
  const mainParagraph = kind === "hook" ? trimmed : (paragraphs[0] ?? trimmed);

  if (URL_RE.test(mainParagraph)) {
    findings.push({
      code: "link_in_main",
      severity: "warn",
      message: "Link in the main tweet kills reach — move it to reply 1.",
    });
  }

  if (kind === "post" && (trimmed.length > MAIN_TWEET_MAX || paragraphs.length >= SPLIT_PARAGRAPHS)) {
    findings.push({
      code: "thread_split",
      severity: "warn",
      message: "Long post — split into a thread: first tweet is the hook line solo, beats follow one per tweet.",
    });
  }

  if (kind === "hook" && (paragraphs.length > 1 || trimmed.length > HOOK_SOLO_MAX)) {
    findings.push({
      code: "hook_not_solo",
      severity: "warn",
      message: "Hook should be one punchy line on its own — push the rest down-thread.",
    });
  }

  findings.push({
    code: "native_media",
    severity: "info",
    message: "Native image/video on the main tweet lifts reach — attach one if you have it.",
  });

  return findings;
}
```

- [ ] **Step 4:** `npx vitest run src/lib/engagement/reach-lint.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add src/lib/engagement/reach-lint.ts src/lib/engagement/reach-lint.test.ts && git commit -m "feat(compose): reach-lint pure lib — Rank-2 audit rules as advisory checklist"`

---

### Task 2: UI — `ReachLintHints` + wiring into the three composers

**Files:**
- Create: `src/components/reach-lint-hints.tsx`
- Modify: `src/components/weekly-composer.tsx` (PostCard, under the Textarea)
- Modify: `src/components/thread-composer.tsx` (TweetCard, under the Textarea)
- Modify: `src/components/create-post-panel.tsx` (under the draft Textarea)

- [ ] **Step 1: Component**

```tsx
// src/components/reach-lint-hints.tsx
"use client";
import { reachLint, type ReachLintKind } from "@/lib/engagement/reach-lint";

/** Advisory pre-post checklist under a composer textarea. Never blocks. */
export function ReachLintHints({ text, kind }: { text: string; kind: ReachLintKind }) {
  const findings = reachLint(text, kind);
  if (findings.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {findings.map((f) => (
        <li
          key={f.code}
          className={`text-[11px] ${f.severity === "warn" ? "text-amber-500" : "text-muted-foreground"}`}
        >
          {f.severity === "warn" ? "⚠" : "💡"} {f.message}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Wire — weekly-composer.tsx (PostCard).** Directly after the `<Textarea …/>` closing tag inside PostCard's CardContent add:

```tsx
<ReachLintHints text={body} kind="post" />
```

plus the import `import { ReachLintHints } from "@/components/reach-lint-hints";`.

- [ ] **Step 3: Wire — thread-composer.tsx (TweetCard).** After TweetCard's `<Textarea …/>` add (hook rules only on the hook tweet; body tweets get body rules = silent):

```tsx
<ReachLintHints text={body} kind={type === "hook" ? "hook" : "body"} />
```

plus import.

- [ ] **Step 4: Wire — create-post-panel.tsx.** After the draft `<Textarea rows={5} …/>` add:

```tsx
<ReachLintHints text={draft} kind="post" />
```

plus import.

- [ ] **Step 5:** `npx tsc --noEmit && npm test && npm run build` → clean/green.
- [ ] **Step 6: Commit** — `git add src/components/reach-lint-hints.tsx src/components/weekly-composer.tsx src/components/thread-composer.tsx src/components/create-post-panel.tsx && git commit -m "feat(compose): reach-lint hints wired into all three composers"`

---

## Self-review notes
- Warnings-not-blocks ✅ (component renders text only; no disabled buttons touched).
- Freeze-safe: no P4/P6 imports (`thread-composer.tsx` already imports predict's BreakoutChip — untouched).
- `native_media` fires as info on post/hook only; body silent — keeps thread body cards noise-free.
- Live-updating: component re-runs `reachLint` on each keystroke via props — pure fn is cheap (regex + splits).
