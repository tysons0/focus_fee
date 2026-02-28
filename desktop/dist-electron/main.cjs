var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var import_electron = require("electron");
var import_node_path = __toESM(require("node:path"), 1);
var import_active_win = __toESM(require("active-win"), 1);
let mainWindow = null;
const state = {
  //initial state of session
  running: false,
  blacklist: ["youtube", "twitter", "instagram", "steam"],
  centsOwed: 0,
  feePerMin: 0.25,
  lastCheck: Date.now()
};
let lastRawDistracted = null;
let displayedDistracted = false;
async function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: import_node_path.default.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const isDev = !!process.env.VITE_DEV_SERVER;
  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173");
  } else {
    await mainWindow.loadFile(import_node_path.default.join(__dirname, "../../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron.app.whenReady().then(createWindow);
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
import_electron.app.on("activate", () => {
  if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
function windowMatchesBlacklist(win, blacklist) {
  if (!win) return false;
  const title = (win.title || "").toLowerCase();
  const ownerName = (win.owner?.name || "").toLowerCase();
  return blacklist.some((b) => title.includes(b) || ownerName.includes(b));
}
setInterval(async () => {
  if (!state.running || !mainWindow) return;
  try {
    const openWindows = await (import_active_win.default.getOpenWindows?.() ?? Promise.resolve([]));
    const win = Array.isArray(openWindows) && openWindows.length > 0 ? openWindows[0] : null;
    const now = Date.now();
    const elapsedMin = (now - state.lastCheck) / 6e4;
    const blacklistAppIsOpen = Array.isArray(openWindows) && openWindows.some((w) => windowMatchesBlacklist(w, state.blacklist));
    const activeMatches = windowMatchesBlacklist(win, state.blacklist);
    const isOwnApp = win?.owner?.name?.toLowerCase().includes("electron") || (win?.title || "").toLowerCase().includes("focus fee");
    const rawDistracted = blacklistAppIsOpen && activeMatches && !isOwnApp;
    if (lastRawDistracted === null || lastRawDistracted === rawDistracted) {
      displayedDistracted = rawDistracted;
    }
    lastRawDistracted = rawDistracted;
    if (displayedDistracted) {
      state.centsOwed += Math.ceil(elapsedMin * state.feePerMin * 100);
    }
    state.lastCheck = now;
    mainWindow.webContents.send("tick", {
      distracted: displayedDistracted,
      centsOwed: state.centsOwed,
      activeTitle: win?.title || ""
    });
  } catch (e) {
  }
}, 1500);
import_electron.ipcMain.handle("session:start", (_e, payload) => {
  state.blacklist = payload.blacklist.map((s) => s.toLowerCase());
  state.feePerMin = payload.feePerMin;
  state.centsOwed = 0;
  state.lastCheck = Date.now();
  state.running = true;
  lastRawDistracted = null;
  displayedDistracted = false;
  return { ok: true };
});
import_electron.ipcMain.handle("session:stop", () => {
  state.running = false;
  return { centsOwed: state.centsOwed };
});
//# sourceMappingURL=main.cjs.map
