const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("embalio", {
  openOverlay: (projectId) => ipcRenderer.send("overlay:open", projectId),
  onHotkey: (cb) => {
    const handler = (_e, action) => cb(action);
    ipcRenderer.on("hotkey", handler);
    return () => ipcRenderer.off("hotkey", handler);
  },
  exportMarkers: (files) => ipcRenderer.send("export-markers", files),
  getStore: () => ipcRenderer.sendSync("store:get-sync"),
  setStore: (data) => ipcRenderer.send("store:set", data),
});
