var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("focusFee", {
  start: (payload) => import_electron.ipcRenderer.invoke("session:start", payload),
  // payload contains blacklist and feePerMin
  stop: () => import_electron.ipcRenderer.invoke("session:stop"),
  // returns { centsOwed: number }
  onTick: (cb) => import_electron.ipcRenderer.on("tick", (_e, d) => cb(d))
  // d contains { distracted, centsOwed, activeTitle }
});
//# sourceMappingURL=preload.cjs.map
