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
    width: 1280,
    height: 860,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  mainWin.loadURL(APP_URL);
}

function createOverlay(projectId) {
  if (overlay && !overlay.isDestroyed()) { overlay.focus(); return; }
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

  overlay.loadURL(`${APP_URL}/overlay/record/${projectId}`);
  overlay.on("closed", () => { overlay = null; });
}

function send(action) {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send("hotkey", action);
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Right", () => send("next"));
  globalShortcut.register("CommandOrControl+Left", () => send("prev"));
  globalShortcut.register("CommandOrControl+Space", () => send("playpause"));
  globalShortcut.register("CommandOrControl+M", () => send("mark"));
  globalShortcut.register("CommandOrControl+I", () => {        // toggle click-through
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
