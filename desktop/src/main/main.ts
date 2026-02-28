// main process. creates window, runs monitoring loop, and handles IPC from renderer

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import activeWin from 'active-win';

let mainWindow: BrowserWindow | null = null;

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
  blacklist: ['youtube', 'twitter', 'instagram', 'steam'],
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

// Use activeWin() for the focused window (most reliable) + getOpenWindows for split screen and blacklist check
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
    const isOwnApp = win?.owner?.name?.toLowerCase().includes('electron') || (win?.title || '').toLowerCase().includes('focus fee');
    const rawDistracted = !isOwnApp && (activeMatches || (secondMatches && blacklistAppIsOpen));

    // Debug: log every ~10 sec to verify detection
    if (Math.floor(now / 10000) !== Math.floor((now - 1500) / 10000)) {
      console.log('[Focus Fee] Active:', win?.title || '(none)', '| Owner:', win?.owner?.name || '(none)');
      console.log('[Focus Fee] Match:', activeMatches, '| isOwn:', isOwnApp, '| distracted:', rawDistracted);
    }

    // Debounce: require 2 consecutive same ticks
    if (lastRawDistracted === rawDistracted) {
      sameCount++;
      if (sameCount >= 2 || lastRawDistracted === null) {
        displayedDistracted = rawDistracted;
      }
    } else {
      sameCount = 1;
      if (lastRawDistracted === null) displayedDistracted = rawDistracted;
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
ipcMain.handle('session:start', (_e, payload: { blacklist: string[]; feePerMin: number }) => {
  state.blacklist = payload.blacklist.map(s => s.toLowerCase());
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
