// UI with Solana theme, tabs, and payment setup
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string) ?? (import.meta.env.DEV ? '' : 'http://localhost:3000');

const PAYMENT_OPTIONS = [0.05, 0.15, 0.25, 0.5, 1] as const;

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

const styles = {
  app: {
    minHeight: '100vh',
    background: '#1A1A1A',
    color: '#FFFFFF',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #333',
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 24,
  },
  logo: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '0.02em',
    background: 'linear-gradient(135deg, #3DFFC3 0%, #A64EEB 100%)',
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
    backgroundClip: 'text' as const,
  },
  tabs: {
    display: 'flex' as const,
    gap: 8,
  },
  tab: (active: boolean) => ({
    padding: '10px 20px',
    background: active ? 'rgba(61, 255, 195, 0.15)' : 'transparent',
    border: active ? '1px solid #3DFFC3' : '1px solid transparent',
    borderRadius: 8,
    color: active ? '#3DFFC3' : 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
  }),
  content: {
    padding: 24,
    maxWidth: 900,
    margin: '0 auto',
  },
  input: {
    width: '100%',
    padding: 12,
    marginTop: 6,
    background: '#282828',
    border: '1px solid #444',
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 14,
  },
  select: {
    width: '100%',
    padding: 12,
    marginTop: 6,
    background: '#282828',
    border: '1px solid #444',
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 14,
    cursor: 'pointer',
  },
  label: {
    display: 'block' as const,
    marginBottom: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: 500,
  },
  btn: (variant: 'primary' | 'secondary' = 'primary') => ({
    padding: '12px 24px',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    border: variant === 'secondary' ? '1px solid #444' : 'none',
    background: variant === 'primary' ? 'linear-gradient(135deg, #3DFFC3 0%, #A64EEB 100%)' : '#282828',
    color: variant === 'primary' ? '#1A1A1A' : '#FFFFFF',
  }),
  card: {
    background: '#282828',
    border: '1px solid #333',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
};

export default function App() {
  const [tab, setTab] = useState<'home' | 'payment'>('home');
  const [distracted, setDistracted] = useState(false);
  const [cents, setCents] = useState(0);
  const [activeTitle, setActiveTitle] = useState('');
  const [solSig, setSolSig] = useState<string | null>(null);
  const [explorer, setExplorer] = useState<string | null>(null);

  const [solanaAddress, setSolanaAddress] = useState('');
  const [selectedPaymentAmount, setSelectedPaymentAmount] = useState<number>(0.25);
  const [blacklistText, setBlacklistText] = useState('YouTube, Twitter, Steam');

  const [paymentMethod, setPaymentMethod] = useState<'credit' | 'direct'>('credit');
  const [addAmount, setAddAmount] = useState(10);
  const [balance, setBalance] = useState(0);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [addFundsToast, setAddFundsToast] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [sessionRunning, setSessionRunning] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const feePerMin = selectedPaymentAmount;

  // Timer: update every second while session is running
  useEffect(() => {
    if (!sessionRunning || sessionStartTime === null) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionRunning, sessionStartTime]);

  useEffect(() => {
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
    setSessionRunning(true);
    setSessionStartTime(Date.now());
    setElapsedSeconds(0);
  }

  function handleAddFunds() {
    if (addAmount < 10) {
      alert('Minimum add amount is $10.');
      return;
    }
    setBalance(b => b + addAmount);
    const msg = paymentMethod === 'direct'
      ? `$${addAmount.toFixed(2)} pulled out of bank account`
      : `$${addAmount.toFixed(2)} deposited`;
    setAddFundsToast(msg);
    setTimeout(() => setAddFundsToast(null), 3000);
  }

  function handlePaymentMethodChange(method: 'credit' | 'direct') {
    setPaymentMethod(method);
    setPaymentModal(method === 'direct' ? 'direct' : 'credit');
  }

  async function stopAndSettle() {
    setSessionRunning(false);
    setSessionStartTime(null);
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
    <div style={styles.app}>
      <header style={styles.header}>
        <img src="/logo.png" alt="Focus Fee" style={{ height: 48, objectFit: 'contain', background: '#000', padding: '8px 12px', borderRadius: 8 }} />
        {sessionRunning && (
          <>
            <span
              style={{
                marginLeft: 'auto',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
            </span>
            <span
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: distracted ? 'rgba(229, 57, 53, 0.2)' : 'rgba(61, 255, 195, 0.15)',
                color: distracted ? '#FF6B6B' : '#3DFFC3',
                border: `1px solid ${distracted ? '#E53935' : '#3DFFC3'}`,
              }}
            >
              {distracted ? '🚫 Unfocused' : '✅ Focused'}
            </span>
          </>
        )}
        <nav style={styles.tabs}>
          <button style={styles.tab(tab === 'home')} onClick={() => setTab('home')}>Homepage</button>
          <button style={styles.tab(tab === 'payment')} onClick={() => setTab('payment')}>Payment</button>
        </nav>
      </header>

      <main style={styles.content}>
        {tab === 'home' && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={styles.label}>Solana address (devnet)</label>
                <input
                  value={solanaAddress}
                  onChange={e => setSolanaAddress(e.target.value)}
                  placeholder="Your SOL address"
                  style={styles.input}
                />
                <details style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  <summary style={{ cursor: 'pointer' }}>Add SOL to your wallet</summary>
                  <p style={{ marginTop: 8, lineHeight: 1.5 }}>
                    <strong>Option 1:</strong> Run <code>solana airdrop 5</code> in the terminal.
                  </p>
                  <p style={{ marginTop: 4, lineHeight: 1.5 }}>
                    <strong>Option 2:</strong> Use <a href="https://faucet.solana.com" target="_blank" rel="noreferrer">Solana Web Faucet</a>.
                  </p>
                </details>
              </div>

              <div>
                <label style={styles.label}>Payment amount ($/min)</label>
                <select
                  value={selectedPaymentAmount}
                  onChange={e => setSelectedPaymentAmount(parseFloat(e.target.value))}
                  style={styles.select}
                >
                  {PAYMENT_OPTIONS.map(v => (
                    <option key={v} value={v}>${v.toFixed(2)}</option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: '1 / span 2' }}>
                <label style={styles.label}>Blacklist (comma separated)</label>
                <input
                  value={blacklistText}
                  onChange={e => setBlacklistText(e.target.value)}
                  style={styles.input}
                />
              </div>
            </section>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={startSession}
                style={{ ...styles.btn('primary'), marginRight: 12 }}
              >
                Start Session
              </button>
              <button onClick={stopAndSettle} style={styles.btn('secondary')}>Stop & Settle</button>
            </div>

            <div style={{ ...styles.card, marginTop: 20 }}>
              {sessionRunning && (
                <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginBottom: 16 }}>
                  {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
                </div>
              )}
              <div>Active window: <b>{activeTitle || '—'}</b></div>
              <div style={{ marginTop: 16 }}>Status: {distracted ? '🚫 Unfocused' : '✅ Focused'}</div>
              <div style={{ marginTop: 8 }}>Running tab: <b>${(cents / 100).toFixed(2)}</b></div>
            </div>

            {solSig && (
              <div style={{ ...styles.card, marginTop: 16, borderColor: '#3DFFC3' }}>
                <div>Invested! Tx Signature: <code>{solSig}</code></div>
                {explorer && <div><a href={explorer} target="_blank" rel="noreferrer">View on Solana Explorer ↗</a></div>}
              </div>
            )}

            <p style={{ marginTop: 24, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              Privacy: only window titles are read to detect distractions.
            </p>
          </>
        )}

        {paymentModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
            }}
            onClick={() => setPaymentModal(null)}
          >
            <div
              style={{
                background: '#282828',
                border: '1px solid #444',
                borderRadius: 12,
                padding: 24,
                maxWidth: 360,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: '#FFF' }}>
                {paymentModal === 'direct'
                  ? 'You will be charged directly from your bank account when fees are incurred. You can use the app freely.'
                  : 'Please deposit funds before you start a session.'}
              </p>
              <button
                onClick={() => setPaymentModal(null)}
                style={{ ...styles.btn('primary'), marginTop: 20, width: '100%' }}
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {addFundsToast && (
          <div
            style={{
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #3DFFC3 0%, #A64EEB 100%)',
              color: '#1A1A1A',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 14,
              boxShadow: '0 4px 20px rgba(61, 255, 195, 0.3)',
              zIndex: 1000,
            }}
          >
            {addFundsToast}
          </div>
        )}

        {tab === 'payment' && (
          <section style={styles.card}>
            <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 18 }}>Payment</h2>

            <p style={{ marginBottom: 16, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
              Add funds (minimum $10). Placeholder only — no real transactions.
            </p>

            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="paymentMethod" checked={paymentMethod === 'credit'} onChange={() => handlePaymentMethodChange('credit')} />
                Credit Card
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="paymentMethod" checked={paymentMethod === 'direct'} onChange={() => handlePaymentMethodChange('direct')} />
                Direct Deposit
              </label>
            </div>

            {paymentMethod === 'credit' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={styles.label}>Card number</label>
                  <input type="text" value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="1234 5678 9012 3456" style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>Name on card</label>
                  <input type="text" value={cardName} onChange={e => setCardName(e.target.value)} placeholder="John Doe" style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>Expiry (MM/YY)</label>
                  <input type="text" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} placeholder="12/25" style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>CVV</label>
                  <input type="text" value={cardCvv} onChange={e => setCardCvv(e.target.value)} placeholder="123" style={styles.input} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={styles.label}>Account number</label>
                  <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Account number" style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>Routing number</label>
                  <input type="text" value={routingNumber} onChange={e => setRoutingNumber(e.target.value)} placeholder="Routing number" style={styles.input} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={styles.label}>Amount to add ($)</label>
                <input
                  type="number"
                  min={10}
                  step={1}
                  value={addAmount}
                  onChange={e => { const v = parseInt(e.target.value, 10); setAddAmount(isNaN(v) ? 10 : Math.max(10, v)); }}
                  style={{ ...styles.input, width: 120 }}
                />
              </div>
              <button onClick={handleAddFunds} style={styles.btn('primary')}>Add funds</button>
            </div>

            <div style={{ marginTop: 20, padding: 16, background: '#1A1A1A', borderRadius: 8 }}>
              <div><strong>Balance:</strong> ${balance.toFixed(2)}</div>
              <div style={{ marginTop: 8 }}><strong>Withdrawn this session:</strong> ${(cents / 100).toFixed(2)}</div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
