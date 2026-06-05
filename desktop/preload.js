const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("embalio", {
  openOverlay: (projectId) => ipcRenderer.send("overlay:open", projectId),
  onHotkey: (cb) => {
    const handler = (_e, action) => cb(action);
    ipcRenderer.on("hotkey", handler);
    return () => ipcRenderer.off("hotkey", handler);
  },
  exportMarkers: (files) => ipcRenderer.send("export-markers", files),
  toggleInteractive: () => ipcRenderer.send("overlay:toggle-interactive"),
  setIgnoreMouse: (ignore) => ipcRenderer.send("overlay:set-ignore-mouse", ignore),
  controlOverlay: (action) => ipcRenderer.send("overlay:control", action),
  closeOverlay: () => ipcRenderer.send("overlay:close"),
  onOverlayState: (cb) => {
    const h = (_e, open) => cb(open);
    ipcRenderer.on("overlay-state", h);
    return () => ipcRenderer.off("overlay-state", h);
  },
  getStore: () => ipcRenderer.sendSync("store:get-sync"),
  setStore: (data) => ipcRenderer.send("store:set", data),
});
