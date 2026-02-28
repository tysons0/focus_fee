// UI with Solana theme, tabs, and payment setup
import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string) ?? (import.meta.env.DEV ? '' : 'http://localhost:3000');

const PAYMENT_OPTIONS = [0.05, 0.15, 0.25, 0.5, 1] as const;
type ThemeMode = 'dark' | 'light';

type TickPayload = {
  distracted: boolean;
  centsOwed: number;
  activeTitle: string;
  activeTitles?: string[];
  activeOwner?: string;
  blacklist?: string[];
  paused?: boolean;
};

declare global {
  interface Window {
    focusFee: {
      start: (p: { blacklist: string[]; feePerMin: number }) => Promise<{ ok: boolean }>;
      pause: () => Promise<{ ok: boolean }>;
      resume: () => Promise<{ ok: boolean }>;
      stop: () => Promise<{ centsOwed: number }>;
      getSettings: () => Promise<{ blacklist?: string[] }>;
      setBlacklist: (blacklist: string[]) => Promise<{ ok: boolean; blacklist: string[] }>;
      onTick: (cb: (d: TickPayload) => void) => void;
    };
  }
}

const TOTAL_EARNINGS_KEY = 'focusFee_totalEarningsCents';
const PROFILE_SETTINGS_KEY = 'focusFee_profileSettings';
const THEME_MODE_KEY = 'focusFee_themeMode';

const styles = {
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0f0f0f 0%, #1a1a1a 50%, #141414 100%)',
    color: '#FFFFFF',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  header: {
    padding: '16px 32px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 32,
    background: 'rgba(0,0,0,0.3)',
    backdropFilter: 'blur(12px)',
  },
  logo: {
    height: 96,
    objectFit: 'contain' as const,
  },
  tabs: {
    display: 'flex' as const,
    gap: 4,
  },
  tab: (active: boolean) => ({
    padding: '10px 20px',
    background: active ? 'rgba(61, 255, 195, 0.12)' : 'transparent',
    border: 'none',
    borderRadius: 10,
    color: active ? '#3DFFC3' : 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
    transition: 'all 0.2s ease',
  }),
  content: {
    padding: 40,
    maxWidth: 920,
    margin: '0 auto',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 12,
    marginTop: 0,
  },
  input: {
    width: '100%',
    padding: 14,
    marginTop: 8,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 15,
    transition: 'border-color 0.2s ease',
  },
  select: {
    width: '100%',
    padding: 14,
    marginTop: 8,
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.2)',
    borderRadius: 12,
    color: '#000000',
    fontSize: 15,
    cursor: 'pointer',
    transition: 'border-color 0.2s ease',
  },
  label: {
    display: 'block' as const,
    marginBottom: 6,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: 500,
  },
  btn: (variant: 'primary' | 'secondary' = 'primary') => ({
    padding: '14px 28px',
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    border: variant === 'secondary' ? '1px solid rgba(255,255,255,0.15)' : 'none',
    background: variant === 'primary' ? 'linear-gradient(135deg, #3DFFC3 0%, #2dd4aa 50%, #A64EEB 100%)' : 'rgba(255,255,255,0.06)',
    color: variant === 'primary' ? '#0a0a0a' : '#FFFFFF',
    transition: 'all 0.2s ease',
    boxShadow: variant === 'primary' ? '0 4px 20px rgba(61, 255, 195, 0.25)' : 'none',
  }),
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 28,
    marginTop: 24,
  },
};

export default function App() {
  const [tab, setTab] = useState<'profile' | 'home' | 'payment' | 'investments'>('home');
  const [distracted, setDistracted] = useState(false);
  const [cents, setCents] = useState(0);
  const [activeTitle, setActiveTitle] = useState('');
  const [activeTitles, setActiveTitles] = useState<string[]>([]);
  const [activeOwner, setActiveOwner] = useState('');
  const [solSig, setSolSig] = useState<string | null>(null);
  const [explorer, setExplorer] = useState<string | null>(null);

  const [solanaAddress, setSolanaAddress] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePictureDataUrl, setProfilePictureDataUrl] = useState('');
  const [isProfileNameFocused, setIsProfileNameFocused] = useState(false);
  const [profileSaveState, setProfileSaveState] = useState<'idle' | 'saved'>('idle');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(THEME_MODE_KEY);
      return stored === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [selectedPaymentAmount, setSelectedPaymentAmount] = useState<number>(0.25);
  const [blacklistText, setBlacklistText] = useState('YouTube, Twitter, Steam');
  const [lastSavedBlacklistText, setLastSavedBlacklistText] = useState('YouTube, Twitter, Steam');
  const [blacklistHydrated, setBlacklistHydrated] = useState(false);
  const [blacklistSaveState, setBlacklistSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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
  const [displayBlacklist, setDisplayBlacklist] = useState<string[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [totalPausedMs, setTotalPausedMs] = useState(0);
  const pausedAtRef = useRef<number | null>(null);
  const [totalEarningsCents, setTotalEarningsCents] = useState(() => {
    try {
      return parseInt(localStorage.getItem(TOTAL_EARNINGS_KEY) || '0', 10);
    } catch { return 0; }
  });
  const [solPrice, setSolPrice] = useState<number | null>(null);

  const feePerMin = selectedPaymentAmount;

  // Fetch SOL price every 5 minutes
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await res.json();
        if (data?.solana?.usd) setSolPrice(data.solana.usd);
      } catch { /* ignore */ }
    };
    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROFILE_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { profileName?: string; profilePictureDataUrl?: string; profilePictureUrl?: string; solanaAddress?: string };
      if (typeof parsed.profileName === 'string') setProfileName(parsed.profileName);
      if (typeof parsed.profilePictureDataUrl === 'string') setProfilePictureDataUrl(parsed.profilePictureDataUrl);
      else if (typeof parsed.profilePictureUrl === 'string') setProfilePictureDataUrl(parsed.profilePictureUrl);
      if (typeof parsed.solanaAddress === 'string') setSolanaAddress(parsed.solanaAddress);
    } catch {
      // ignore malformed profile settings
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_MODE_KEY, themeMode);
    } catch {
      // ignore persistence errors
    }
  }, [themeMode]);

  // Timer: update every second while session is running (frozen when paused)
  useEffect(() => {
    if (!sessionRunning || sessionStartTime === null) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = paused && pausedAtRef.current
        ? (pausedAtRef.current - sessionStartTime - totalPausedMs) / 1000
        : (now - sessionStartTime - totalPausedMs) / 1000;
      setElapsedSeconds(Math.floor(Math.max(0, elapsed)));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionRunning, sessionStartTime, paused, totalPausedMs]);

  useEffect(() => {
    window.focusFee.onTick((d) => {
      setDistracted(d.distracted);
      setCents(d.centsOwed);
      setActiveTitle(d.activeTitle);
      if (d.activeTitles) setActiveTitles(d.activeTitles);
      else if (d.activeTitle) setActiveTitles([d.activeTitle]);
      if (d.activeOwner !== undefined) setActiveOwner(d.activeOwner);
      if (d.blacklist) setDisplayBlacklist(d.blacklist);
      if (d.paused !== undefined) setPaused(d.paused);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    window.focusFee.getSettings()
      .then((settings) => {
        if (!isMounted) return;
        if (Array.isArray(settings?.blacklist) && settings.blacklist.length > 0) {
          const saved = settings.blacklist.join(', ');
          setBlacklistText(saved);
          setLastSavedBlacklistText(saved);
          setDisplayBlacklist(settings.blacklist);
        }
      })
      .finally(() => {
        if (isMounted) setBlacklistHydrated(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const blacklist = useMemo(
    () => blacklistText.split(',').map(s => s.trim()).filter(Boolean),
    [blacklistText]
  );
  const isBlacklistDirty = blacklistHydrated && blacklistText.trim() !== lastSavedBlacklistText.trim();
  const profileInitial = (profileName.trim().slice(0, 1) || 'U').toUpperCase();

  function saveProfileSettings() {
    try {
      localStorage.setItem(
        PROFILE_SETTINGS_KEY,
        JSON.stringify({
          profileName: profileName.trim(),
          profilePictureDataUrl: profilePictureDataUrl.trim(),
          solanaAddress: solanaAddress.trim(),
        })
      );
      setProfileSaveState('saved');
    } catch {
      setProfileSaveState('idle');
    }
  }

  function handleProfilePictureFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      setProfilePictureDataUrl(value);
      if (profileSaveState !== 'idle') setProfileSaveState('idle');
    };
    reader.readAsDataURL(file);
  }

  async function saveBlacklist() {
    setBlacklistSaveState('saving');
    try {
      const result = await window.focusFee.setBlacklist(blacklist);
      const persistedText = result.blacklist.join(', ');
      setBlacklistText(persistedText);
      setLastSavedBlacklistText(persistedText);
      setDisplayBlacklist(result.blacklist);
      setBlacklistSaveState('saved');
    } catch {
      setBlacklistSaveState('error');
    }
  }

  async function startSession() {
    setSolSig(null);
    setExplorer(null);
    await window.focusFee.start({ blacklist, feePerMin });
    setSessionRunning(true);
    setSessionStartTime(Date.now());
    setElapsedSeconds(0);
    setTotalPausedMs(0);
    pausedAtRef.current = null;
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
    setTotalPausedMs(0);
    pausedAtRef.current = null;
    const { centsOwed } = await window.focusFee.stop();
    const newTotal = totalEarningsCents + centsOwed;
    setTotalEarningsCents(newTotal);
    try { localStorage.setItem(TOTAL_EARNINGS_KEY, String(newTotal)); } catch { /* ignore */ }
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
    <div style={{ ...styles.app, ...(themeMode === 'light' ? { filter: 'invert(1) hue-rotate(180deg)' } : {}) }}>
      <header style={styles.header}>
        <img src="/logo.png" alt="Focus Fee" style={{ ...styles.logo, ...(themeMode === 'light' ? { filter: 'invert(1) hue-rotate(180deg)' } : {}) }} />
        <div style={{ flex: 1, minWidth: 16 }} />
        {sessionRunning && (
          <>
            <span
              style={{
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
                background: paused ? 'rgba(255,193,7,0.15)' : distracted ? 'rgba(229, 57, 53, 0.2)' : 'rgba(61, 255, 195, 0.15)',
                color: paused ? '#FFC107' : distracted ? '#FF6B6B' : '#3DFFC3',
                border: `1px solid ${paused ? '#FFC107' : distracted ? '#E53935' : '#3DFFC3'}`,
              }}
            >
              {paused ? '⏸ Paused' : distracted ? '🚫 Unfocused' : '✅ Focused'}
            </span>
          </>
        )}
        <nav style={styles.tabs}>
          <button style={styles.tab(tab === 'home')} onClick={() => setTab('home')}>Homepage</button>
          <button style={styles.tab(tab === 'payment')} onClick={() => setTab('payment')}>Payment</button>
          <button style={styles.tab(tab === 'investments')} onClick={() => setTab('investments')}>Investments</button>
          <button style={styles.tab(tab === 'profile')} onClick={() => setTab('profile')}>Profile</button>
        </nav>
      </header>

      <main style={styles.content}>
        {tab === 'profile' && (
          <>
            <header style={{ marginBottom: 40 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #3DFFC3 0%, #A64EEB 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Profile
              </h1>
              <p style={{ marginTop: 8, fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                Manage your profile, wallet settings, and high-contrast theme.
              </p>
            </header>

            <section style={styles.card}>
              <h2 style={{ ...styles.sectionHeader, marginTop: 0 }}>User profile</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                {profilePictureDataUrl ? (
                  <img
                    src={profilePictureDataUrl}
                    alt="Profile"
                    style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }}
                  />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    {profileInitial}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{profileName.trim() || 'User'}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Personal settings</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                <div>
                  <label style={styles.label}>Display name</label>
                  <input
                    value={profileName}
                    onChange={e => {
                      setProfileName(e.target.value);
                      if (profileSaveState !== 'idle') setProfileSaveState('idle');
                    }}
                    onFocus={() => setIsProfileNameFocused(true)}
                    onBlur={() => setIsProfileNameFocused(false)}
                    placeholder="Your name"
                    style={{
                      ...styles.input,
                      border: isProfileNameFocused ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
                    }}
                  />
                </div>
                <div>
                  <label style={styles.label}>Profile picture file</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureFileChange}
                    style={styles.input}
                  />
                  <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    Select an image from your computer. It is saved locally on this device.
                  </div>
                </div>
                <div>
                  <label style={styles.label}>Solana address (devnet)</label>
                  <input
                    value={solanaAddress}
                    onChange={e => {
                      setSolanaAddress(e.target.value);
                      if (profileSaveState !== 'idle') setProfileSaveState('idle');
                    }}
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
              </div>

              <h2 style={{ ...styles.sectionHeader, marginTop: 28 }}>Theme</h2>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  onClick={() => setThemeMode('dark')}
                  style={{ ...styles.btn(themeMode === 'dark' ? 'primary' : 'secondary'), padding: '10px 16px' }}
                >
                  Black
                </button>
                <button
                  onClick={() => setThemeMode('light')}
                  style={{ ...styles.btn(themeMode === 'light' ? 'primary' : 'secondary'), padding: '10px 16px' }}
                >
                  White
                </button>
              </div>

              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={saveProfileSettings} style={styles.btn('secondary')}>Save Profile</button>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                  {profileSaveState === 'saved' ? 'Saved' : 'Make changes, then save'}
                </span>
              </div>
            </section>
          </>
        )}

        {tab === 'home' && (
          <>
            <header style={{ marginBottom: 40 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #3DFFC3 0%, #A64EEB 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Focus Session
              </h1>
              <p style={{ marginTop: 8, fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                Stay on task. Get charged when you're distracted by blacklisted apps.
              </p>
            </header>

            <h2 style={styles.sectionHeader}>Setup</h2>
            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
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
                  onChange={e => {
                    setBlacklistText(e.target.value);
                    if (blacklistSaveState !== 'idle') setBlacklistSaveState('idle');
                  }}
                  style={styles.input}
                  placeholder="YouTube, Twitter, Steam, Instagram..."
                />
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={saveBlacklist}
                    style={styles.btn('secondary')}
                    disabled={!isBlacklistDirty || blacklistSaveState === 'saving'}
                  >
                    {blacklistSaveState === 'saving' ? 'Saving…' : 'Save Blacklist'}
                  </button>
                  <span style={{ fontSize: 13, color: blacklistSaveState === 'error' ? '#FF6B6B' : 'rgba(255,255,255,0.65)' }}>
                    {blacklistSaveState === 'saved' && !isBlacklistDirty && 'Saved'}
                    {blacklistSaveState === 'error' && 'Save failed'}
                    {isBlacklistDirty && blacklistSaveState !== 'saving' && 'Unsaved changes'}
                  </span>
                </div>
              </div>
            </section>

            <h2 style={{ ...styles.sectionHeader, marginTop: 32 }}>Session</h2>
            <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={startSession}
                style={{ ...styles.btn('primary') }}
                disabled={sessionRunning}
              >
                Start Session
              </button>
              {sessionRunning && (
                <button
                  onClick={paused
                    ? () => {
                        const now = Date.now();
                        if (pausedAtRef.current) setTotalPausedMs(prev => prev + (now - pausedAtRef.current!));
                        pausedAtRef.current = null;
                        setPaused(false);
                        window.focusFee.resume();
                      }
                    : () => {
                        pausedAtRef.current = Date.now();
                        setPaused(true);
                        window.focusFee.pause();
                      }
                  }
                  style={styles.btn('secondary')}
                >
                  {paused ? '▶ Resume' : '⏸ Pause'}
                </button>
              )}
              <button onClick={stopAndSettle} style={styles.btn('secondary')} disabled={!sessionRunning}>
                Stop & Settle
              </button>
            </div>

            <h2 style={{ ...styles.sectionHeader, marginTop: 40 }}>Status</h2>
            <div style={styles.card}>
              {sessionRunning && (
                <>
                  <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginBottom: 16 }}>
                    {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
                  </div>
                  {displayBlacklist.length > 0 && (
                    <div style={{ marginBottom: 16, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                      Blacklist: {displayBlacklist.join(', ')}
                    </div>
                  )}
                </>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    {activeTitles.length > 1 ? 'Active windows (split screen)' : 'Active window'}
                  </span>
                  <div style={{ marginTop: 4, fontWeight: 500 }}>
                    {activeTitles.length > 1
                      ? activeTitles.map((t, i) => <div key={i} style={{ marginBottom: i < activeTitles.length - 1 ? 6 : 0 }}>{t}</div>)
                      : (activeTitles[0] || activeTitle || '—')}
                  </div>
                  {activeOwner && (
                    <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>App: {activeOwner}</div>
                  )}
                </div>
                <div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Status</span>
                  <div style={{ marginTop: 4, fontWeight: 600, color: distracted ? '#FF6B6B' : '#3DFFC3' }}>
                    {distracted ? '🚫 Unfocused' : '✅ Focused'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Running tab</span>
                  <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700 }}>${(cents / 100).toFixed(2)}</div>
                </div>
              </div>
            </div>

            {solSig && (
              <div style={{ ...styles.card, marginTop: 24, borderColor: 'rgba(61, 255, 195, 0.3)', background: 'rgba(61, 255, 195, 0.05)' }}>
                <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#3DFFC3' }}>Invested</h3>
                <div style={{ fontSize: 13, wordBreak: 'break-all' }}><code style={{ background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: 6 }}>{solSig}</code></div>
                {explorer && <div style={{ marginTop: 12 }}><a href={explorer} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>View on Solana Explorer ↗</a></div>}
              </div>
            )}

            <footer style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                Privacy: only window titles are read to detect distractions.
              </p>
            </footer>
          </>
        )}

        {paymentModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
            }}
            onClick={() => setPaymentModal(null)}
          >
            <div
              style={{
                background: 'linear-gradient(180deg, #1e1e1e 0%, #161616 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 28,
                maxWidth: 380,
                boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
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
              bottom: 32,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '16px 28px',
              background: 'linear-gradient(135deg, #3DFFC3 0%, #2dd4aa 50%, #A64EEB 100%)',
              color: '#0a0a0a',
              borderRadius: 14,
              fontWeight: 600,
              fontSize: 14,
              boxShadow: '0 8px 32px rgba(61, 255, 195, 0.35)',
              zIndex: 1000,
            }}
          >
            {addFundsToast}
          </div>
        )}

        {tab === 'payment' && (
          <>
            <header style={{ marginBottom: 40 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #3DFFC3 0%, #A64EEB 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Payment
              </h1>
              <p style={{ marginTop: 8, fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                Add funds to your balance. Minimum $10. Placeholder only — no real transactions.
              </p>
            </header>

            <section style={styles.card}>
            <h2 style={{ ...styles.sectionHeader, marginTop: 0 }}>Payment method</h2>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="paymentMethod" checked={paymentMethod === 'credit'} onChange={() => handlePaymentMethodChange('credit')} />
                Credit Card
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="paymentMethod" checked={paymentMethod === 'direct'} onChange={() => handlePaymentMethodChange('direct')} />
                Direct Deposit
              </label>
            </div>

            <h2 style={{ ...styles.sectionHeader, marginTop: 24 }}>{paymentMethod === 'credit' ? 'Card details' : 'Bank details'}</h2>
            {paymentMethod === 'credit' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
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

            <h2 style={{ ...styles.sectionHeader, marginTop: 24 }}>Add funds</h2>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
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

            <h2 style={{ ...styles.sectionHeader, marginTop: 28 }}>Balance</h2>
            <div style={{ marginTop: 12, padding: 20, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Balance</span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>${balance.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Withdrawn this session</span>
                <span style={{ fontWeight: 600 }}>${(cents / 100).toFixed(2)}</span>
              </div>
            </div>
          </section>
          </>
        )}

        {tab === 'investments' && (
          <>
            <header style={{ marginBottom: 40 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #3DFFC3 0%, #A64EEB 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Investments
              </h1>
              <p style={{ marginTop: 8, fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                Total earnings from focus fees, converted to SOL at current market price.
              </p>
            </header>

            <section style={styles.card}>
              <h2 style={{ ...styles.sectionHeader, marginTop: 0 }}>Total earnings</h2>
              <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>
                ${(totalEarningsCents / 100).toFixed(2)}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                All-time focus fees collected
              </div>

              <h2 style={{ ...styles.sectionHeader, marginTop: 32 }}>Solana value</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>SOL price (USD)</span>
                  <span style={{ fontWeight: 600 }}>
                    {solPrice != null ? `$${solPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : 'Loading...'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>Your earnings in SOL</span>
                  <span style={{ fontWeight: 600, fontSize: 18 }}>
                    {solPrice != null && solPrice > 0
                      ? `${(totalEarningsCents / 100 / solPrice).toFixed(6)} SOL`
                      : '—'}
                  </span>
                </div>
              </div>
              <p style={{ marginTop: 20, marginBottom: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                SOL price updates every 5 minutes via CoinGecko.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
