// When running in browser (no Electron), mock focusFee so the app works.
// Focus tracking is simulated — use the desktop app for real window detection.
if (typeof window !== 'undefined' && !(window as any).focusFee) {
  let running = false;
  let paused = false;
  let centsOwed = 0;
  let feePerMin = 0.25;
  let lastTick = Date.now();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const callbacks: Array<(d: { distracted: boolean; centsOwed: number; activeTitle: string; paused?: boolean }) => void> = [];

  const tick = () => {
    const now = Date.now();
    const elapsedMin = (now - lastTick) / 60000;
    lastTick = now;
    const distracted = false;
    if (distracted && !paused) centsOwed += Math.ceil(elapsedMin * feePerMin * 100);
    callbacks.forEach(cb => cb({ distracted, centsOwed, activeTitle: running ? 'Browser (use desktop app)' : '—', activeTitles: running ? ['Browser (use desktop app)'] : [], activeOwner: '', paused }));
  };

  (window as any).focusFee = {
    start: async (p: { blacklist: string[]; feePerMin: number }) => {
      running = true;
      paused = false;
      centsOwed = 0;
      feePerMin = p.feePerMin;
      lastTick = Date.now();
      intervalId = setInterval(tick, 1500);
      tick();
      return { ok: true };
    },
    pause: async () => { paused = true; return { ok: true }; },
    resume: async () => { paused = false; lastTick = Date.now(); return { ok: true }; },
    stop: async () => {
      running = false;
      paused = false;
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
      return { centsOwed };
    },
    onTick: (cb: (d: { distracted: boolean; centsOwed: number; activeTitle: string; paused?: boolean }) => void) => {
      callbacks.push(cb);
      tick();
    }
  };
}
