const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("embalio", {
  onHotkey: (cb) => {
    const handler = (_e, action) => cb(action);
    ipcRenderer.on("hotkey", handler);
    return () => ipcRenderer.off("hotkey", handler);
  },
  exportMarkers: (files) => ipcRenderer.send("export-markers", files),
});
