# Recording Cockpit Overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A follow-along recording cockpit (say/do/fx + voice-following teleprompter + live edit markers) hosted in a Windows Electron overlay that is invisible to screen capture, so the prompter sits on the same screen being recorded without appearing in the recording.

**Architecture:** One React cockpit (a Next.js takeover route) is the single UI. Pure, fully-tested engines (`voicefollow`, `markers`, view selectors) hold all logic. A thin Electron shell in `/desktop` loads the cockpit from `localhost:3000`, adds the three powers a browser lacks (invisible-to-capture via `setContentProtection`, always-on-top, click-through), registers global hotkeys for a foot pedal, supervises a local Whisper sidecar, and writes the marker export files to disk. Because the overlay runs on the same PC as the recorder, there is no cross-device sync.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Zod 4 / Vitest (web app, existing) · Electron + Node `ws` (new `/desktop` workspace) · local streaming Whisper (faster-whisper reference sidecar) · Web Speech API (browser dev/test source).

**Spec:** `docs/superpowers/specs/2026-06-04-recording-cockpit-overlay-design.md`

**Conventions:**
- Run all tests: `npm test`. Run one file: `npx vitest run <path>`.
- TDD every pure module: failing test → run (fail) → minimal impl → run (pass) → commit.
- Electron/sidecar tasks can't be unit-tested; each ends with a concrete **manual verification** + commit.

---

## File structure

| Path | Responsibility | Status |
|---|---|---|
| `src/lib/studio/schemas.ts` | `ScriptBeat` gains `do/fx/ost/brollKeywords/markerLabel` (optional) | modify |
| `src/lib/studio/brain.ts` | `buildScriptPrompt` asks for the new beat fields | modify |
| `src/lib/studio/markers.ts` | pure: `msToTimecode`, `toResolveEDL`, `toYouTubeChapters` | create |
| `src/lib/studio/voicefollow.ts` | pure: `flattenScript`, `createFollower` (advance-only fuzzy match) | create |
| `src/lib/studio/cockpit-view.ts` | pure: `selectView` (current/next/progress from beats+index) | create |
| `src/lib/studio/transcript/types.ts` | `TranscriptSource` interface + `normalizeWords` | create |
| `src/lib/studio/transcript/web-speech.ts` | browser Web Speech API source | create |
| `src/lib/studio/transcript/whisper-sidecar.ts` | WebSocket source for the local sidecar | create |
| `src/lib/studio/transcript/index.ts` | the source singleton (env switch) | create |
| `src/server/studio/projects.ts` | `getProjectForOverlay`, `beatsFromProject`, `confirmTake` reuse | modify |
| `src/app/overlay/record/[projectId]/page.tsx` | cockpit takeover route (loads beats) | create |
| `src/components/studio/cockpit.tsx` | the floating cockpit client component | create |
| `src/components/studio/record-hub.tsx` | add an "Open in overlay" affordance | modify |
| `desktop/package.json` | Electron workspace manifest | create |
| `desktop/main.js` | Electron main: window, content protection, hotkeys, IPC, fs writes | create |
| `desktop/preload.js` | safe IPC bridge to the renderer | create |
| `desktop/sidecar/whisper_stream.py` | reference faster-whisper → JSON-lines stdout | create |
| `desktop/sidecar/server.js` | spawns the python sidecar, broadcasts words over `ws` | create |

---

## Slice 1 — Beat model + script generation

### Task 1: Extend `ScriptBeat` with the follow-along fields

**Files:**
- Modify: `src/lib/studio/schemas.ts:30-36`
- Test: `src/lib/studio/schemas.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/lib/studio/schemas.test.ts` inside the existing `describe("studio schemas", …)` block:

```ts
  it("parses a beat with the new follow-along fields", () => {
    const s = VideoScript.parse({
      title: "T", hook: "H",
      beats: [{
        id: "b1", say: "open the cookbook", visualPrompt: "show cookbook",
        estSeconds: 8, do: "Click [Cookbook] → Run scan",
        fx: 'punch-zoom + freeze on "No GPU"', ost: "Docker blind spot",
        brollKeywords: ["rtx 3080", "task manager gpu"], markerLabel: "B4 punch-zoom",
      }],
    });
    expect(s.beats[0].do).toBe("Click [Cookbook] → Run scan");
    expect(s.beats[0].brollKeywords).toEqual(["rtx 3080", "task manager gpu"]);
  });

  it("still parses an old beat without the new fields (back-compat)", () => {
    const s = VideoScript.parse({
      title: "T", hook: "H",
      beats: [{ id: "b1", say: "say this", visualPrompt: "show code" }],
    });
    expect(s.beats[0].do).toBeUndefined();
    expect(s.beats[0].fx).toBeUndefined();
  });

  it("rejects more than 3 brollKeywords", () => {
    const r = VideoScript.safeParse({
      title: "T", hook: "H",
      beats: [{ id: "b1", say: "s", visualPrompt: "v", brollKeywords: ["a", "b", "c", "d"] }],
    });
    expect(r.success).toBe(false);
  });
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/lib/studio/schemas.test.ts`
Expected: FAIL (the new-fields test reads `undefined`/throws; the broll-limit test passes wrongly is impossible since field doesn't exist → safeParse succeeds → `success` is `true` → assertion fails).

- [ ] **Step 3: Add the fields to `ScriptBeat`**

Replace `src/lib/studio/schemas.ts` lines 30-36 with:

```ts
export const ScriptBeat = z.object({
  id: z.string().min(1),
  say: z.string().min(1).max(600),
  visualPrompt: z.string().min(1).max(400),
  estSeconds: z.number().min(1).max(120).optional(),
  // Follow-along recording cockpit (all optional → old scripts still parse)
  do: z.string().max(200).optional(),
  fx: z.string().max(200).optional(),
  ost: z.string().max(120).optional(),
  brollKeywords: z.array(z.string().max(40)).max(3).optional(),
  markerLabel: z.string().max(80).optional(),
});
export type ScriptBeat = z.infer<typeof ScriptBeat>;
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/lib/studio/schemas.test.ts`
Expected: PASS (all beat tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/schemas.ts src/lib/studio/schemas.test.ts
git commit -m "feat(studio): add say/do/fx/ost/broll/marker fields to ScriptBeat"
```

---

### Task 2: Generate the new fields in `buildScriptPrompt`

**Files:**
- Modify: `src/lib/studio/brain.ts:52-65`
- Test: `src/lib/studio/brain.test.ts` (add a focused test)

- [ ] **Step 1: Write the failing test**

Add to `src/lib/studio/brain.test.ts`:

```ts
import { buildScriptPrompt } from "./brain";

describe("buildScriptPrompt — follow-along fields", () => {
  const topic = { id: "t1", title: "X", angle: "y", score: 50, rationale: "z", sourceRefs: [] };
  it("asks the model for do/fx/ost/brollKeywords/markerLabel with an example", () => {
    const p = buildScriptPrompt({ topic });
    for (const field of ["do", "fx", "ost", "brollKeywords", "markerLabel"]) {
      expect(p).toContain(field);
    }
    expect(p.toLowerCase()).toContain("example");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/studio/brain.test.ts`
Expected: FAIL (prompt does not mention `do`/`fx`/example yet).

- [ ] **Step 3: Update `buildScriptPrompt`**

Replace `src/lib/studio/brain.ts` lines 52-65 with:

```ts
export function buildScriptPrompt(req: ScriptRequest): string {
  return [
    `You are scripting a real-face, screen-recorded solo-dev YouTube video.`,
    req.voiceSpec ? `Creator voice:\n${req.voiceSpec}` : "",
    `Topic: ${req.topic.title}`,
    `Angle: ${req.topic.angle}`,
    playbookBlock(req.playbook),
    `Target length: ~${req.targetDurationSec ?? 360} seconds.`,
    `Write: a packaging-rule title; a hook that PAYS OFF in the first 15 seconds; then teleprompter "beats".`,
    `Each beat is one synchronized moment with these fields:`,
    `- id: a slug like "beat-1".`,
    `- say: the EXACT teleprompter line to read aloud.`,
    `- visualPrompt: the on-screen element/screen-capture for that line.`,
    `- do: a one-line imperative live action with a bracketed target, e.g. "Click [Cookbook] → Run scan" or "Stay on camera, hold frame". Use null if there is no screen action.`,
    `- fx: the edit cue to apply in post, e.g. "punch-zoom + freeze on \\"No GPU\\"" or "jump cut after this line". Use null if none.`,
    `- ost: a short on-screen caption (<= 10 words) for this beat. Use null if none.`,
    `- brollKeywords: up to 3 stock-footage search terms for screen beats, e.g. ["rtx 3080", "task manager gpu"]. Use null for face-only beats.`,
    `- markerLabel: a short label a creator would stamp at this beat (<= 80 chars), e.g. "B4 punch-zoom + ost: No GPU".`,
    `- estSeconds: rough duration in seconds.`,
    `Example beat: { "id": "beat-4", "say": "It looked at my machine and said: no GPU.", "visualPrompt": "Cookbook hardware scan result", "do": "Open [Cookbook] → run hardware scan → rest cursor on \\"No GPU\\"", "fx": "punch-zoom + freeze on \\"No GPU\\"", "ost": "Docker blind spot, not your PC", "brollKeywords": ["rtx 3080", "task manager gpu"], "markerLabel": "B4 punch-zoom + ost", "estSeconds": 12 }`,
    `Front-load the face + payoff; body is screen-only. Keep it tight.`,
    `Respond as JSON matching: { title, hook, beats: { id, say, visualPrompt, do, fx, ost, brollKeywords, markerLabel, estSeconds }[] }.`,
  ].filter(Boolean).join("\n\n");
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/lib/studio/brain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/brain.ts src/lib/studio/brain.test.ts
git commit -m "feat(studio): script prompt generates do/fx/ost/broll/marker per beat"
```

---

## Slice 2 — Pure engines (TDD core)

### Task 3: Marker export — `markers.ts`

**Files:**
- Create: `src/lib/studio/markers.ts`
- Test: `src/lib/studio/markers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/studio/markers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { msToTimecode, toResolveEDL, toYouTubeChapters, type Marker } from "./markers";

const markers: Marker[] = [
  { beatIndex: 0, ms: 0, label: "B1 face hook", kind: "face" },
  { beatIndex: 1, ms: 18000, label: "B2 punch-zoom", kind: "screen" },
  { beatIndex: 2, ms: 65500, label: "B3 CTA", kind: "cta" },
];

describe("msToTimecode", () => {
  it("formats ms at 30fps as HH:MM:SS:FF", () => {
    expect(msToTimecode(0, 30)).toBe("00:00:00:00");
    expect(msToTimecode(65500, 30)).toBe("00:01:05:15"); // .5s * 30 = 15 frames
  });
  it("formats at 24fps", () => {
    expect(msToTimecode(1000, 24)).toBe("00:00:01:00");
  });
});

describe("toResolveEDL", () => {
  it("emits a header and one event per marker with color + label", () => {
    const edl = toResolveEDL(markers, 30);
    expect(edl).toContain("TITLE: Embalio Session Markers");
    expect(edl).toContain("FCM: NON-DROP FRAME");
    expect(edl).toContain("|C:ResolveColorYellow");   // face
    expect(edl).toContain("|C:ResolveColorBlue");      // screen
    expect(edl).toContain("|C:ResolveColorGreen");     // cta
    expect(edl).toContain("|M:B2 punch-zoom");
    expect(edl).toContain("00:01:05:15");              // B3 timecode at 30fps
  });
  it("sanitizes pipe and newline characters out of labels", () => {
    const edl = toResolveEDL([{ beatIndex: 0, ms: 0, label: "bad|label\nhere", kind: "face" }], 30);
    expect(edl).toContain("|M:bad label here");
  });
});

describe("toYouTubeChapters", () => {
  it("forces the first entry to 0:00 and uses m:ss formatting", () => {
    const txt = toYouTubeChapters(markers);
    const lines = txt.trim().split("\n");
    expect(lines[0]).toBe("0:00 B1 face hook");
    expect(lines[1]).toBe("0:18 B2 punch-zoom");
    expect(lines[2]).toBe("1:05 B3 CTA");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/studio/markers.test.ts`
Expected: FAIL ("Cannot find module './markers'").

- [ ] **Step 3: Implement `markers.ts`**

Create `src/lib/studio/markers.ts`:

```ts
export type MarkerKind = "face" | "screen" | "cta" | "retake";

export interface Marker {
  beatIndex: number;
  ms: number;        // milliseconds since the session/recording start
  label: string;
  kind?: MarkerKind;
}

const RESOLVE_COLOR: Record<MarkerKind, string> = {
  face: "Yellow",
  screen: "Blue",
  cta: "Green",
  retake: "Red",
};

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** Milliseconds → "HH:MM:SS:FF" at the given frame rate. */
export function msToTimecode(ms: number, fps: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const frames = Math.round(((ms % 1000) / 1000) * fps);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(frames)}`;
}

function sanitize(label: string): string {
  return label.replace(/[|\r\n]+/g, " ").trim();
}

/** DaVinci Resolve "Import Timeline Markers from EDL" format. */
export function toResolveEDL(markers: Marker[], fps: number): string {
  const lines = ["TITLE: Embalio Session Markers", "FCM: NON-DROP FRAME", ""];
  markers.forEach((m, i) => {
    const tcIn = msToTimecode(m.ms, fps);
    const tcOut = msToTimecode(m.ms + Math.round(1000 / fps), fps);
    const color = RESOLVE_COLOR[m.kind ?? "face"];
    const evt = pad(i + 1, 3);
    lines.push(`${evt}  001  V  C  ${tcIn}  ${tcOut}  ${tcIn}  ${tcOut}`);
    lines.push(` |C:ResolveColor${color} |M:${sanitize(m.label)} |D:1`);
    lines.push("");
  });
  return lines.join("\n");
}

/** YouTube description chapters: first entry MUST be 0:00. */
export function toYouTubeChapters(markers: Marker[]): string {
  return markers
    .map((m, i) => {
      const totalSeconds = i === 0 ? 0 : Math.floor(m.ms / 1000);
      const mm = Math.floor(totalSeconds / 60);
      const ss = totalSeconds % 60;
      return `${mm}:${pad(ss)} ${sanitize(m.label)}`;
    })
    .join("\n");
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/studio/markers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/markers.ts src/lib/studio/markers.test.ts
git commit -m "feat(studio): pure marker export — Resolve EDL + YouTube chapters"
```

---

### Task 4: Voice-follow engine — `voicefollow.ts`

**Files:**
- Create: `src/lib/studio/voicefollow.ts`
- Test: `src/lib/studio/voicefollow.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/studio/voicefollow.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { flattenScript, createFollower } from "./voicefollow";

const beats = [
  { id: "b1", say: "open the cookbook and run the scan", visualPrompt: "v" },
  { id: "b2", say: "except I have an RTX 3080 right here", visualPrompt: "v" },
];

describe("flattenScript", () => {
  it("emits one token per word tagged with its beat index", () => {
    const toks = flattenScript(beats);
    expect(toks[0]).toEqual({ word: "open", beatIndex: 0, globalIndex: 0 });
    expect(toks.at(-1)).toEqual({ word: "here", beatIndex: 1, globalIndex: toks.length - 1 });
    const firstB2 = toks.find((t) => t.beatIndex === 1);
    expect(firstB2?.word).toBe("except");
  });
});

describe("createFollower", () => {
  it("advances position as matching words arrive", () => {
    const f = createFollower(flattenScript(beats));
    let state = f.push(["open", "the", "cookbook"]);
    expect(state.tokenIndex).toBe(3);   // matched 3 words
    expect(state.beatIndex).toBe(0);
  });

  it("crosses into the next beat", () => {
    const f = createFollower(flattenScript(beats));
    f.push(["open", "the", "cookbook", "and", "run", "the", "scan"]);
    const state = f.push(["except", "I", "have"]);
    expect(state.beatIndex).toBe(1);
  });

  it("never moves backward on a repeated/echoed word", () => {
    const f = createFollower(flattenScript(beats));
    const a = f.push(["open", "the", "cookbook"]);
    const b = f.push(["open"]);            // echo of an earlier word
    expect(b.tokenIndex).toBeGreaterThanOrEqual(a.tokenIndex);
  });

  it("holds position when an off-script word arrives (ad-lib)", () => {
    const f = createFollower(flattenScript(beats));
    const a = f.push(["open", "the"]);
    const b = f.push(["honestly", "umm"]); // not in the look-ahead window
    expect(b.tokenIndex).toBe(a.tokenIndex);
  });

  it("tolerates a near-miss within the fuzzy threshold", () => {
    const f = createFollower(flattenScript(beats));
    const state = f.push(["open", "the", "cookbok"]); // typo/mis-hear of "cookbook"
    expect(state.tokenIndex).toBe(3);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/studio/voicefollow.test.ts`
Expected: FAIL ("Cannot find module './voicefollow'").

- [ ] **Step 3: Implement `voicefollow.ts`**

Create `src/lib/studio/voicefollow.ts`:

```ts
export interface Token {
  word: string;        // normalized (lowercase, alpha-num only)
  beatIndex: number;
  globalIndex: number;
}

export interface FollowState {
  tokenIndex: number;  // count of script words considered "spoken" so far
  beatIndex: number;   // active beat
}

interface BeatLike {
  say: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function flattenScript(beats: BeatLike[]): Token[] {
  const tokens: Token[] = [];
  beats.forEach((b, beatIndex) => {
    for (const raw of b.say.split(/\s+/)) {
      const word = normalize(raw);
      if (!word) continue;
      tokens.push({ word, beatIndex, globalIndex: tokens.length });
    }
  });
  return tokens;
}

/** Sørensen–Dice coefficient over character bigrams. */
function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [g, countA] of A) {
    const countB = B.get(g) ?? 0;
    overlap += Math.min(countA, countB);
  }
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

const THRESHOLD = 0.6;     // fuzzy-match acceptance
const LOOK_AHEAD = 4;      // how far forward we search for the next spoken word

export interface Follower {
  push(recognized: string[]): FollowState;
  state(): FollowState;
}

/** Advance-only matcher: walks `tokens` forward as recognized words arrive. */
export function createFollower(tokens: Token[]): Follower {
  let tokenIndex = 0;

  function matchOne(word: string): void {
    const end = Math.min(tokenIndex + LOOK_AHEAD, tokens.length);
    for (let i = tokenIndex; i < end; i++) {
      if (dice(tokens[i].word, word) >= THRESHOLD) {
        tokenIndex = i + 1;     // advance-only: jump past the matched token
        return;
      }
    }
    // no match in the window → hold (ad-lib / off-script)
  }

  function currentBeat(): number {
    if (tokens.length === 0) return 0;
    if (tokenIndex >= tokens.length) return tokens[tokens.length - 1].beatIndex;
    return tokens[Math.max(0, tokenIndex - 1)]?.beatIndex ?? 0;
  }

  return {
    push(recognized) {
      for (const raw of recognized) {
        const w = normalize(raw);
        if (w) matchOne(w);
      }
      return { tokenIndex, beatIndex: currentBeat() };
    },
    state() {
      return { tokenIndex, beatIndex: currentBeat() };
    },
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/studio/voicefollow.test.ts`
Expected: PASS (all 6 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/voicefollow.ts src/lib/studio/voicefollow.test.ts
git commit -m "feat(studio): pure voice-follow engine (advance-only fuzzy match)"
```

---

## Slice 3 — Cockpit web UI (testable in Chrome)

### Task 5: Cockpit view selector — `cockpit-view.ts`

**Files:**
- Create: `src/lib/studio/cockpit-view.ts`
- Test: `src/lib/studio/cockpit-view.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/studio/cockpit-view.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { selectView } from "./cockpit-view";
import type { ScriptBeat } from "./schemas";

const beats: ScriptBeat[] = [
  { id: "b1", say: "line one", visualPrompt: "v1", do: "Click [A]", fx: "zoom" },
  { id: "b2", say: "line two", visualPrompt: "v2" },
  { id: "b3", say: "line three", visualPrompt: "v3" },
];

describe("selectView", () => {
  it("returns the active beat, the next peek, and progress", () => {
    const v = selectView(beats, 0);
    expect(v.current.say).toBe("line one");
    expect(v.current.do).toBe("Click [A]");
    expect(v.next?.say).toBe("line two");
    expect(v.progress).toEqual({ n: 1, total: 3 });
  });
  it("has no next peek on the last beat", () => {
    const v = selectView(beats, 2);
    expect(v.next).toBeNull();
    expect(v.progress).toEqual({ n: 3, total: 3 });
  });
  it("clamps an out-of-range index", () => {
    expect(selectView(beats, 99).current.say).toBe("line three");
    expect(selectView(beats, -5).current.say).toBe("line one");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/studio/cockpit-view.test.ts`
Expected: FAIL ("Cannot find module './cockpit-view'").

- [ ] **Step 3: Implement `cockpit-view.ts`**

Create `src/lib/studio/cockpit-view.ts`:

```ts
import type { ScriptBeat } from "./schemas";

export interface CockpitView {
  current: ScriptBeat;
  next: ScriptBeat | null;
  progress: { n: number; total: number };
}

export function selectView(beats: ScriptBeat[], activeIndex: number): CockpitView {
  const total = beats.length;
  const i = Math.max(0, Math.min(activeIndex, total - 1));
  return {
    current: beats[i],
    next: i + 1 < total ? beats[i + 1] : null,
    progress: { n: i + 1, total },
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/studio/cockpit-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/cockpit-view.ts src/lib/studio/cockpit-view.test.ts
git commit -m "feat(studio): pure cockpit view selector (current/next/progress)"
```

---

### Task 6: Transcript source seam

**Files:**
- Create: `src/lib/studio/transcript/types.ts`
- Create: `src/lib/studio/transcript/web-speech.ts`
- Create: `src/lib/studio/transcript/whisper-sidecar.ts`
- Create: `src/lib/studio/transcript/index.ts`
- Test: `src/lib/studio/transcript/types.test.ts`

- [ ] **Step 1: Write the failing test** (only the pure helper is unit-tested; the API wrappers are verified manually later)

Create `src/lib/studio/transcript/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeWords } from "./types";

describe("normalizeWords", () => {
  it("splits a transcript chunk into lowercase words", () => {
    expect(normalizeWords("Open the Cookbook!")).toEqual(["open", "the", "cookbook"]);
  });
  it("drops empty fragments", () => {
    expect(normalizeWords("   ...  hi ")).toEqual(["hi"]);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/studio/transcript/types.test.ts`
Expected: FAIL ("Cannot find module './types'").

- [ ] **Step 3: Implement the seam**

Create `src/lib/studio/transcript/types.ts`:

```ts
export interface TranscriptSource {
  /** Begin streaming. `onWords` fires with each batch of newly recognized words. */
  start(onWords: (words: string[]) => void): Promise<void>;
  stop(): void;
}

export function normalizeWords(chunk: string): string[] {
  return chunk
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
```

Create `src/lib/studio/transcript/web-speech.ts`:

```ts
import type { TranscriptSource } from "./types";
import { normalizeWords } from "./types";

/**
 * Browser Web Speech API source (Chrome/Edge). For building/testing the cockpit
 * UI in a normal browser. Does NOT work inside Electron (no Google backend) —
 * use the whisper sidecar there.
 */
export function webSpeechSource(): TranscriptSource {
  type SR = { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void;
    onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
    onend: (() => void) | null; };
  let rec: SR | null = null;
  let running = false;

  return {
    async start(onWords) {
      const Ctor = (globalThis as unknown as { webkitSpeechRecognition?: new () => SR; SpeechRecognition?: new () => SR })
        .SpeechRecognition ?? (globalThis as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
      if (!Ctor) throw new Error("Web Speech API unavailable — use Chrome, or the whisper sidecar");
      rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          onWords(normalizeWords(e.results[i][0].transcript));
        }
      };
      rec.onend = () => { if (running) rec?.start(); }; // auto-restart past the ~60s cap
      running = true;
      rec.start();
    },
    stop() { running = false; rec?.stop(); rec = null; },
  };
}
```

Create `src/lib/studio/transcript/whisper-sidecar.ts`:

```ts
import type { TranscriptSource } from "./types";
import { normalizeWords } from "./types";

/**
 * Connects to the local Whisper sidecar WebSocket (see /desktop/sidecar).
 * The sidecar emits JSON lines: { "words": "recognized text chunk" }.
 */
export function whisperSidecarSource(url = "ws://127.0.0.1:8765"): TranscriptSource {
  let ws: WebSocket | null = null;
  return {
    async start(onWords) {
      ws = new WebSocket(url);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { words?: string };
          if (msg.words) onWords(normalizeWords(msg.words));
        } catch { /* ignore malformed frames */ }
      };
      await new Promise<void>((resolve, reject) => {
        if (!ws) return reject(new Error("no socket"));
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("whisper sidecar not reachable"));
      });
    },
    stop() { ws?.close(); ws = null; },
  };
}
```

Create `src/lib/studio/transcript/index.ts`:

```ts
import type { TranscriptSource } from "./types";
import { webSpeechSource } from "./web-speech";
import { whisperSidecarSource } from "./whisper-sidecar";

export type { TranscriptSource } from "./types";

/**
 * The single seam the cockpit imports. In Electron we set
 * NEXT_PUBLIC_TRANSCRIPT_SOURCE=whisper; in a plain browser it defaults to
 * the Web Speech API.
 */
export function makeTranscriptSource(): TranscriptSource {
  const kind = process.env.NEXT_PUBLIC_TRANSCRIPT_SOURCE;
  return kind === "whisper" ? whisperSidecarSource() : webSpeechSource();
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/studio/transcript/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/transcript
git commit -m "feat(studio): transcript source seam (web-speech + whisper-sidecar)"
```

---

### Task 7: Overlay data loader

**Files:**
- Modify: `src/server/studio/projects.ts`
- Test: `src/server/studio/projects-overlay.test.ts`

- [ ] **Step 1: Write the failing test** (test the pure extraction, not the DB call)

Create `src/server/studio/projects-overlay.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { beatsFromProject } from "./projects";

describe("beatsFromProject", () => {
  it("parses a valid script jsonb into a VideoScript", () => {
    const project = { script: { title: "T", hook: "H", beats: [{ id: "b1", say: "s", visualPrompt: "v" }] } };
    const script = beatsFromProject(project);
    expect(script?.beats).toHaveLength(1);
  });
  it("returns null when there is no script", () => {
    expect(beatsFromProject({ script: null })).toBeNull();
  });
  it("returns null for a malformed script", () => {
    expect(beatsFromProject({ script: { nope: true } })).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/server/studio/projects-overlay.test.ts`
Expected: FAIL (`beatsFromProject` not exported).

- [ ] **Step 3: Add `beatsFromProject` + `getProjectForOverlay`**

Add to the top imports of `src/server/studio/projects.ts` (it already imports from schemas):

```ts
import { ChannelPlaybook, VideoScript } from "@/lib/studio/schemas";
```

(Replace the existing `import { ChannelPlaybook } …` line with the line above so both are imported.)

Then append to `src/server/studio/projects.ts`:

```ts
/** Pure: extract a VideoScript from a project row's `script` jsonb, or null. */
export function beatsFromProject(project: { script?: unknown } | null): VideoScript | null {
  if (!project?.script) return null;
  const parsed = VideoScript.safeParse(project.script);
  return parsed.success ? parsed.data : null;
}

/** Load a project + its active recording profile for the overlay cockpit. */
export async function getProjectForOverlay(projectId: string) {
  const sb = supabaseService();
  const { data: project, error } = await sb.from("video_projects").select("*").eq("id", projectId).single();
  if (error) throw new Error(error.message);
  const script = beatsFromProject(project);
  const { data: profiles } = await sb
    .from("recording_profiles")
    .select("*")
    .eq("profile_id", project.profile_id);
  return { project, script, recordingProfiles: profiles ?? [] };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/server/studio/projects-overlay.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/studio/projects.ts src/server/studio/projects-overlay.test.ts
git commit -m "feat(studio): overlay data loader (beatsFromProject + getProjectForOverlay)"
```

---

### Task 8: Cockpit component + overlay route

**Files:**
- Create: `src/components/studio/cockpit.tsx`
- Create: `src/app/overlay/record/[projectId]/page.tsx`

> No DOM test framework is installed (no testing-library). All logic is already
> covered by the pure tests in Tasks 3–7. This task is presentation + a
> **manual browser verification**.

- [ ] **Step 1: Create the cockpit component**

Create `src/components/studio/cockpit.tsx`:

```tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VideoScript } from "@/lib/studio/schemas";
import { selectView } from "@/lib/studio/cockpit-view";
import { flattenScript, createFollower } from "@/lib/studio/voicefollow";
import { makeTranscriptSource } from "@/lib/studio/transcript";
import { toResolveEDL, toYouTubeChapters, type Marker } from "@/lib/studio/markers";

type ElectronBridge = {
  onHotkey: (cb: (action: string) => void) => void;
  exportMarkers: (files: { edl: string; chapters: string }) => void;
} | undefined;

export function Cockpit({ script, fps = 30 }: { script: VideoScript; fps?: number }) {
  const beats = script.beats;
  const tokens = useMemo(() => flattenScript(beats), [beats]);
  const follower = useMemo(() => createFollower(tokens), [tokens]);

  const [active, setActive] = useState(0);
  const [voiceOn, setVoiceOn] = useState(false);
  const sessionStart = useRef<number | null>(null);
  const markers = useRef<Marker[]>([]);
  const view = selectView(beats, active);

  const stamp = useCallback((index: number) => {
    if (sessionStart.current == null) return;
    const ms = Date.now() - sessionStart.current;
    const b = beats[index];
    markers.current = markers.current.filter((m) => m.beatIndex !== index);
    markers.current.push({ beatIndex: index, ms, label: b.markerLabel ?? b.say.slice(0, 60),
      kind: index === 0 ? "face" : "screen" });
  }, [beats]);

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, beats.length - 1));
    setActive(clamped);
    stamp(clamped);
  }, [beats.length, stamp]);

  const startSession = useCallback(() => { sessionStart.current = Date.now(); markers.current = []; stamp(0); }, [stamp]);

  const exportNow = useCallback(() => {
    const edl = toResolveEDL([...markers.current].sort((a, b) => a.ms - b.ms), fps);
    const chapters = toYouTubeChapters([...markers.current].sort((a, b) => a.ms - b.ms));
    const bridge = (globalThis as { embalio?: ElectronBridge }).embalio;
    if (bridge) bridge.exportMarkers({ edl, chapters });
    else { console.log(edl); console.log(chapters); }   // browser dev fallback
  }, [fps]);

  // voice-following
  useEffect(() => {
    if (!voiceOn) return;
    const src = makeTranscriptSource();
    let stopped = false;
    src.start((words) => {
      const s = follower.push(words);
      if (!stopped) setActive(s.beatIndex);
    }).catch((e) => { console.error(e); setVoiceOn(false); });
    return () => { stopped = true; src.stop(); };
  }, [voiceOn, follower]);

  // hardware/global hotkeys (Electron) + keyboard fallback
  useEffect(() => {
    const onAction = (action: string) => {
      if (action === "next") go(active + 1);
      else if (action === "prev") go(active - 1);
      else if (action === "playpause") setVoiceOn((v) => !v);
      else if (action === "mark") stamp(active);
    };
    const bridge = (globalThis as { embalio?: ElectronBridge }).embalio;
    bridge?.onHotkey(onAction);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); go(e.shiftKey ? active - 1 : active + 1); }
      else if (e.code === "ArrowRight") go(active + 1);
      else if (e.code === "ArrowLeft") go(active - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go, stamp]);

  return (
    <div className="flex min-h-screen flex-col bg-transparent p-3 text-white">
      <div className="mb-2 flex items-center gap-3 text-[11px] text-white/60">
        <span>BEAT {view.progress.n}/{view.progress.total}</span>
        <span className={voiceOn ? "text-emerald-400" : "text-white/40"}>● {voiceOn ? "voice" : "manual"}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={startSession} className="rounded bg-white/10 px-2 py-0.5">Start session</button>
          <button onClick={exportNow} className="rounded bg-white/10 px-2 py-0.5">Stop &amp; export</button>
        </div>
      </div>
      <div className="rounded-xl bg-black/70 p-4 backdrop-blur">
        <div className="text-[28px] font-semibold leading-snug">{view.current.say}</div>
        {view.current.do && <div className="mt-3 border-l-2 border-sky-400 pl-3 text-sky-200">▸ {view.current.do}</div>}
        {view.current.fx && <div className="mt-2 text-[13px] text-amber-300">⚡ {view.current.fx}</div>}
      </div>
      {view.next && <div className="mt-2 truncate px-1 text-[14px] text-white/30">next → {view.next.say}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Create the overlay route**

Create `src/app/overlay/record/[projectId]/page.tsx`:

```tsx
import { getProjectForOverlay } from "@/server/studio/projects";
import { Cockpit } from "@/components/studio/cockpit";

export const dynamic = "force-dynamic";

export default async function OverlayCockpitPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  let script = null;
  try { ({ script } = await getProjectForOverlay(projectId)); } catch { /* render the empty state */ }

  if (!script) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-white/60">No script for this project yet.</div>;
  }
  return <Cockpit script={script} />;
}
```

- [ ] **Step 3: Manual verification (browser)**

Run: `npm run dev`, then open Chrome at `http://localhost:3000/overlay/record/<a real projectId at the record stage>`.
Verify:
- The cockpit shows BEAT 1/N, the first `say` large, the `do`/`fx` lanes, and a dimmed `next →`.
- `Space` / `ArrowRight` advance beats; `Shift+Space` / `ArrowLeft` go back.
- Click **Start session**, advance a few beats, click **Stop & export** → the EDL + chapters print to the browser console.
- Toggle voice with the ● control (the playpause hotkey) and read a line aloud → the active beat tracks your voice (Chrome).

- [ ] **Step 4: Commit**

```bash
git add src/components/studio/cockpit.tsx "src/app/overlay/record/[projectId]/page.tsx"
git commit -m "feat(studio): cockpit component + invisible-overlay route (web-testable)"
```

---

### Task 9: "Open in overlay" affordance in Record Hub

**Files:**
- Modify: `src/components/studio/record-hub.tsx`

- [ ] **Step 1: Add a link to the overlay route**

In `src/components/studio/record-hub.tsx`, add inside the returned JSX, right after the opening `<div className="space-y-4">` (line 29), a launch row:

```tsx
      <a
        href={`/overlay/record/${projectId}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px] hover:border-primary"
      >
        🎬 Open follow-along cockpit
      </a>
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`, go to a project at the **Record** stage in `/studio`, click **Open follow-along cockpit** → the overlay route opens in a new tab for that project.

- [ ] **Step 3: Commit**

```bash
git add src/components/studio/record-hub.tsx
git commit -m "feat(studio): launch the follow-along cockpit from Record Hub"
```

---

## Slice 4 — Electron overlay shell (`/desktop`)

> `/desktop` is its **own** Node package (separate `package.json`) so Electron
> never enters the Next app's dependency tree or production build. It is not part
> of `npm test`. Each task ends with a manual smoke check.

### Task 10: Electron scaffold + invisible always-on-top window

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/main.js`
- Create: `desktop/preload.js`

- [ ] **Step 1: Create `desktop/package.json`**

```json
{
  "name": "embalio-overlay",
  "version": "0.1.0",
  "private": true,
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "devDependencies": {
    "electron": "^33.0.0"
  },
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

- [ ] **Step 2: Create `desktop/preload.js`**

```js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("embalio", {
  onHotkey: (cb) => ipcRenderer.on("hotkey", (_e, action) => cb(action)),
  exportMarkers: (files) => ipcRenderer.send("export-markers", files),
});
```

- [ ] **Step 3: Create `desktop/main.js`**

```js
const { app, BrowserWindow, globalShortcut, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const PROJECT_ID = process.env.EMBALIO_PROJECT_ID || "";
const APP_URL = process.env.EMBALIO_URL || "http://localhost:3000";
const EXPORT_DIR = process.env.EMBALIO_EXPORT_DIR || app.getPath("documents");

let win;
let interactive = false;

function createWindow() {
  win = new BrowserWindow({
    width: 720,
    height: 320,
    x: 40,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: true,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setContentProtection(true);                 // WDA_EXCLUDEFROMCAPTURE — invisible to capture
  win.setIgnoreMouseEvents(true, { forward: true }); // click-through

  win.loadURL(`${APP_URL}/overlay/record/${PROJECT_ID}`);
}

function send(action) {
  if (win && !win.isDestroyed()) win.webContents.send("hotkey", action);
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Right", () => send("next"));
  globalShortcut.register("CommandOrControl+Left", () => send("prev"));
  globalShortcut.register("CommandOrControl+Space", () => send("playpause"));
  globalShortcut.register("CommandOrControl+M", () => send("mark"));
  globalShortcut.register("CommandOrControl+I", () => {        // toggle click-through
    interactive = !interactive;
    win.setIgnoreMouseEvents(!interactive, { forward: true });
    win.setFocusable(interactive);
  });
}

ipcMain.on("export-markers", (_e, files) => {
  try {
    fs.writeFileSync(path.join(EXPORT_DIR, "embalio_markers.edl"), files.edl, "utf8");
    fs.writeFileSync(path.join(EXPORT_DIR, "embalio_chapters.txt"), files.chapters, "utf8");
    dialog.showMessageBox(win, { message: `Markers exported to ${EXPORT_DIR}` });
  } catch (err) {
    dialog.showErrorBox("Export failed", String(err));
  }
});

app.whenReady().then(() => { createWindow(); registerShortcuts(); });
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
```

- [ ] **Step 4: Install + manual verification (the core invisibility proof)**

Run:
```bash
cd desktop && npm install
```
Start the Next app in another terminal (`npm run dev` from the repo root). Then:
```bash
cd desktop && set EMBALIO_PROJECT_ID=<a real record-stage projectId>&& npm start
```
(PowerShell: `$env:EMBALIO_PROJECT_ID="<id>"; npm start`.)

Verify ALL of:
- The cockpit floats on top of other windows, frameless, background transparent.
- Open OBS → add a **Display Capture** → **the overlay does NOT appear** in the OBS preview while it is visible on your real screen. (Repeat with **Window Capture** and a Chrome `getDisplayMedia` tab share — absent in all.)
- `Ctrl+Right` / `Ctrl+Left` advance/retreat beats even though the window has no focus.
- `Ctrl+I` toggles interactive mode (you can then drag/click the buttons); `Ctrl+I` again restores click-through.

- [ ] **Step 5: Commit**

```bash
git add desktop/package.json desktop/main.js desktop/preload.js
git commit -m "feat(desktop): Electron overlay shell — invisible-to-capture, always-on-top, hotkeys"
```

---

### Task 11: Wire marker export to disk via the active recording profile

**Files:**
- Modify: `desktop/main.js` (export path resolution — already wired via `EMBALIO_EXPORT_DIR`)
- Modify: `src/components/studio/cockpit.tsx` (call `confirmTake` after export)
- Modify: `src/server/studio/projects.ts` (no change; `confirmTake` already exists)

> The renderer already builds the EDL/chapters strings (Task 8) and hands them to
> main over IPC (Task 10). This task confirms the take in the pipeline after a
> successful export so the stage rail advances to Publish.

- [ ] **Step 1: Add a server action wrapper the cockpit can call**

The cockpit runs client-side. Add a tiny client call to the existing `confirmTake`. In `src/components/studio/cockpit.tsx`, import it at the top:

```ts
import { confirmTake } from "@/server/studio/projects";
```

Change the component signature to also accept the ids it needs:

```tsx
export function Cockpit({ script, projectId, recordingProfileId, fps = 30 }:
  { script: VideoScript; projectId: string; recordingProfileId: string; fps?: number }) {
```

Then, at the end of `exportNow`, after the bridge call, add:

```ts
    confirmTake(projectId, recordingProfileId).catch((e) => console.error(e));
```

- [ ] **Step 2: Pass the ids from the route**

In `src/app/overlay/record/[projectId]/page.tsx`, change the loader to also surface a recording profile id and pass both props:

```tsx
export default async function OverlayCockpitPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  let script = null;
  let recordingProfileId = "";
  try {
    const data = await getProjectForOverlay(projectId);
    script = data.script;
    recordingProfileId = data.recordingProfiles[0]?.id ?? "";
  } catch { /* render the empty state */ }

  if (!script) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-white/60">No script for this project yet.</div>;
  }
  return <Cockpit script={script} projectId={projectId} recordingProfileId={recordingProfileId} />;
}
```

- [ ] **Step 3: Manual verification**

With dev server + overlay running on a real record-stage project: Start session → advance through all beats → Stop & export. Verify:
- `embalio_markers.edl` + `embalio_chapters.txt` are written to `EMBALIO_EXPORT_DIR` (or Documents).
- Import the `.edl` into DaVinci Resolve (`Timeline → Import → Timeline Markers from EDL`) → markers land at the right times with the right colors/labels.
- The `/studio` project moved to the **Publish** stage.

- [ ] **Step 4: Commit**

```bash
git add src/components/studio/cockpit.tsx "src/app/overlay/record/[projectId]/page.tsx"
git commit -m "feat(studio): export markers to disk + confirm the take into Publish"
```

---

## Slice 5 — Local Whisper sidecar

### Task 12: Reference Whisper sidecar (mic → words over WebSocket)

**Files:**
- Create: `desktop/sidecar/whisper_stream.py`
- Create: `desktop/sidecar/server.js`
- Modify: `desktop/main.js` (spawn + supervise the sidecar)

> Contract (the only thing that matters): the sidecar serves a WebSocket on
> `ws://127.0.0.1:8765` and pushes JSON frames `{ "words": "<recognized text>" }`.
> The reference impl uses `faster-whisper` on the GPU; any STT that honors the
> contract is swappable.

- [ ] **Step 1: Create the Python streamer** `desktop/sidecar/whisper_stream.py`

```python
import sys, json, numpy as np, sounddevice as sd
from faster_whisper import WhisperModel

# Reads default mic, transcribes ~2s windows on the GPU, prints JSON lines.
model = WhisperModel("small.en", device="cuda", compute_type="float16")
SR = 16000
WINDOW = int(SR * 2.0)
buf = np.zeros(0, dtype=np.float32)

def emit(text):
    if text.strip():
        sys.stdout.write(json.dumps({"words": text.strip()}) + "\n")
        sys.stdout.flush()

with sd.InputStream(samplerate=SR, channels=1, dtype="float32") as stream:
    while True:
        chunk, _ = stream.read(int(SR * 0.5))
        buf = np.concatenate([buf, chunk[:, 0]])
        if len(buf) >= WINDOW:
            segments, _ = model.transcribe(buf, language="en", beam_size=1)
            emit(" ".join(s.text for s in segments))
            buf = buf[int(SR * 0.5):]  # slide the window, keep recent context
```

- [ ] **Step 2: Create the Node bridge** `desktop/sidecar/server.js`

```js
const { spawn } = require("child_process");
const { WebSocketServer } = require("ws");
const path = require("path");

function startSidecar(port = 8765) {
  const wss = new WebSocketServer({ port });
  const clients = new Set();
  wss.on("connection", (ws) => { clients.add(ws); ws.on("close", () => clients.delete(ws)); });

  const py = spawn("python", [path.join(__dirname, "whisper_stream.py")], { stdio: ["ignore", "pipe", "inherit"] });
  let acc = "";
  py.stdout.on("data", (d) => {
    acc += d.toString();
    let nl;
    while ((nl = acc.indexOf("\n")) >= 0) {
      const line = acc.slice(0, nl).trim();
      acc = acc.slice(nl + 1);
      if (line) for (const ws of clients) { try { ws.send(line); } catch {} }
    }
  });
  py.on("exit", (code) => console.error(`[sidecar] python exited: ${code}`));
  return { wss, py, stop() { py.kill(); wss.close(); } };
}

module.exports = { startSidecar };
```

- [ ] **Step 3: Spawn it from Electron main**

In `desktop/main.js`, add near the top after the other `require`s:

```js
const { startSidecar } = require("./sidecar/server");
let sidecar = null;
```

Inside `app.whenReady().then(...)`, before `createWindow()`, add:

```js
  if (process.env.EMBALIO_VOICE !== "off") {
    try { sidecar = startSidecar(); } catch (e) { console.error("sidecar failed", e); }
  }
```

And in the `will-quit` handler add `if (sidecar) sidecar.stop();`.

- [ ] **Step 4: Tell the renderer to use the sidecar**

Run the overlay with `NEXT_PUBLIC_TRANSCRIPT_SOURCE=whisper` so `makeTranscriptSource()` picks `whisperSidecarSource`. (Set it in the repo root `.env.local` for dev so the Next-served page reads it.)

- [ ] **Step 5: Manual verification**

Prereqs (one-time): `pip install faster-whisper sounddevice numpy` with a CUDA-enabled PyTorch/CTranslate2 for the 3080.
Run dev server (`.env.local` has `NEXT_PUBLIC_TRANSCRIPT_SOURCE=whisper`) + `cd desktop && npm start`. Toggle voice on (`Ctrl+Space`), read a beat aloud. Verify:
- The active beat advances to follow your speech (local, no internet).
- Stop reading mid-beat → the cockpit holds position.
- Kill the python process → the cockpit stays usable via pedal/hotkeys (no crash). 

- [ ] **Step 6: Commit**

```bash
git add desktop/sidecar desktop/main.js
git commit -m "feat(desktop): local Whisper sidecar — mic to words over WebSocket"
```

---

## Slice 6 — End-to-end & docs

### Task 13: Launcher convenience + smoke checklist + handoff note

**Files:**
- Create: `desktop/README.md`
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: Write `desktop/README.md`**

```markdown
# Embalio Overlay (desktop)

Invisible, always-on-top follow-along recording cockpit. Windows only
(uses WDA_EXCLUDEFROMCAPTURE; macOS Sequoia cannot hide windows from capture).

## Run
1. Start the web app from the repo root: `npm run dev` (with
   `NEXT_PUBLIC_TRANSCRIPT_SOURCE=whisper` in `.env.local` for voice-following).
2. One-time voice deps: `pip install faster-whisper sounddevice numpy` (CUDA build).
3. Launch the overlay for a project at the Record stage:
   PowerShell:
   ```powershell
   $env:EMBALIO_PROJECT_ID="<projectId>"
   $env:EMBALIO_EXPORT_DIR="C:\path\to\save"   # optional; defaults to Documents
   cd desktop; npm start
   ```

## Controls (work while unfocused)
- Ctrl+→ / Ctrl+← — next / previous beat (map a USB foot pedal to these)
- Ctrl+Space — toggle voice-following
- Ctrl+M — drop a marker at the current beat
- Ctrl+I — toggle interactive (to drag/resize), then toggle back to click-through

## Output
On **Stop & export**: `embalio_markers.edl` (DaVinci Resolve) +
`embalio_chapters.txt` (YouTube) written to the export dir; the project advances
to Publish.

## Limits
- A phone CAMERA pointed at the screen still sees the overlay (software exclusion only).
- Voice-following needs the Whisper sidecar (Chrome's Web Speech API does not work inside Electron).
- If voice degrades, the foot pedal / hotkeys are the always-working fallback.
```

- [ ] **Step 2: Full end-to-end smoke checklist (run it, tick each)**

- [ ] Generate a fresh script in `/studio` → beats carry `do`/`fx`/`markerLabel`.
- [ ] Advance the project to Record; click **Open follow-along cockpit** (sanity in browser).
- [ ] Launch the Electron overlay for that project; confirm it's invisible in OBS Display + Window capture.
- [ ] Start OBS recording; **Start session** in the cockpit at the same moment.
- [ ] Read through, using voice-following; use the pedal/hotkeys to hold/jump where you ad-lib.
- [ ] **Stop & export**; import the `.edl` into Resolve; paste `chapters.txt` into a YouTube description draft.
- [ ] Confirm `/studio` is now at Publish.

- [ ] **Step 3: Update the handoff**

Add a SESSION block to `docs/HANDOFF.md` summarizing: the cockpit overlay shipped, the `/desktop` Electron workspace, the Whisper sidecar prereqs, and the Windows-only / phone-camera limits. Reference this plan + the spec.

- [ ] **Step 4: Commit**

```bash
git add desktop/README.md docs/HANDOFF.md
git commit -m "docs(desktop): overlay README + end-to-end smoke checklist + handoff"
```

---

## Self-review notes (author)

- **Spec coverage:** beat model (T1–2), voice-following (T4,6,12), say/do/fx cockpit (T8), invisible overlay (T10), hotkeys/pedal (T8,10), markers→EDL/chapters (T3,11), confirmTake handoff (T11), error/fallback to manual (T8 keyboard + T12 step 5), Windows-only/phone-camera limits (T10,13 README). All spec sections map to a task.
- **No DB migration:** new beat fields are optional; `script` is jsonb (T1 back-compat test proves old rows parse).
- **Type consistency:** `Marker`, `Token`, `FollowState`, `CockpitView`, `TranscriptSource` are each defined once and imported; `selectView`, `flattenScript`, `createFollower`, `toResolveEDL`, `toYouTubeChapters`, `makeTranscriptSource`, `beatsFromProject`, `getProjectForOverlay`, `confirmTake` names are used identically across tasks.
- **Risk isolation:** the Whisper sidecar (the heaviest dependency) is behind the `TranscriptSource` seam and is `EMBALIO_VOICE=off`-able; manual pedal mode never depends on it.
```
