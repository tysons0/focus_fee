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
var import_node_fs = __toESM(require("node:fs"), 1);
var import_active_win = __toESM(require("active-win"), 1);
let mainWindow = null;
const DEFAULT_BLACKLIST = ["youtube", "twitter", "instagram", "steam"];
function normalizeBlacklist(values) {
  if (!Array.isArray(values)) return [];
  const unique = /* @__PURE__ */ new Set();
  for (const value of values) {
    const normalized = String(value).toLowerCase().trim();
    if (normalized) unique.add(normalized);
  }
  return [...unique];
}
function getSettingsPath() {
  return import_node_path.default.join(import_electron.app.getPath("userData"), "focus-fee-settings.json");
}
function loadPersistedBlacklist() {
  try {
    const raw = import_node_fs.default.readFileSync(getSettingsPath(), "utf-8");
    const parsed = JSON.parse(raw);
    const loaded = normalizeBlacklist(parsed?.blacklist);
    return loaded.length > 0 ? loaded : [...DEFAULT_BLACKLIST];
  } catch {
    return [...DEFAULT_BLACKLIST];
  }
}
function savePersistedBlacklist(blacklist) {
  try {
    import_node_fs.default.writeFileSync(
      getSettingsPath(),
      JSON.stringify({ blacklist: normalizeBlacklist(blacklist) }, null, 2),
      "utf-8"
    );
  } catch {
  }
}
const state = {
  //initial state of session
  running: false,
  paused: false,
  blacklist: [...DEFAULT_BLACKLIST],
  centsOwed: 0,
  feePerMin: 0.25,
  lastCheck: Date.now()
};
let lastRawDistracted = null;
let sameCount = 0;
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
import_electron.app.whenReady().then(() => {
  state.blacklist = loadPersistedBlacklist();
  return createWindow();
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
import_electron.app.on("activate", () => {
  if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
const DOMAIN_VARIATIONS = {
  youtube: ["youtube", "youtube.com", "youtu.be", "youtube music", "youtube kids", "youtube studio"],
  twitter: ["twitter", "twitter.com", "x.com", "x -"],
  x: ["x.com", "x -"],
  instagram: ["instagram", "instagram.com"],
  steam: ["steam"],
  reddit: ["reddit", "reddit.com"],
  tiktok: ["tiktok", "tiktok.com"],
  netflix: ["netflix", "netflix.com"],
  twitch: ["twitch", "twitch.tv"]
};
function expandBlacklistTerms(terms) {
  const expanded = /* @__PURE__ */ new Set();
  for (const t of terms) {
    const key = t.toLowerCase().trim();
    const variations = DOMAIN_VARIATIONS[key];
    if (variations) variations.forEach((v) => expanded.add(v));
    else expanded.add(key);
  }
  return [...expanded];
}
function windowMatchesBlacklist(win, blacklist) {
  if (!win) return false;
  const title = (win.title || "").toLowerCase();
  const ownerName = (win.owner?.name || "").toLowerCase();
  const terms = expandBlacklistTerms(blacklist);
  return terms.some((b) => title.includes(b) || ownerName.includes(b));
}
setInterval(async () => {
  if (!state.running || !mainWindow) return;
  try {
    const [activeWindow, openWindows] = await Promise.all([
      (0, import_active_win.default)(),
      import_active_win.default.getOpenWindows?.() ?? Promise.resolve([])
    ]);
    const win = activeWindow ?? (Array.isArray(openWindows) && openWindows.length > 0 ? openWindows[0] : null);
    const win2 = Array.isArray(openWindows) && openWindows.length > 1 ? openWindows[1] : null;
    const now = Date.now();
    const elapsedMin = (now - state.lastCheck) / 6e4;
    const blacklistAppIsOpen = Array.isArray(openWindows) && openWindows.length > 0 && openWindows.some((w) => windowMatchesBlacklist(w, state.blacklist));
    const activeMatches = windowMatchesBlacklist(win, state.blacklist);
    const secondMatches = windowMatchesBlacklist(win2, state.blacklist);
    const titleLower = (win?.title || "").toLowerCase();
    const ownerLower = (win?.owner?.name || "").toLowerCase();
    const isOwnApp = ownerLower.includes("electron") || titleLower.includes("focus fee") || titleLower.includes("focus-fee") || titleLower.includes("focusfee") || ownerLower.includes("focus fee") || ownerLower.includes("focus-fee") || ownerLower.includes("focusfee");
    const rawDistracted = !isOwnApp && (activeMatches || secondMatches && blacklistAppIsOpen);
    if (Math.floor(now / 1e4) !== Math.floor((now - 1500) / 1e4)) {
      console.log("[Focus Fee] Active:", win?.title || "(none)", "| Owner:", win?.owner?.name || "(none)");
      console.log("[Focus Fee] Match:", activeMatches, "| isOwn:", isOwnApp, "| distracted:", rawDistracted);
    }
    if (lastRawDistracted === rawDistracted) {
      sameCount++;
      if (sameCount >= 2 || lastRawDistracted === null || rawDistracted) {
        displayedDistracted = rawDistracted;
      }
    } else {
      sameCount = 1;
      if (lastRawDistracted === null || rawDistracted) displayedDistracted = rawDistracted;
    }
    lastRawDistracted = rawDistracted;
    if (displayedDistracted && !state.paused) {
      state.centsOwed += Math.ceil(elapsedMin * state.feePerMin * 100);
    }
    state.lastCheck = now;
    const activeTitles = win2 != null ? [win?.title || "\u2014", win2?.title || "\u2014"] : [win?.title || ""];
    mainWindow.webContents.send("tick", {
      distracted: displayedDistracted,
      centsOwed: state.centsOwed,
      activeTitle: activeTitles[0] || "",
      activeTitles,
      activeOwner: win?.owner?.name || "",
      blacklist: state.blacklist,
      paused: state.paused
    });
  } catch (e) {
  }
}, 1500);
import_electron.ipcMain.handle("settings:get", () => {
  return { blacklist: state.blacklist };
});
import_electron.ipcMain.handle("settings:set-blacklist", (_e, payload) => {
  const next = normalizeBlacklist(payload?.blacklist);
  state.blacklist = next;
  savePersistedBlacklist(next);
  return { ok: true, blacklist: state.blacklist };
});
import_electron.ipcMain.handle("session:start", (_e, payload) => {
  state.blacklist = normalizeBlacklist(payload.blacklist);
  savePersistedBlacklist(state.blacklist);
  state.feePerMin = payload.feePerMin;
  state.centsOwed = 0;
  state.lastCheck = Date.now();
  state.running = true;
  state.paused = false;
  lastRawDistracted = null;
  sameCount = 0;
  displayedDistracted = false;
  console.log("[Focus Fee] Blacklist:", state.blacklist);
  return { ok: true };
});
import_electron.ipcMain.handle("session:pause", () => {
  state.paused = true;
  return { ok: true };
});
import_electron.ipcMain.handle("session:resume", () => {
  state.paused = false;
  state.lastCheck = Date.now();
  return { ok: true };
});
import_electron.ipcMain.handle("session:stop", () => {
  state.running = false;
  state.paused = false;
  return { centsOwed: state.centsOwed };
});
//# sourceMappingURL=main.cjs.map
