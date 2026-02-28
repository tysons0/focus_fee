// When running in browser (no Electron), mock focusFee so the app works.
// Focus tracking is simulated — use the desktop app for real window detection.
if (typeof window !== 'undefined' && !(window as any).focusFee) {
  let running = false;
  let centsOwed = 0;
  let feePerMin = 0.25;
  let lastTick = Date.now();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const callbacks: Array<(d: { distracted: boolean; centsOwed: number; activeTitle: string }) => void> = [];

  const tick = () => {
    const now = Date.now();
    const elapsedMin = (now - lastTick) / 60000;
    lastTick = now;
    // Simulate: alternate distracted every few ticks for demo
    const distracted = running && Math.floor(now / 4500) % 2 === 0;
    if (distracted) {
      centsOwed += Math.ceil(elapsedMin * feePerMin * 100);
    }
    const payload = {
      distracted,
      centsOwed,
      activeTitle: running ? (distracted ? 'Browser (simulated unfocused)' : 'Browser (simulated focused)') : '—'
    };
    callbacks.forEach(cb => cb(payload));
  };

  (window as any).focusFee = {
    start: async (p: { blacklist: string[]; feePerMin: number }) => {
      running = true;
      centsOwed = 0;
      feePerMin = p.feePerMin;
      lastTick = Date.now();
      intervalId = setInterval(tick, 1500);
      tick();
      return { ok: true };
    },
    stop: async () => {
      running = false;
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
      return { centsOwed };
    },
    onTick: (cb: (d: { distracted: boolean; centsOwed: number; activeTitle: string }) => void) => {
      callbacks.push(cb);
      tick();
    }
  };
}
