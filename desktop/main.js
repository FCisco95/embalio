const { app, BrowserWindow, globalShortcut, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { startSidecar } = require("./sidecar/server");
let sidecar = null;

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

app.whenReady().then(() => {
  if (process.env.EMBALIO_VOICE !== "off") {
    try { sidecar = startSidecar(); } catch (e) { console.error("sidecar failed", e); }
  }
  createWindow();
  registerShortcuts();
});
app.on("will-quit", () => { globalShortcut.unregisterAll(); if (sidecar) sidecar.stop(); });
app.on("window-all-closed", () => app.quit());
