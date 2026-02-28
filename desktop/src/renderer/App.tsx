import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

// Use your Vercel backend URL from desktop/.env : VITE_BACKEND_URL=https://focusfee.vercel.app
const BACKEND = import.meta.env.VITE_BACKEND_URL as string;

type TickPayload = {
  distracted: boolean;
  centsOwed: number;
  activeTitle: string;
};

declare global {
  interface Window {
    focusFee: {
      start: (p: { blacklist: string[]; feePerMin: number }) => Promise<{ ok: boolean }>;
      stop: () => Promise<{ centsOwed: number }>;
      onTick: (cb: (d: TickPayload) => void) => void;
    };
  }
}

export default function App() {
  const [distracted, setDistracted] = useState(false);
  const [cents, setCents] = useState(0);
  const [activeTitle, setActiveTitle] = useState('');
  const [solSig, setSolSig] = useState<string | null>(null);
  const [explorer, setExplorer] = useState<string | null>(null);

  const [solanaAddress, setSolanaAddress] = useState('');
  const [feePerMin, setFeePerMin] = useState(0.5);
  const [blacklistText, setBlacklistText] = useState('YouTube, Twitter, Steam');

  useEffect(() => {
    // Subscribe to ticks emitted by main process
    window.focusFee.onTick((d) => {
      setDistracted(d.distracted);
      setCents(d.centsOwed);
      setActiveTitle(d.activeTitle);
    });
  }, []);

  const blacklist = useMemo(
    () => blacklistText.split(',').map(s => s.trim()).filter(Boolean),
    [blacklistText]
  );

  async function startSession() {
    setSolSig(null);
    setExplorer(null);
    await window.focusFee.start({ blacklist, feePerMin });
  }

  async function stopAndSettle() {
    const { centsOwed } = await window.focusFee.stop();
    if (!solanaAddress) {
      alert('Enter your Solana (devnet) address first.');
      return;
    }
    try {
      const { data } = await axios.post(`${BACKEND}/api/invest`, {
        usdCents: centsOwed,
        toAddress: solanaAddress
      }, { headers: { 'Content-Type': 'application/json' } });

      setSolSig(data.sig);
      setExplorer(data.explorer);
    } catch (e: any) {
      alert(e?.response?.data?.error || e.message);
    }
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1>Focus Fee (Desktop)</h1>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label>Solana address (devnet):</label><br />
          <input
            value={solanaAddress}
            onChange={e => setSolanaAddress(e.target.value)}
            placeholder="Your SOL address"
            style={{ width: '100%', padding: 8, marginTop: 6 }}
          />
        </div>

        <div>
          <label>Fee $/min:</label><br />
          <input
            type="number" min={0.1} step={0.1}
            value={feePerMin}
            onChange={e => setFeePerMin(parseFloat(e.target.value || '0'))}
            style={{ width: '100%', padding: 8, marginTop: 6 }}
          />
        </div>

        <div style={{ gridColumn: '1 / span 2' }}>
          <label>Blacklist (comma separated):</label><br />
          <input
            value={blacklistText}
            onChange={e => setBlacklistText(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 6 }}
          />
        </div>
      </section>

      <div style={{ marginTop: 16 }}>
        <button onClick={startSession} style={{ marginRight: 8, padding: '10px 16px' }}>Start Session</button>
        <button onClick={stopAndSettle} style={{ padding: '10px 16px' }}>Stop &amp; Settle</button>
      </div>

      <div style={{ marginTop: 20, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <div>Active window: <b>{activeTitle || '—'}</b></div>
        <div>Status: {distracted ? '🚫 Distracted' : '✅ Focused'}</div>
        <div>Running tab: <b>${(cents / 100).toFixed(2)}</b></div>
      </div>

      {solSig && (
        <div style={{ marginTop: 16, padding: 12, background: '#f4f8ff', border: '1px solid #cdddfb', borderRadius: 8 }}>
          <div>Invested! Tx Signature: <code>{solSig}</code></div>
          {explorer && <div><a href={explorer} target="_blank" rel="noreferrer">View on Solana Explorer ↗</a></div>}
        </div>
      )}

      <p style={{ marginTop: 24, color: '#666' }}>
        Privacy: only window <i>titles</i> are read to detect distractions. No content is captured.
      </p>
    </div>
  );
}
