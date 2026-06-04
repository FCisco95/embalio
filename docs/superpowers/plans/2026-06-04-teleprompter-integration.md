# Teleprompter Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Odysseus PowerShell teleprompter prototype into a native, one-click, invisible-to-OBS teleprompter inside Embalio's YouTube Engine — merging the shipped Electron cockpit with the prototype's live-adjust ergonomics + saved presets, plus a light guided-shoot gate.

**Architecture:** Electron becomes Embalio's shell (main window loads the Next web UI; a button opens the invisible overlay window via IPC). The overlay extends the shipped `Cockpit` with paragraph/sentence chunking, live layout controls, and named presets persisted via `electron-store` (local) with a browser `localStorage` fallback behind a seam. A guided-shoot gate (checklist + 10s audio/framing test) lives in the web Record stage. All pure logic is TDD'd; Electron/media glue is manually smoke-tested (repo convention).

**Tech Stack:** Next.js 16 (App Router, RSC, server actions) · React 19 · TypeScript · Zod · Vitest · Electron 33 · electron-store · Web Audio / getUserMedia · Supabase.

**Design spec:** `docs/superpowers/specs/2026-06-04-teleprompter-integration-design.md` (repo) / `10 - PROJECTS/Embalio/specs/2026-06-04-teleprompter-integration-design.md` (vault).

**Conventions (read before starting):**
- Run a single test file: `npm test -- src/lib/studio/chunking.test.ts`
- Run all tests: `npm test` (vitest). Type-check: `npx tsc --noEmit`.
- Pure modules live in `src/lib/studio/*.ts` with a colocated `*.test.ts` (see `markers.test.ts` for the house style: `describe`/`it`/`expect`, no mocks for pure code).
- Electron files live in `/desktop` (plain CommonJS `require`, no TS). They are smoke-tested manually — do not invent fake unit tests for them.
- Commit after every green step. Branch: continue on `feat/recording-cockpit`.

---

## File Structure

**New (pure, TDD):**
- `src/lib/studio/chunking.ts` (+ `.test.ts`) — split a beat's `say` into paragraph (1) or sentence (N) lines.
- `src/lib/studio/teleprompter-layout.ts` (+ `.test.ts`) — `Layout` type, defaults, clamps, preset-map operations. No I/O.
- `src/lib/studio/teleprompter-store.ts` (+ `.test.ts`) — `TeleprompterStore` seam + `localStorage` browser impl + an Electron-IPC impl selector.
- `src/lib/studio/audio-meter.ts` (+ `.test.ts`) — peak amplitude → dBFS and band classification.
- `src/lib/studio/preshoot-checklist.ts` (+ `.test.ts`) — checklist item list per profile + completion state helpers.

**New (React, component-tested or smoke):**
- `src/components/studio/preshoot-gate.tsx` — the checklist + 10s audio/framing test (web Record stage).

**Modified:**
- `src/components/studio/cockpit.tsx` — add chunking, live-adjust, presets via a controller.
- `src/components/studio/record-hub.tsx` — one-click launch (IPC in Electron, tab fallback in browser) + mount `PreshootGate`.
- `desktop/main.js` — add the main window, `overlay:open` IPC, Next-server supervision, `electron-store` preset IPC.
- `desktop/preload.js` — expose `openOverlay`, `getStore`, `setPreset`, `setLast`.
- `desktop/package.json` — add `electron-store` dependency.

---

## Slice 1 — Electron shell (Option A one-click)

### Task 1: Add the main window + `overlay:open` IPC

**Files:**
- Modify: `desktop/main.js`
- Modify: `desktop/preload.js`

- [ ] **Step 1: Refactor `createWindow` into `createOverlay(projectId)` and add a main window.**

Replace the window/shortcut section of `desktop/main.js` so the overlay is created on demand and a normal main window loads the web UI:

```js
const { app, BrowserWindow, globalShortcut, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { startSidecar } = require("./sidecar/server");
let sidecar = null;

const APP_URL = process.env.EMBALIO_URL || "http://localhost:3000";
const EXPORT_DIR = process.env.EMBALIO_EXPORT_DIR || app.getPath("documents");

let mainWin = null;
let overlay = null;
let interactive = false;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1280, height: 860,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  mainWin.loadURL(APP_URL);
}

function createOverlay(projectId) {
  if (overlay && !overlay.isDestroyed()) { overlay.focus(); return; }
  overlay = new BrowserWindow({
    width: 720, height: 320, x: 40, y: 40,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, focusable: false, resizable: true,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setContentProtection(true);                  // invisible to OBS
  overlay.setIgnoreMouseEvents(true, { forward: true }); // click-through
  overlay.loadURL(`${APP_URL}/overlay/record/${projectId}`);
  overlay.on("closed", () => { overlay = null; });
}

function send(action) {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send("hotkey", action);
}
```

- [ ] **Step 2: Register the `overlay:open` IPC and keep global recording hotkeys targeting the overlay.**

```js
function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Right", () => send("next"));
  globalShortcut.register("CommandOrControl+Left", () => send("prev"));
  globalShortcut.register("CommandOrControl+Space", () => send("playpause"));
  globalShortcut.register("CommandOrControl+M", () => send("mark"));
  globalShortcut.register("CommandOrControl+I", () => {
    if (!overlay || overlay.isDestroyed()) return;
    interactive = !interactive;
    overlay.setIgnoreMouseEvents(!interactive, { forward: true });
    overlay.setFocusable(interactive);
    if (interactive) overlay.focus();
  });
}

ipcMain.on("overlay:open", (_e, projectId) => {
  if (process.env.EMBALIO_VOICE !== "off" && !sidecar) {
    try { sidecar = startSidecar(); } catch (e) { console.error("sidecar failed", e); }
  }
  createOverlay(projectId);
});

ipcMain.on("export-markers", (_e, files) => {
  try {
    fs.writeFileSync(path.join(EXPORT_DIR, "embalio_markers.edl"), files.edl, "utf8");
    fs.writeFileSync(path.join(EXPORT_DIR, "embalio_chapters.txt"), files.chapters, "utf8");
    dialog.showMessageBox(overlay || mainWin, { message: `Markers exported to ${EXPORT_DIR}` });
  } catch (err) {
    dialog.showErrorBox("Export failed", String(err));
  }
});

app.whenReady().then(() => { createMainWindow(); registerShortcuts(); });
app.on("will-quit", () => { globalShortcut.unregisterAll(); if (sidecar) sidecar.stop(); });
app.on("window-all-closed", () => app.quit());
```

- [ ] **Step 3: Expose `openOverlay` in `desktop/preload.js`.**

```js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("embalio", {
  openOverlay: (projectId) => ipcRenderer.send("overlay:open", projectId),
  onHotkey: (cb) => {
    const handler = (_e, action) => cb(action);
    ipcRenderer.on("hotkey", handler);
    return () => ipcRenderer.off("hotkey", handler);
  },
  exportMarkers: (files) => ipcRenderer.send("export-markers", files),
});
```

- [ ] **Step 4: Smoke test.**

Run (with `npm run dev` already serving on :3000, and `NEXT_PUBLIC_TRANSCRIPT_SOURCE=whisper` in `.env.local`):
```
cd desktop; npm start
```
Expected: a normal Embalio window opens at the dashboard. (Overlay launch is wired in Task 6.) No crash; `Ctrl+I` does nothing yet (no overlay).

- [ ] **Step 5: Commit.**

```bash
git add desktop/main.js desktop/preload.js
git commit -m "feat(desktop): main window + overlay:open IPC (Option A shell)"
```

### Task 2: Supervise the Next server so launch is truly one-click

**Files:**
- Modify: `desktop/main.js`

- [ ] **Step 1: Add a wait-for-port helper and optional server spawn.**

At the top of `desktop/main.js` (after the existing requires):

```js
const http = require("http");
const { spawn } = require("child_process");
let nextProc = null;

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.destroy(); resolve(true); });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    if (await ping(url)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function startNextIfNeeded() {
  if (process.env.EMBALIO_NO_SPAWN === "1") return; // dev already runs `npm run dev`
  const repoRoot = path.join(__dirname, "..");
  nextProc = spawn("npm", ["run", "dev"], { cwd: repoRoot, shell: true, stdio: "inherit" });
}
```

- [ ] **Step 2: Make app startup wait for the server before opening the main window.**

Replace the `app.whenReady().then(...)` line from Task 1 with:

```js
app.whenReady().then(async () => {
  if (!(await ping(APP_URL))) startNextIfNeeded();
  await waitForServer(APP_URL);
  createMainWindow();
  registerShortcuts();
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (sidecar) sidecar.stop();
  if (nextProc) nextProc.kill();
});
```

- [ ] **Step 3: Smoke test (true one-launch).**

With **no** dev server running, run `cd desktop; npm start`. Expected: console shows Next building, then the Embalio window opens once `:3000` answers. With a dev server already up, it skips spawning (the `ping` short-circuits).

- [ ] **Step 4: Commit.**

```bash
git add desktop/main.js
git commit -m "feat(desktop): supervise Next server for true one-launch"
```

---

## Slice 2 — Paragraph/sentence chunking (pure, TDD)

### Task 3: `chunking.ts`

**Files:**
- Create: `src/lib/studio/chunking.ts`
- Test: `src/lib/studio/chunking.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from "vitest";
import { toLines } from "./chunking";

describe("toLines", () => {
  it("paragraph mode returns the whole say as one line", () => {
    expect(toLines("Hello there. How are you?", "para")).toEqual(["Hello there. How are you?"]);
  });
  it("sentence mode splits on . ! ? keeping terminators", () => {
    expect(toLines("Hello there. How are you? Great!", "sent"))
      .toEqual(["Hello there.", "How are you?", "Great!"]);
  });
  it("does not split common abbreviations", () => {
    expect(toLines("I use e.g. Claude here. Then I ship.", "sent"))
      .toEqual(["I use e.g. Claude here.", "Then I ship."]);
  });
  it("trims whitespace and drops empty fragments", () => {
    expect(toLines("  One.   Two.  ", "sent")).toEqual(["One.", "Two."]);
  });
  it("returns a single line when there is no terminal punctuation", () => {
    expect(toLines("no punctuation here", "sent")).toEqual(["no punctuation here"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `npm test -- src/lib/studio/chunking.test.ts`
Expected: FAIL — `toLines is not a function`.

- [ ] **Step 3: Implement.**

```ts
export type ChunkMode = "para" | "sent";

const ABBREVIATIONS = ["e.g.", "i.e.", "etc.", "vs.", "mr.", "mrs.", "dr.", "st."];

/** Split a beat's spoken text into display lines. `para` = the whole line; `sent` = one sentence each. */
export function toLines(say: string, mode: ChunkMode): string[] {
  const text = say.trim();
  if (!text) return [];
  if (mode === "para") return [text];

  // Protect abbreviations from the splitter, then split on sentence terminators
  // followed by whitespace and an uppercase/quote/paren start.
  let guarded = text;
  ABBREVIATIONS.forEach((abbr, i) => {
    guarded = guarded.replace(new RegExp(escapeRegExp(abbr), "gi"), ` ${i} `);
  });
  const parts = guarded.split(/(?<=[.!?])\s+(?=[A-Z"'(])/);
  const restore = (s: string) =>
    ABBREVIATIONS.reduce((acc, abbr, i) => acc.replaceAll(` ${i} `, abbr), s);
  return parts.map((p) => restore(p).trim()).filter(Boolean);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `npm test -- src/lib/studio/chunking.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/studio/chunking.ts src/lib/studio/chunking.test.ts
git commit -m "feat(studio): paragraph/sentence chunking for the teleprompter"
```

---

## Slice 3 — Layout + presets (pure logic + persistence seam)

### Task 4: `teleprompter-layout.ts`

**Files:**
- Create: `src/lib/studio/teleprompter-layout.ts`
- Test: `src/lib/studio/teleprompter-layout.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_LAYOUT, clampLayout, adjust } from "./teleprompter-layout";

describe("teleprompter-layout", () => {
  it("has sane defaults", () => {
    expect(DEFAULT_LAYOUT.font).toBe(24);
    expect(DEFAULT_LAYOUT.opacity).toBeCloseTo(0.7);
    expect(DEFAULT_LAYOUT.mode).toBe("para");
  });
  it("clamps font and opacity into range", () => {
    expect(clampLayout({ ...DEFAULT_LAYOUT, font: 999 }).font).toBe(60);
    expect(clampLayout({ ...DEFAULT_LAYOUT, font: 2 }).font).toBe(16);
    expect(clampLayout({ ...DEFAULT_LAYOUT, opacity: 5 }).opacity).toBe(1);
    expect(clampLayout({ ...DEFAULT_LAYOUT, opacity: 0 }).opacity).toBeCloseTo(0.2);
  });
  it("adjust('font', +2) bumps and re-clamps", () => {
    expect(adjust(DEFAULT_LAYOUT, "font", 2).font).toBe(26);
    expect(adjust({ ...DEFAULT_LAYOUT, font: 60 }, "font", 2).font).toBe(60);
  });
  it("adjust('opacity', -0.05) reduces", () => {
    expect(adjust(DEFAULT_LAYOUT, "opacity", -0.05).opacity).toBeCloseTo(0.65);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `npm test -- src/lib/studio/teleprompter-layout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```ts
import type { ChunkMode } from "./chunking";

export interface Layout {
  font: number;       // pt
  opacity: number;    // 0.2 .. 1
  width: number;      // px
  height: number;     // px
  top: number;        // px
  left: number;       // px
  mode: ChunkMode;
  mirror: boolean;
}

export const DEFAULT_LAYOUT: Layout = {
  font: 24, opacity: 0.7, width: 720, height: 320, top: 40, left: 40, mode: "para", mirror: false,
};

const RANGES = {
  font: [16, 60], opacity: [0.2, 1], width: [360, 3840], height: [70, 2160],
} as const;

function clampN(v: number, [min, max]: readonly [number, number]): number {
  return Math.max(min, Math.min(max, v));
}

export function clampLayout(l: Layout): Layout {
  return {
    ...l,
    font: clampN(l.font, RANGES.font),
    opacity: clampN(l.opacity, RANGES.opacity),
    width: clampN(l.width, RANGES.width),
    height: clampN(l.height, RANGES.height),
  };
}

export type Adjustable = "font" | "opacity" | "width" | "height";

export function adjust(l: Layout, key: Adjustable, delta: number): Layout {
  return clampLayout({ ...l, [key]: l[key] + delta });
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `npm test -- src/lib/studio/teleprompter-layout.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/studio/teleprompter-layout.ts src/lib/studio/teleprompter-layout.test.ts
git commit -m "feat(studio): teleprompter layout model + clamps"
```

### Task 5: `teleprompter-store.ts` (persistence seam)

**Files:**
- Create: `src/lib/studio/teleprompter-store.ts`
- Test: `src/lib/studio/teleprompter-store.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeMemoryStore, setPreset, getPreset } from "./teleprompter-store";
import { DEFAULT_LAYOUT } from "./teleprompter-layout";

describe("teleprompter-store", () => {
  let store: ReturnType<typeof makeMemoryStore>;
  beforeEach(() => { store = makeMemoryStore(); });

  it("starts empty with no last layout", () => {
    expect(store.load()).toEqual({ presets: {}, last: null });
  });
  it("saves and recalls a named preset", () => {
    const big = { ...DEFAULT_LAYOUT, font: 40 };
    setPreset(store, "1", big);
    expect(getPreset(store, "1")).toEqual(big);
    expect(getPreset(store, "2")).toBeNull();
  });
  it("persists last layout across reload via the same backend", () => {
    const l = { ...DEFAULT_LAYOUT, opacity: 0.5 };
    store.save({ ...store.load(), last: l });
    expect(store.load().last).toEqual(l);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `npm test -- src/lib/studio/teleprompter-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the seam + a memory/localStorage impl + an Electron selector.**

```ts
import type { Layout } from "./teleprompter-layout";

export interface StoreData {
  presets: Record<string, Layout>;
  last: Layout | null;
}

export interface TeleprompterStore {
  load(): StoreData;
  save(data: StoreData): void;
}

const EMPTY: StoreData = { presets: {}, last: null };

/** In-memory backend — used by tests and as a server-render no-op. */
export function makeMemoryStore(): TeleprompterStore {
  let data: StoreData = structuredClone(EMPTY);
  return { load: () => structuredClone(data), save: (d) => { data = structuredClone(d); } };
}

const LS_KEY = "embalio.teleprompter.store";

/** Browser-dev backend — localStorage. Falls back to memory on the server. */
export function makeLocalStore(): TeleprompterStore {
  if (typeof window === "undefined") return makeMemoryStore();
  return {
    load: () => {
      try { return { ...EMPTY, ...JSON.parse(window.localStorage.getItem(LS_KEY) ?? "{}") }; }
      catch { return structuredClone(EMPTY); }
    },
    save: (d) => window.localStorage.setItem(LS_KEY, JSON.stringify(d)),
  };
}

/** Electron backend — proxies to the main process electron-store via preload. */
export function makeElectronStore(bridge: {
  getStore: () => StoreData; setStore: (d: StoreData) => void;
}): TeleprompterStore {
  return { load: () => bridge.getStore(), save: (d) => bridge.setStore(d) };
}

/** Pick the right backend at runtime. */
export function resolveStore(): TeleprompterStore {
  const b = (globalThis as { embalio?: { getStore?: () => StoreData; setStore?: (d: StoreData) => void } }).embalio;
  if (b?.getStore && b?.setStore) return makeElectronStore({ getStore: b.getStore, setStore: b.setStore });
  return makeLocalStore();
}

export function setPreset(store: TeleprompterStore, slot: string, layout: Layout): void {
  const data = store.load();
  store.save({ ...data, presets: { ...data.presets, [slot]: layout } });
}

export function getPreset(store: TeleprompterStore, slot: string): Layout | null {
  return store.load().presets[slot] ?? null;
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `npm test -- src/lib/studio/teleprompter-store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/studio/teleprompter-store.ts src/lib/studio/teleprompter-store.test.ts
git commit -m "feat(studio): teleprompter preset store seam (memory/local/electron)"
```

### Task 6: Wire `electron-store` into the Electron backend

**Files:**
- Modify: `desktop/package.json`
- Modify: `desktop/main.js`
- Modify: `desktop/preload.js`

- [ ] **Step 1: Add the dependency.**

In `desktop/package.json` `dependencies`, add:
```json
"electron-store": "^8.2.0"
```
Then run: `cd desktop; npm install`. (electron-store 8.x is CommonJS — compatible with the `require` style in `main.js`.)

- [ ] **Step 2: Add store IPC handlers in `desktop/main.js`.**

After the existing requires:
```js
const Store = require("electron-store");
const store = new Store({ name: "teleprompter", defaults: { presets: {}, last: null } });
```
With the other `ipcMain` handlers:
```js
ipcMain.handle("store:get", () => ({ presets: store.get("presets"), last: store.get("last") }));
ipcMain.on("store:set", (_e, data) => { store.set("presets", data.presets); store.set("last", data.last); });
```

- [ ] **Step 3: Expose them in `desktop/preload.js`.**

Add to the `exposeInMainWorld("embalio", {...})` object:
```js
  getStore: () => ipcRenderer.sendSync("__store_get_sync__"), // replaced below
```
Because `invoke` is async but `resolveStore()` expects sync, register a synchronous channel in `main.js` instead. Replace the Step 2 `store:get` handler with a sync one:
```js
ipcMain.on("store:get-sync", (e) => { e.returnValue = { presets: store.get("presets"), last: store.get("last") }; });
```
and set the preload to:
```js
  getStore: () => ipcRenderer.sendSync("store:get-sync"),
  setStore: (data) => ipcRenderer.send("store:set", data),
```

- [ ] **Step 4: Smoke test.**

`cd desktop; npm start`, open DevTools on the overlay window once Task 9 mounts presets, and confirm `window.embalio.getStore()` returns `{presets:{},last:null}` then persists after a save. (Until Task 9, just confirm `window.embalio.getStore` is a function in the main window console.)

- [ ] **Step 5: Commit.**

```bash
git add desktop/package.json desktop/package-lock.json desktop/main.js desktop/preload.js
git commit -m "feat(desktop): electron-store backend for teleprompter presets"
```

---

## Slice 4 — Cockpit live-adjust + presets + chunking

### Task 7: Extend `Cockpit` with chunking, layout, and presets

**Files:**
- Modify: `src/components/studio/cockpit.tsx`
- Test: `src/components/studio/cockpit.test.tsx` (new — render assertions only)

> Note: the existing `Cockpit` already owns `active`, voice-following, markers, hotkeys (`next/prev/playpause/mark`). This task adds layout state, chunking of the current beat, and preset recall/save active **only in interactive mode** (so global number keys never hijack the system while recording).

- [ ] **Step 1: Write a focused render test.**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Cockpit } from "./cockpit";
import type { VideoScript } from "@/lib/studio/schemas";

const script: VideoScript = {
  title: "t", hook: "h",
  beats: [
    { id: "1", say: "First line. Second line.", visualPrompt: "v", do: "Click run", fx: "zoom" },
    { id: "2", say: "Next beat.", visualPrompt: "v2" },
  ],
};

describe("Cockpit", () => {
  it("renders the current beat say + next peek", () => {
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);
    expect(screen.getByText("First line. Second line.")).toBeTruthy();
    expect(screen.getByText(/next →/)).toBeTruthy();
  });
});
```

> If `@testing-library/react` / `jsdom` aren't yet dev-deps, add them: `npm i -D @testing-library/react @testing-library/dom jsdom` and set `test: { environment: "jsdom" }` for this file via a `// @vitest-environment jsdom` comment at the top of the test. Check `vitest.config.*` first; match whatever the repo already does for component tests (if none exist yet, the jsdom comment is the lightest option).

- [ ] **Step 2: Run to verify it fails (or passes trivially if render already works).**

Run: `npm test -- src/components/studio/cockpit.test.tsx`
Expected: PASS once render deps exist — this is the regression guard before refactoring.

- [ ] **Step 3: Add layout + chunking + presets to `cockpit.tsx`.**

Add imports:
```tsx
import { toLines } from "@/lib/studio/chunking";
import { DEFAULT_LAYOUT, adjust, type Layout, type Adjustable } from "@/lib/studio/teleprompter-layout";
import { resolveStore, setPreset, getPreset } from "@/lib/studio/teleprompter-store";
```

Add state near the other `useState`s:
```tsx
const store = useMemo(() => resolveStore(), []);
const [layout, setLayout] = useState<Layout>(() => store.load().last ?? DEFAULT_LAYOUT);
const [lineIdx, setLineIdx] = useState(0);
const [interactive, setInteractive] = useState(false);
const lines = useMemo(() => toLines(view.current.say, layout.mode), [view.current.say, layout.mode]);
const shownLine = layout.mode === "sent" ? (lines[Math.min(lineIdx, lines.length - 1)] ?? view.current.say) : view.current.say;
```

Persist last layout whenever it changes:
```tsx
useEffect(() => { store.save({ ...store.load(), last: layout }); }, [layout, store]);
```

Reset the sentence cursor when the beat changes:
```tsx
useEffect(() => { setLineIdx(0); }, [active]);
```

Add interactive-only keys (font/width/height/opacity, mode toggle, mirror, preset save/recall). Extend the existing keydown effect's `onKey` with:
```tsx
      if (!interactive) return; // live-adjust + presets only when interactive (between takes)
      const bump = (key: Adjustable, d: number) => { e.preventDefault(); setLayout((l) => adjust(l, key, d)); };
      if (e.code === "Equal") bump("font", 2);
      else if (e.code === "Minus") bump("font", -2);
      else if (e.code === "BracketLeft") bump("width", -60);
      else if (e.code === "BracketRight") bump("width", 60);
      else if (e.code === "Semicolon") bump("height", -16);
      else if (e.code === "Quote") bump("height", 16);
      else if (e.code === "Comma") bump("opacity", -0.05);
      else if (e.code === "Period") bump("opacity", 0.05);
      else if (e.code === "KeyS") setLayout((l) => ({ ...l, mode: l.mode === "para" ? "sent" : "para" }));
      else if (e.code === "KeyR") setMirror((m) => !m);
      else if (/^Digit[1-3]$/.test(e.code)) {
        const slot = e.code.slice(5);
        if (e.shiftKey) setPreset(store, slot, layout);
        else { const p = getPreset(store, slot); if (p) setLayout(p); }
      }
```

In sentence mode, make `next/prev` walk lines first, then beats. Replace the `onAction` `next`/`prev` branches:
```tsx
      if (action === "next") {
        if (layout.mode === "sent" && lineIdx < lines.length - 1) setLineIdx((i) => i + 1);
        else go(active + 1);
      } else if (action === "prev") {
        if (layout.mode === "sent" && lineIdx > 0) setLineIdx((i) => i - 1);
        else go(active - 1);
      }
```
(Add `layout.mode`, `lineIdx`, `lines.length`, `interactive`, `store`, `layout` to that effect's dependency array.)

Apply the layout to the rendered card and show the chunked line. Change the main render block:
```tsx
    <div className="flex min-h-screen flex-col bg-transparent p-3 text-white" style={{ opacity: layout.opacity }}>
      {/* ...status row unchanged, plus a mode/interactive indicator... */}
      <div className="rounded-xl bg-black/70 p-4 backdrop-blur"
           style={{ transform: mirror ? "scaleX(-1)" : undefined, fontSize: layout.font, width: layout.width }}>
        <div className="font-semibold leading-snug">{shownLine}</div>
        {view.current.do && <div className="mt-3 border-l-2 border-sky-400 pl-3 text-sky-200 text-base">▸ {view.current.do}</div>}
        {view.current.fx && <div className="mt-2 text-[13px] text-amber-300">⚡ {view.current.fx}</div>}
      </div>
```

Wire `Ctrl+I` (already sent as the `toggle-interactive` global) to flip the renderer flag — extend `onAction`:
```tsx
      else if (action === "interactive") setInteractive((v) => !v);
```
and in `desktop/main.js` `Ctrl+I` handler add `send("interactive");` after toggling the native flags.

- [ ] **Step 4: Run the test + type-check.**

Run: `npm test -- src/components/studio/cockpit.test.tsx` → PASS
Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit.**

```bash
git add src/components/studio/cockpit.tsx src/components/studio/cockpit.test.tsx desktop/main.js
git commit -m "feat(studio): cockpit live-adjust, chunking, and named presets"
```

---

## Slice 5 — Guided-shoot gate (web Record stage)

### Task 8: `audio-meter.ts`

**Files:**
- Create: `src/lib/studio/audio-meter.ts`
- Test: `src/lib/studio/audio-meter.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from "vitest";
import { peakToDbfs, classifyDbfs } from "./audio-meter";

describe("audio-meter", () => {
  it("full-scale peak is 0 dBFS", () => { expect(peakToDbfs(1)).toBeCloseTo(0); });
  it("half amplitude is about -6 dBFS", () => { expect(peakToDbfs(0.5)).toBeCloseTo(-6.02, 1); });
  it("silence floors at -100 dBFS", () => { expect(peakToDbfs(0)).toBe(-100); });
  it("classifies bands against the playbook target (-12..-6 = good)", () => {
    expect(classifyDbfs(-3)).toBe("hot");
    expect(classifyDbfs(-9)).toBe("good");
    expect(classifyDbfs(-20)).toBe("quiet");
    expect(classifyDbfs(-0.2)).toBe("clip");
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `npm test -- src/lib/studio/audio-meter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```ts
export type Band = "clip" | "hot" | "good" | "quiet";

/** Convert a 0..1 peak amplitude to dBFS, floored at -100. */
export function peakToDbfs(peak: number): number {
  if (peak <= 0) return -100;
  return Math.max(-100, 20 * Math.log10(Math.min(1, peak)));
}

/** Playbook target: speech peaks -12..-6 dB. Above -1 is clipping risk. */
export function classifyDbfs(db: number): Band {
  if (db >= -1) return "clip";
  if (db > -6) return "hot";
  if (db >= -12) return "good";
  return "quiet";
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `npm test -- src/lib/studio/audio-meter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/studio/audio-meter.ts src/lib/studio/audio-meter.test.ts
git commit -m "feat(studio): audio meter dBFS + band classification"
```

### Task 9: `preshoot-checklist.ts`

**Files:**
- Create: `src/lib/studio/preshoot-checklist.ts`
- Test: `src/lib/studio/preshoot-checklist.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from "vitest";
import { checklistFor, allChecked, toggle } from "./preshoot-checklist";

describe("preshoot-checklist", () => {
  it("includes the universal audio + framing items", () => {
    const items = checklistFor("OBS");
    const ids = items.map((i) => i.id);
    expect(ids).toContain("notifications");
    expect(ids).toContain("mic-distance");
    expect(ids).toContain("framing");
  });
  it("adds a Rapidemo item for the Windows capture tool", () => {
    expect(checklistFor("OBS+Rapidemo").some((i) => i.id === "rapidemo")).toBe(true);
    expect(checklistFor("OBS").some((i) => i.id === "rapidemo")).toBe(false);
  });
  it("toggle flips a single item and allChecked reflects completion", () => {
    const items = checklistFor("OBS");
    let state: Record<string, boolean> = {};
    expect(allChecked(items, state)).toBe(false);
    items.forEach((i) => { state = toggle(state, i.id); });
    expect(allChecked(items, state)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `npm test -- src/lib/studio/preshoot-checklist.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

```ts
export interface ChecklistItem { id: string; label: string; }

/** Seeded from the Recording Profile 90-second checklist; extended per capture tool. */
export function checklistFor(captureTool: string): ChecklistItem[] {
  const base: ChecklistItem[] = [
    { id: "notifications", label: "Quiet room, phone on silent, Slack/Discord notifications closed" },
    { id: "mic-distance", label: "Mic ~15–20 cm from mouth, slightly off-axis (plosives)" },
    { id: "gain", label: "Audio peaks -12 to -6 dB — never red (run the 10s test below)" },
    { id: "framing", label: "Face well-lit (light in front), eyes ~upper third, head-and-shoulders" },
    { id: "scene", label: "OBS scene selected and recording armed" },
  ];
  if (/rapidemo/i.test(captureTool)) {
    base.push({ id: "rapidemo", label: "Rapidemo running for auto-zoom on the demo monitor" });
  }
  return base;
}

export function toggle(state: Record<string, boolean>, id: string): Record<string, boolean> {
  return { ...state, [id]: !state[id] };
}

export function allChecked(items: ChecklistItem[], state: Record<string, boolean>): boolean {
  return items.every((i) => state[i.id]);
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `npm test -- src/lib/studio/preshoot-checklist.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/studio/preshoot-checklist.ts src/lib/studio/preshoot-checklist.test.ts
git commit -m "feat(studio): pre-shoot checklist model"
```

### Task 10: `PreshootGate` component (checklist + 10s audio/framing test)

**Files:**
- Create: `src/components/studio/preshoot-gate.tsx`

> Media APIs (`getUserMedia`, `AudioContext`) can't be meaningfully unit-tested here — this component is smoke-tested. The dB math + checklist logic it relies on are already covered by Tasks 8–9.

- [ ] **Step 1: Implement the component.**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { checklistFor, toggle, allChecked } from "@/lib/studio/preshoot-checklist";
import { peakToDbfs, classifyDbfs, type Band } from "@/lib/studio/audio-meter";

const BAND_COLOR: Record<Band, string> = {
  clip: "text-red-500", hot: "text-amber-400", good: "text-emerald-400", quiet: "text-white/50",
};

export function PreshootGate({ captureTool }: { captureTool: string }) {
  const items = checklistFor(captureTool);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [db, setDb] = useState(-100);
  const [testing, setTesting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cleanup = useRef<() => void>(() => {});

  async function runTest() {
    setTesting(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v));
      setDb(peakToDbfs(peak));
      raf = requestAnimationFrame(tick);
    };
    tick();
    cleanup.current = () => {
      cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); ctx.close();
    };
  }

  useEffect(() => () => cleanup.current(), []);
  const band = classifyDbfs(db);

  return (
    <Card><CardContent className="space-y-4 pt-5">
      <div className="text-[13px] font-medium text-muted-foreground">Pre-shoot checklist</div>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" checked={!!checked[i.id]} onChange={() => setChecked((s) => toggle(s, i.id))} />
              <span>{i.label}</span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <Button onClick={runTest} disabled={testing}>Run 10s audio + framing test</Button>
        <span className={`font-mono text-[13px] ${BAND_COLOR[band]}`}>
          {db <= -100 ? "—" : `${db.toFixed(1)} dBFS · ${band}`}
        </span>
      </div>
      <video ref={videoRef} muted className="aspect-video w-full max-w-md rounded-lg bg-black"
             style={{ display: testing ? "block" : "none" }} />
      <div className="text-[11px] text-muted-foreground">
        Target: speech peaks -12 to -6 dB (green). Lock exposure + focus on the StreamCam; eyes ~upper third.
      </div>
      {allChecked(items, checked) && <div className="text-[12px] text-emerald-500">Checklist complete ✓</div>}
    </CardContent></Card>
  );
}
```

- [ ] **Step 2: Type-check.**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit.**

```bash
git add src/components/studio/preshoot-gate.tsx
git commit -m "feat(studio): pre-shoot gate — checklist + 10s audio/framing test"
```

---

## Slice 6 — Wire one-click launch + the gate into Record Hub

### Task 11: Record Hub — one-click overlay + mount the gate

**Files:**
- Modify: `src/components/studio/record-hub.tsx`

- [ ] **Step 1: Replace the static launch link with an IPC-aware button + mount `PreshootGate`.**

Add imports:
```tsx
import { PreshootGate } from "./preshoot-gate";
```

Replace the `<a ...>🎬 Open follow-along cockpit</a>` block with:
```tsx
      <button
        type="button"
        onClick={() => {
          const bridge = (globalThis as { embalio?: { openOverlay?: (id: string) => void } }).embalio;
          if (bridge?.openOverlay) bridge.openOverlay(projectId);                 // Electron: invisible overlay
          else window.open(`/overlay/record/${projectId}`, "_blank", "noreferrer"); // browser dev: tab
        }}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px] hover:border-primary"
      >
        🎬 Launch teleprompter
      </button>
```

Mount the gate above the script card (using the active profile's capture tool):
```tsx
      {active && <PreshootGate captureTool={active.capture_tool} />}
```

- [ ] **Step 2: Type-check + run the full suite.**

Run: `npx tsc --noEmit` → no errors.
Run: `npm test` → all green (existing + new).

- [ ] **Step 3: Commit.**

```bash
git add src/components/studio/record-hub.tsx
git commit -m "feat(studio): one-click teleprompter launch + pre-shoot gate in Record Hub"
```

### Task 12: End-to-end manual smoke (owner-gated, Windows)

**Files:** none (verification).

- [ ] **Step 1:** From the repo root, ensure `.env.local` has `NEXT_PUBLIC_TRANSCRIPT_SOURCE=whisper`. Voice deps installed (`pip install faster-whisper sounddevice numpy`).
- [ ] **Step 2:** `cd desktop; npm start`. Confirm the Embalio main window opens (server auto-spawned if not already running).
- [ ] **Step 3:** Navigate to a Record-stage project. Work the **pre-shoot checklist**; click **Run 10s audio + framing test** → confirm the dB readout turns green at normal speaking volume and the webcam preview shows the thirds framing.
- [ ] **Step 4:** Click **Launch teleprompter** → the invisible overlay appears. In OBS, add Display Capture **and** Window Capture → confirm the overlay is **not** visible in either.
- [ ] **Step 5:** With OBS focused, press `Ctrl+Right/Left` (advance/back), `Ctrl+Space` (voice on/off), `Ctrl+M` (mark). Press `Ctrl+I` to enter interactive mode, then `=`/`-` (font), `[`/`]` (width), `,`/`.` (opacity), `S` (sentence/para), `Shift+1` (save preset), `1` (recall). Confirm presets survive an overlay close + relaunch.
- [ ] **Step 6:** Record a short take → **Stop & export** → confirm `embalio_markers.edl` + `embalio_chapters.txt` land in the export dir and the project advances to Publish. Import the `.edl` into DaVinci Resolve.
- [ ] **Step 7:** Note any failures back into the design spec's "honest limits" section.

---

## Self-Review

**Spec coverage:**
- §4 one-click Electron shell → Tasks 1–2, 11. ✓
- §5 merged teleprompter (chunking, live-adjust, presets, mirror, one-line-not-scroll, voice-follow override) → Tasks 3, 4, 5, 6, 7. ✓
- §5 port mapping (setContentProtection, click-through, globalShortcut, hide/show, drag, consume beats) → existing cockpit + Task 1/7. ✓
- §6 guided-shoot (checklist + 10s audio/framing test) → Tasks 8, 9, 10, 11. ✓
- §7 components (`TeleprompterOverlay`/cockpit, controller logic, `teleprompterStore`, `chunking`, `audio-meter`) → Tasks 3–10. ✓
- §7 preset schema (font/opacity/width/height/top/left/mode/mirror) → Task 4 `Layout`. ✓
- §9 testing (store, chunking, audio-meter, checklist; voicefollow/markers unchanged) → Tasks 3–9. ✓
- §10 build order matches Slices 1–6. ✓
- Non-goals (livestream, OBS-websocket, batch, in-app capture, macOS, installer, rebindable hotkeys, synced presets) → not built. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. The only conditional is Task 7 Step 1's "match the repo's component-test setup" — acceptable because it depends on whether `vitest.config` already declares jsdom (the engineer checks one file).

**Type consistency:** `Layout`, `ChunkMode`, `Adjustable`, `Band`, `StoreData`, `TeleprompterStore`, `ChecklistItem` are defined once and reused with matching names. `toLines(say, mode)`, `adjust(l, key, delta)`, `setPreset/getPreset(store, slot[, layout])`, `peakToDbfs/classifyDbfs`, `checklistFor/toggle/allChecked` signatures are consistent across tasks and the components that call them. The Electron preset bridge names (`getStore`/`setStore`) match between `preload.js`, `resolveStore()`, and `makeElectronStore`. ✓
