// main process. creates window, runs monitoring loop, and handles IPC from renderer

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import activeWin from 'active-win';

let mainWindow: BrowserWindow | null = null;

type SessionState = {       // state of the current focus session
  running: boolean;
  blacklist: string[];
  centsOwed: number;
  feePerMin: number; // $/minute, e.g. 0.25
  lastCheck: number;
};
const state: SessionState = {       //initial state of session
  running: false,
  blacklist: ['youtube', 'twitter', 'instagram', 'steam'],
  centsOwed: 0,
  feePerMin: 0.25,
  lastCheck: Date.now(),
};

// Debounce: require 2 consecutive ticks of same state to avoid flickering
let lastRawDistracted: boolean | null = null;
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

app.whenReady().then(createWindow);         //lifecycle events
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {                  //macOS behavior: re-create window when dock icon is clicked and no other windows are open
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Helper: does a window match any blacklist term? (title or app name)
function windowMatchesBlacklist(win: { title?: string; owner?: { name?: string } } | null | undefined, blacklist: string[]): boolean {
  if (!win) return false;
  const title = (win.title || '').toLowerCase();
  const ownerName = (win.owner?.name || '').toLowerCase();
  return blacklist.some(b => title.includes(b) || ownerName.includes(b));
}

// Use getOpenWindows only (front-to-back order) — single source of truth avoids race with activeWin()
// Debounce: require 2 consecutive ticks of same state to prevent flickering
setInterval(async () => {
  if (!state.running || !mainWindow) return;
  try {
    const openWindows = await (activeWin.getOpenWindows?.() ?? Promise.resolve([]));
    const win = Array.isArray(openWindows) && openWindows.length > 0 ? openWindows[0] : null;

    const now = Date.now();
    const elapsedMin = (now - state.lastCheck) / 60000;

    // Fees ONLY when BOTH: (1) a blacklisted app is open, AND (2) you're focused on it
    const blacklistAppIsOpen = Array.isArray(openWindows) && openWindows.some((w: any) => windowMatchesBlacklist(w, state.blacklist));
    const activeMatches = windowMatchesBlacklist(win, state.blacklist);
    const isOwnApp = win?.owner?.name?.toLowerCase().includes('electron') || (win?.title || '').toLowerCase().includes('focus fee');
    const rawDistracted = blacklistAppIsOpen && activeMatches && !isOwnApp;

    // Debounce: only switch state after 2 consecutive same ticks
    if (lastRawDistracted === null || lastRawDistracted === rawDistracted) {
      displayedDistracted = rawDistracted;
    }
    lastRawDistracted = rawDistracted;

    if (displayedDistracted) {
      state.centsOwed += Math.ceil(elapsedMin * state.feePerMin * 100);
    }
    state.lastCheck = now;

    mainWindow.webContents.send('tick', {
      distracted: displayedDistracted,
      centsOwed: state.centsOwed,
      activeTitle: win?.title || '',
    });
  } catch (e) {
    // swallow errors to keep loop alive
  }
}, 1500);

// IPC handlers for control
ipcMain.handle('session:start', (_e, payload: { blacklist: string[]; feePerMin: number }) => {
  state.blacklist = payload.blacklist.map(s => s.toLowerCase());
  state.feePerMin = payload.feePerMin;
  state.centsOwed = 0;
  state.lastCheck = Date.now();
  state.running = true;
  lastRawDistracted = null;
  displayedDistracted = false;
  return { ok: true };
});

ipcMain.handle('session:stop', () => {      // stop session and return total cents owed
  state.running = false;
  return { centsOwed: state.centsOwed };
});
