var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("focusFee", {
  start: (payload) => import_electron.ipcRenderer.invoke("session:start", payload),
  pause: () => import_electron.ipcRenderer.invoke("session:pause"),
  resume: () => import_electron.ipcRenderer.invoke("session:resume"),
  stop: () => import_electron.ipcRenderer.invoke("session:stop"),
  onTick: (cb) => import_electron.ipcRenderer.on("tick", (_e, d) => cb(d))
});
//# sourceMappingURL=preload.cjs.map
