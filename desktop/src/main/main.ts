// main process. creates window, runs monitoring loop, and handles IPC from renderer

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import activeWin from 'active-win';

let mainWindow: BrowserWindow | null = null;
const DEFAULT_BLACKLIST = ['youtube', 'twitter', 'instagram', 'steam'];

function normalizeBlacklist(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<string>();
  for (const value of values) {
    const normalized = String(value).toLowerCase().trim();
    if (normalized) unique.add(normalized);
  }
  return [...unique];
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'focus-fee-settings.json');
}

function loadPersistedBlacklist(): string[] {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as { blacklist?: unknown };
    const loaded = normalizeBlacklist(parsed?.blacklist);
    return loaded.length > 0 ? loaded : [...DEFAULT_BLACKLIST];
  } catch {
    return [...DEFAULT_BLACKLIST];
  }
}

function savePersistedBlacklist(blacklist: string[]) {
  try {
    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify({ blacklist: normalizeBlacklist(blacklist) }, null, 2),
      'utf-8'
    );
  } catch {
    // ignore write errors in dev
  }
}

type SessionState = {       // state of the current focus session
  running: boolean;
  paused: boolean;
  blacklist: string[];
  centsOwed: number;
  feePerMin: number; // $/minute, e.g. 0.25
  lastCheck: number;
};
const state: SessionState = {       //initial state of session
  running: false,
  paused: false,
  blacklist: [...DEFAULT_BLACKLIST],
  centsOwed: 0,
  feePerMin: 0.25,
  lastCheck: Date.now(),
};

// Debounce: require 3 consecutive ticks of same state to avoid flickering
let lastRawDistracted: boolean | null = null;
let sameCount = 0;
let displayedDistracted = false;

async function createWindow() {         //creates the desktop window and loads the React app
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
},

 


  });

  const isDev = !!process.env.VITE_DEV_SERVER;      // dev commands.  VITE_DEV_SERVER in development mode
  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  state.blacklist = loadPersistedBlacklist();
  return createWindow();
});         //lifecycle events
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {                  //macOS behavior: re-create window when dock icon is clicked and no other windows are open
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Domain variations for common sites (window titles may show URL or site name)
const DOMAIN_VARIATIONS: Record<string, string[]> = {
  youtube: ['youtube', 'youtube.com', 'youtu.be', 'youtube music', 'youtube kids', 'youtube studio'],
  twitter: ['twitter', 'twitter.com', 'x.com', 'x -'],
  x: ['x.com', 'x -'],
  instagram: ['instagram', 'instagram.com'],
  steam: ['steam'],
  reddit: ['reddit', 'reddit.com'],
  tiktok: ['tiktok', 'tiktok.com'],
  netflix: ['netflix', 'netflix.com'],
  twitch: ['twitch', 'twitch.tv'],
};

function expandBlacklistTerms(terms: string[]): string[] {
  const expanded = new Set<string>();
  for (const t of terms) {
    const key = t.toLowerCase().trim();
    const variations = DOMAIN_VARIATIONS[key];
    if (variations) variations.forEach(v => expanded.add(v));
    else expanded.add(key);
  }
  return [...expanded];
}

// Match window title or app name against blacklist (detects webpage from browser window title)
function windowMatchesBlacklist(win: { title?: string; owner?: { name?: string } } | null | undefined, blacklist: string[]): boolean {
  if (!win) return false;
  const title = (win.title || '').toLowerCase();
  const ownerName = (win.owner?.name || '').toLowerCase();
  const terms = expandBlacklistTerms(blacklist);
  return terms.some(b => title.includes(b) || ownerName.includes(b));
}

// Goal: Use window titles to detect what webpage we're on. When user has a blacklisted
// site full screen (e.g. YouTube), detect it → show "Unfocused" → charge fees.
setInterval(async () => {
  if (!state.running || !mainWindow) return;
  try {
    const [activeWindow, openWindows] = await Promise.all([
      activeWin(),
      activeWin.getOpenWindows?.() ?? Promise.resolve([]),
    ]);
    const win = activeWindow ?? (Array.isArray(openWindows) && openWindows.length > 0 ? openWindows[0] : null);
    const win2 = Array.isArray(openWindows) && openWindows.length > 1 ? openWindows[1] : null;

    const now = Date.now();
    const elapsedMin = (now - state.lastCheck) / 60000;

    // Fees when focused on blacklisted app (or it's visible in split screen)
    const blacklistAppIsOpen = Array.isArray(openWindows) && openWindows.length > 0 && openWindows.some((w: any) => windowMatchesBlacklist(w, state.blacklist));
    const activeMatches = windowMatchesBlacklist(win, state.blacklist);
    const secondMatches = windowMatchesBlacklist(win2, state.blacklist);
    const titleLower = (win?.title || '').toLowerCase();
    const ownerLower = (win?.owner?.name || '').toLowerCase();
    const isOwnApp = ownerLower.includes('electron') || titleLower.includes('focus fee') || titleLower.includes('focus-fee') || titleLower.includes('focusfee') || ownerLower.includes('focus fee') || ownerLower.includes('focus-fee') || ownerLower.includes('focusfee');
    const rawDistracted = !isOwnApp && (activeMatches || (secondMatches && blacklistAppIsOpen));

    // Debug: log every ~10 sec to verify detection
    if (Math.floor(now / 10000) !== Math.floor((now - 1500) / 10000)) {
      console.log('[Focus Fee] Active:', win?.title || '(none)', '| Owner:', win?.owner?.name || '(none)');
      console.log('[Focus Fee] Match:', activeMatches, '| isOwn:', isOwnApp, '| distracted:', rawDistracted);
    }

    // Debounce: when switching TO distracted (YouTube etc), update immediately.
    // When switching back to focused, require 2 consecutive ticks to avoid flicker.
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

    const activeTitles = win2 != null
      ? [win?.title || '—', win2?.title || '—']
      : [win?.title || ''];
    mainWindow.webContents.send('tick', {
      distracted: displayedDistracted,
      centsOwed: state.centsOwed,
      activeTitle: activeTitles[0] || '',
      activeTitles,
      activeOwner: win?.owner?.name || '',
      blacklist: state.blacklist,
      paused: state.paused,
    });
  } catch (e) {
    // swallow errors to keep loop alive
  }
}, 1500);

// IPC handlers for control
ipcMain.handle('settings:get', () => {
  return { blacklist: state.blacklist };
});

ipcMain.handle('settings:set-blacklist', (_e, payload: { blacklist?: string[] }) => {
  const next = normalizeBlacklist(payload?.blacklist);
  state.blacklist = next;
  savePersistedBlacklist(next);
  return { ok: true, blacklist: state.blacklist };
});

ipcMain.handle('session:start', (_e, payload: { blacklist: string[]; feePerMin: number }) => {
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
  console.log('[Focus Fee] Blacklist:', state.blacklist);
  return { ok: true };
});

ipcMain.handle('session:pause', () => {
  state.paused = true;
  return { ok: true };
});

ipcMain.handle('session:resume', () => {
  state.paused = false;
  state.lastCheck = Date.now();
  return { ok: true };
});

ipcMain.handle('session:stop', () => {      // stop session and return total cents owed
  state.running = false;
  state.paused = false;
  return { centsOwed: state.centsOwed };
});
