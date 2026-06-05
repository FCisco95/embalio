const { app, BrowserWindow, globalShortcut, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { startSidecar } = require("./sidecar/server");
const http = require("http");
const { spawn } = require("child_process");
const Store = require("electron-store");
const store = new Store({ name: "teleprompter", defaults: { presets: {}, last: null }, accessPropertiesByDotNotation: false });
let sidecar = null;
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
  nextProc.on("error", (e) => console.error("next spawn failed", e));
}

function killNext() {
  if (!nextProc || nextProc.killed) return;
  if (process.platform === "win32") {
    try { spawn("taskkill", ["/pid", String(nextProc.pid), "/T", "/F"]); }
    catch { nextProc.kill(); }
  } else {
    nextProc.kill();
  }
  nextProc = null;
}

const APP_URL = process.env.EMBALIO_URL || "http://localhost:3000";
const EXPORT_DIR = process.env.EMBALIO_EXPORT_DIR || app.getPath("documents");

let mainWin = null;
let overlay = null;
let interactive = false;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  mainWin.loadURL(APP_URL);
  mainWin.on("closed", () => { mainWin = null; });
}

function createOverlay(projectId) {
  if (overlay && !overlay.isDestroyed()) {
    overlay.focus();
    // Re-opened panel must stay in sync — resend the open state.
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send("overlay-state", true);
    return;
  }
  overlay = new BrowserWindow({
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

  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setContentProtection(true);                  // WDA_EXCLUDEFROMCAPTURE — invisible to OBS/capture
  overlay.setIgnoreMouseEvents(true, { forward: true }); // click-through

  overlay.loadURL(`${APP_URL}/overlay/record/${encodeURIComponent(projectId)}`);
  overlay.on("closed", () => {
    overlay = null;
    interactive = false; // reset so state doesn't leak across sessions
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send("overlay-state", false);
  });
  // Tell the main-window control panel the overlay is now open (so it renders).
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send("overlay-state", true);
}

function send(action) {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send("hotkey", action);
}

// Toggle click-through + focusability (interactive mode). Main is the single
// source of truth: after flipping native flags, push the EXPLICIT state to the
// renderer so the in-app label can never desync from the OS-level flags.
function toggleInteractive() {
  if (!overlay || overlay.isDestroyed()) return;
  interactive = !interactive;
  overlay.setIgnoreMouseEvents(!interactive, { forward: true });
  overlay.setFocusable(interactive);
  if (interactive) overlay.focus();
  send(interactive ? "interactive-on" : "interactive-off");
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Right", () => send("next"));
  globalShortcut.register("CommandOrControl+Left", () => send("prev"));
  globalShortcut.register("CommandOrControl+Space", () => send("playpause"));
  globalShortcut.register("CommandOrControl+M", () => send("mark"));
  globalShortcut.register("CommandOrControl+I", () => toggleInteractive());
}

ipcMain.on("overlay:open", (_e, projectId) => {
  if (typeof projectId !== "string" || !projectId) return;
  if (process.env.EMBALIO_VOICE !== "off" && !sidecar) {
    try { sidecar = startSidecar(); } catch (e) { console.error("sidecar failed", e); }
  }
  createOverlay(projectId);
});

ipcMain.on("overlay:toggle-interactive", () => toggleInteractive());

// Hover-to-unlock: while LOCKED the window is click-through, but forward:true
// keeps mousemove flowing, so the renderer can ask for clicks to be momentarily
// enabled when the cursor hovers the lock icon (and restored on leave). Only
// honored while locked — in interactive mode the canonical flags rule.
ipcMain.on("overlay:set-ignore-mouse", (_e, ignore) => {
  if (!overlay || overlay.isDestroyed() || interactive) return;
  overlay.setIgnoreMouseEvents(!!ignore, { forward: true });
});

// Forward control-panel actions to the overlay renderer via the hotkey channel.
ipcMain.on("overlay:control", (_e, action) => { if (typeof action === "string") send(action); });

ipcMain.on("overlay:close", () => { if (overlay && !overlay.isDestroyed()) overlay.close(); });

// The layout's `width` resizes the actual window (CSS can't grow past the
// window bounds). Height stays as-is — the subtitle pill sizes to its content.
ipcMain.on("overlay:resize", (_e, width) => {
  if (!overlay || overlay.isDestroyed()) return;
  if (typeof width !== "number" || !Number.isFinite(width)) return;
  const w = Math.max(360, Math.min(3840, Math.round(width)));
  const [, h] = overlay.getSize();
  overlay.setSize(w, h);
});

ipcMain.on("store:get-sync", (e) => {
  try {
    e.returnValue = { presets: store.get("presets"), last: store.get("last") };
  } catch (err) {
    console.error("store:get-sync failed", err);
    e.returnValue = { presets: {}, last: null };
  }
});

ipcMain.on("store:set", (_e, data) => {
  try {
    if (typeof data !== "object" || data === null) return;
    store.set("presets", data.presets ?? {});
    store.set("last", data.last ?? null);
  } catch (err) {
    console.error("store:set failed", err);
  }
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

app.whenReady().then(async () => {
  if (!(await ping(APP_URL))) startNextIfNeeded();
  const ok = await waitForServer(APP_URL);
  if (!ok) {
    dialog.showErrorBox("Embalio", `Dev server did not answer at ${APP_URL} within 60s. Check the terminal for build errors.`);
    app.quit();
    return;
  }
  createMainWindow();
  registerShortcuts();
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (sidecar) sidecar.stop();
  killNext();
});
app.on("window-all-closed", () => app.quit());
