const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("embalio", {
  onHotkey: (cb) => ipcRenderer.on("hotkey", (_e, action) => cb(action)),
  exportMarkers: (files) => ipcRenderer.send("export-markers", files),
});
