import { contextBridge, ipcRenderer } from 'electron';

//exposes API to renderer process. can be used to start/stop session and listen for tick events
contextBridge.exposeInMainWorld('focusFee', {
  start: (payload: { blacklist: string[]; feePerMin: number }) =>
    ipcRenderer.invoke('session:start', payload),       // payload contains blacklist and feePerMin
  stop: () =>
    ipcRenderer.invoke('session:stop'),         // returns { centsOwed: number }
  onTick: (cb: (data: { distracted: boolean; centsOwed: number; activeTitle: string }) => void) =>      
    ipcRenderer.on('tick', (_e, d) => cb(d)),       // d contains { distracted, centsOwed, activeTitle }
});
