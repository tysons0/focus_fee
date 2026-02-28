//exposes API to renderer process. can be used to start/stop session and listen for tick events
//bridge between UI and electron.
//start,stop,tick listener = safe methods UI can call to control and get updates from main process.
//  main process (main.ts) does the monitoring and logic, and sends updates to UI via tick events.
import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('focusFee', {
  start: (payload: { blacklist: string[]; feePerMin: number }) =>
    ipcRenderer.invoke('session:start', payload),
  pause: () => ipcRenderer.invoke('session:pause'),
  resume: () => ipcRenderer.invoke('session:resume'),
  stop: () => ipcRenderer.invoke('session:stop'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setBlacklist: (blacklist: string[]) => ipcRenderer.invoke('settings:set-blacklist', { blacklist }),
  onTick: (cb: (data: { distracted: boolean; centsOwed: number; activeTitle: string; blacklist?: string[]; paused?: boolean }) => void) =>
    ipcRenderer.on('tick', (_e, d) => cb(d)),
});
