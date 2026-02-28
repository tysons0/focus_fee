
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import activeWin from 'active-win';
// main process creates window, runs monitoring loop, and handles IPC from renderer
let mainWindow: BrowserWindow | null = null;

type SessionState = {       // state of the current focus session
  running: boolean;
  blacklist: string[];
  centsOwed: number;
  feePerMin: number; // $/minute, e.g. 0.5
  lastCheck: number;
};
const state: SessionState = {       //initial state of session
  running: false,
  blacklist: ['youtube', 'twitter', 'instagram', 'steam'],
  centsOwed: 0,
  feePerMin: 0.5,
  lastCheck: Date.now(),
};

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

// Monitoring loop
setInterval(async () => {
  if (!state.running || !mainWindow) return;
  try {                             //checks active window title against blacklist every 1.5 seconds.
    const win = await activeWin();
    const title = (win?.title || '').toLowerCase();
    const now = Date.now();
    const elapsedMin = (now - state.lastCheck) / 60000;         // calculate elapsed time in minutes since last check
    const distracted = state.blacklist.some(b => title.includes(b));

    if (distracted) {                       //if offtask, update cents owed based on elapsed time and fee per minute
      state.centsOwed += Math.ceil(elapsedMin * state.feePerMin * 100);
    }
    state.lastCheck = now;

    mainWindow.webContents.send('tick', {           //send tick event to renderer with updated data
      distracted,
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
  return { ok: true };
});

ipcMain.handle('session:stop', () => {      // stop session and return total cents owed
  state.running = false;
  return { centsOwed: state.centsOwed };
});
