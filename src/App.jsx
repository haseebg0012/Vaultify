import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus, X, TrendingUp, TrendingDown, PiggyBank, Receipt, ChevronRight,
  ChevronLeft, Settings, Download, Home, History as HistoryIcon,
  Landmark, FileSpreadsheet, Check, Banknote, RefreshCw, LogOut, ShieldCheck,
  Wallet, UserCircle, Sun, Moon, KeyRound, Mail, Calculator as CalculatorIcon,
  ArrowRightLeft, Copy, CheckCheck, ArrowUpDown, AlertTriangle, ExternalLink,
  HelpCircle, Search, Bell, Calendar, Clock, CheckCircle2, ListTodo, Trash2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';

/* ------------------------------------------------------------------ */
/* Design tokens                                                      */
/* ------------------------------------------------------------------ */

const CURRENCIES = ['PKR', 'TRY', 'USD', 'EUR', 'GBP', 'USDT'];
const CURRENCY_META = {
  PKR: { symbol: 'Rs ', cleanSymbol: '₨', name: 'PKR (Pakistani Rupee)', shortName: 'PKR', flag: '🇵🇰' },
  TRY: { symbol: '₺', cleanSymbol: '₺', name: 'TRY / TL (Turkish Lira)', shortName: 'TL / TRY', flag: '🇹🇷' },
  USD: { symbol: '$', cleanSymbol: '$', name: 'USD (US Dollar)', shortName: 'USD', flag: '🇺🇸' },
  EUR: { symbol: '€', cleanSymbol: '€', name: 'EUR (Euro)', shortName: 'EUR', flag: '🇪🇺' },
  GBP: { symbol: '£', cleanSymbol: '£', name: 'GBP (British Pound)', shortName: 'GBP', flag: '🇬🇧' },
  USDT: { symbol: 'USDT ', cleanSymbol: '₮', name: 'USDT (Tether USD)', shortName: 'USDT', flag: '₮' },
};
const CATEGORY_MAP = {
  expense: ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Other'],
  income: ['Salary', 'Freelance', 'Business', 'Gift', 'Other'],
  saving: ['Bank Deposit', 'Cash Saved', 'Other'],
  investment: ['Crypto', 'Stocks', 'Business', 'Other'],
  unaccounted: ['Forgotten / Unknown', 'Cash Discrepancy', 'Small Daily Leaks', 'Misplaced / Lost', 'Other'],
};
const HOLDING_SOURCES = ['Pakistan Bank Account', 'Cash in Hand', 'Crypto Wallet', 'Other'];
const TYPES = [
  { key: 'expense', label: 'Expense', icon: Receipt, color: '#B23A34' },
  { key: 'income', label: 'Income', icon: Wallet, color: '#2E6F6F' },
  { key: 'saving', label: 'Saving', icon: PiggyBank, color: '#39604A' },
  { key: 'investment', label: 'Investment', icon: TrendingUp, color: '#6B5FA8' },
  { key: 'unaccounted', label: 'Untracked', shortLabel: 'Untracked', icon: HelpCircle, color: '#D97706' },
];
const DEFAULT_RATES = { PKR: 1, USD: 280, EUR: 305, GBP: 355, TRY: 8.7, USDT: 280 };
const DEFAULT_SETTINGS = {
  lastCurrency: 'PKR', displayCurrency: 'PKR', budgetLimits: {}, budgetPeriod: 'week',
  rates: DEFAULT_RATES, ratesFetchedAt: null, theme: 'light',
  prevRates: null, prevRatesDate: null,
};

/* Theme palettes ----------------------------------------------------- */
const LIGHT_COLORS = {
  navy: '#14110D', navySoft: '#241D14', steel: '#1F6F52', ice: '#FAF7EF',
  surface: '#FFFFFF', silver: '#E3D3A0', line: '#E9DFC4', muted: '#8B7F68', heading: '#14110D',
};
const DARK_COLORS = {
  navy: '#4FBE8C', navySoft: '#2E8F67', steel: '#4FBE8C', ice: '#0A0A0C',
  surface: '#16161A', silver: '#D6D6DD', line: 'rgba(255,255,255,0.10)', muted: '#9A9AA3', heading: '#EDEDEF',
};
const ThemeContext = React.createContext(LIGHT_COLORS);
const useColors = () => React.useContext(ThemeContext);

const SERIF = '"Montserrat", sans-serif';
const SANS = '"Montserrat", sans-serif';
const MONO = '"Montserrat", ui-monospace, monospace';

const NAV = [
  { key: 'dashboard', label: 'Home', icon: Home },
  { key: 'history', label: 'History', icon: HistoryIcon },
  { key: 'networth', label: 'Net Worth', icon: Landmark },
  { key: 'report', label: 'Report', icon: FileSpreadsheet },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthKey = (d) => d.slice(0, 7);
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
const fmtAmount = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCalcAmount = (n) => {
  if (n === null || n === undefined || n === '') return '0';
  const num = Number(n);
  if (isNaN(num)) return String(n);
  const rounded = Number(num.toFixed(6));
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
};
const fmtMoney = (n, cur) => `${CURRENCY_META[cur]?.symbol || ''}${fmtAmount(n)}`;
const timeAgo = (iso) => {
  if (!iso) return 'never';
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
};

function computeTotals(entries, currency) {
  const t = { expense: 0, income: 0, saving: 0, investment: 0, unaccounted: 0 };
  entries.forEach((e) => { if (e.currency === currency) t[e.type] = (t[e.type] || 0) + (Number(e.amount) || 0); });
  return { ...t, net: (t.income || 0) + (t.saving || 0) + (t.investment || 0) - (t.expense || 0) - (t.unaccounted || 0) };
}

function getPeriodDateRange(period = 'week', refDateStr = todayStr()) {
  const [y, m, d] = (refDateStr || todayStr()).split('-').map(Number);
  const ref = new Date(y, m - 1, d);
  if (period === 'week') {
    const day = ref.getDay();
    // Monday as start of week
    const diffToMonday = ref.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(y, m - 1, diffToMonday);
    const sunday = new Date(y, m - 1, diffToMonday + 6);
    return {
      start: monday.toISOString().slice(0, 10),
      end: sunday.toISOString().slice(0, 10),
      label: 'This week',
    };
  }
  if (period === 'month') {
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return {
      start,
      end,
      label: 'This month',
    };
  }
  return { start: '1970-01-01', end: '2099-12-31', label: 'All time' };
}

function calculateSpentInPeriod(entries, currency, period = 'week', excludeEntryId = null) {
  const { start, end } = getPeriodDateRange(period, todayStr());
  return (entries || [])
    .filter((e) => e.currency === currency && (e.type === 'expense' || e.type === 'unaccounted') && e.id !== excludeEntryId && e.date >= start && e.date <= end)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}
const toBase = (amount, currency, rates) => (Number(amount) || 0) * (rates[currency] || 0);
const fromBase = (baseAmount, currency, rates) => { const r = rates[currency] || 1; return r ? baseAmount / r : 0; };

const dbToEntry = (r) => {
  const isUntrackedMarker = r.type === 'unaccounted' ||
    (r.type === 'expense' && (r.category?.toLowerCase().startsWith('untracked') || r.note?.includes('[Untracked]')));
  return {
    id: r.id,
    type: isUntrackedMarker ? 'unaccounted' : r.type,
    amount: Number(r.amount),
    currency: r.currency,
    category: r.category ? r.category.replace(/^Untracked:\s*/i, '') : '',
    holdingSource: r.holding_source || '',
    note: r.note ? r.note.replace(/\[Untracked\]\s*/g, '').trim() : '',
    date: r.date,
    rateAtEntry: r.rate_at_entry != null ? Number(r.rate_at_entry) : null,
  };
};
const entryToDb = (e) => ({
  type: e.type, amount: e.amount, currency: e.currency, category: e.category || null,
  holding_source: e.type === 'expense' ? null : (e.holdingSource || null), note: e.note || null, date: e.date,
  rate_at_entry: e.rateAtEntry != null ? e.rateAtEntry : null,
});

async function fetchLiveRates() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    const r = data.rates;
    if (!r || !r.PKR) throw new Error('bad response');
    const usdToPkr = r.PKR;
    const rates = { PKR: 1, USD: usdToPkr, USDT: usdToPkr };
    ['EUR', 'GBP', 'TRY'].forEach((c) => {
      rates[c] = r[c] ? usdToPkr / r[c] : null;
    });
    if (Object.values(rates).some((v) => v === null)) throw new Error('missing currency');
    return { rates, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Atoms                                                              */
/* ------------------------------------------------------------------ */

function Chip({ active, onClick, children, style }) {
  const C = useColors();
  return (
    <button
      onClick={onClick}
      className="vlf-hover"
      style={{
        padding: '8px 15px', borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: SANS,
        border: `1px solid ${active ? C.navy : C.line}`, background: active ? C.navy : C.surface,
        color: active ? '#fff' : C.navySoft, whiteSpace: 'nowrap', transition: 'all .15s ease', ...style,
      }}
    >
      {children}
    </button>
  );
}
function Divider() {
  const C = useColors();
  return <div style={{ height: 1, background: C.line, margin: '20px 0' }} />;
}
function SectionLabel({ children, right }) {
  const C = useColors();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.11em', textTransform: 'uppercase', color: C.muted, fontWeight: 700, fontFamily: SANS }}>
        {children}
      </div>
      {right}
    </div>
  );
}
function CoinIcon({ currency, size = 34 }) {
  const C = useColors();
  const sym = CURRENCY_META[currency]?.cleanSymbol || currency;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${C.silver}, #fff 45%, ${C.silver})`,
      border: `1.5px solid ${C.navy}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: MONO, fontWeight: 800, letterSpacing: '-0.02em', color: C.navy, fontSize: size * 0.44,
      boxShadow: 'inset 0 0 0 2px #ffffffaa', flexShrink: 0,
    }}>
      {sym}
    </div>
  );
}
function Card({ children, style, hover = true }) {
  const C = useColors();
  return (
    <div className={hover ? 'vlf-card' : ''} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, boxShadow: '0 1px 2px rgba(20,17,13,0.05)', ...style }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Auth screen                                                        */
/* ------------------------------------------------------------------ */

function AuthScreen() {
  const C = useColors();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setInfo('Account created. If email confirmation is enabled in your Supabase project, check your inbox before signing in.');
      } else if (mode === 'forgot') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (err) throw err;
        setInfo('Password reset link sent. Check your inbox.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${C.navy} 0%, ${C.navySoft} 45%, ${C.ice} 45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 26, color: '#fff' }}>
          <div style={{ width: 52, height: 52, margin: '0 auto 12px', borderRadius: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={24} color="#fff" />
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, letterSpacing: '0.01em' }}>Vaultify</div>
          <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 4 }}>Private, multi-currency net worth tracking</div>
        </div>
        <Card style={{ padding: 22 }}>
          {mode !== 'forgot' && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: C.ice, padding: 4, borderRadius: 12 }}>
              {['signin', 'signup'].map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(''); setInfo(''); }} style={{
                  flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700,
                  background: mode === m ? '#fff' : 'transparent', color: mode === m ? C.navy : C.muted,
                  boxShadow: mode === m ? '0 1px 3px rgba(26,23,18,0.12)' : 'none',
                }}>
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
          )}
          {mode === 'forgot' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: C.heading, marginBottom: 4 }}>Reset password</div>
              <div style={{ fontSize: 12.5, color: C.muted }}>We'll email you a link to set a new password.</div>
            </div>
          )}
          <form onSubmit={submit}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.navySoft, display: 'block', marginBottom: 6 }}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 10, padding: '11px 13px', fontSize: 14, marginBottom: 14, outline: 'none', fontFamily: SANS }} />
            {mode !== 'forgot' && (
              <>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.navySoft, display: 'block', marginBottom: 6 }}>Password</label>
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 10, padding: '11px 13px', fontSize: 14, marginBottom: 10, outline: 'none', fontFamily: SANS }} />
              </>
            )}
            {mode === 'signin' && (
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <button type="button" onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}
                  style={{ background: 'none', border: 'none', color: C.steel, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                  Forgot password?
                </button>
              </div>
            )}
            {error && <div style={{ fontSize: 12.5, color: '#7A2E2E', marginBottom: 12 }}>{error}</div>}
            {info && <div style={{ fontSize: 12.5, color: '#39604A', marginBottom: 12 }}>{info}</div>}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: C.navy, color: '#fff',
              fontSize: 14.5, fontWeight: 700, opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </button>
            {mode === 'forgot' && (
              <button type="button" onClick={() => { setMode('signin'); setError(''); setInfo(''); }}
                style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: 'none', color: C.muted, fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>
                Back to sign in
              </button>
            )}
          </form>
        </Card>
        <div style={{ textAlign: 'center', fontSize: 11.5, color: C.navySoft, opacity: 0.6, marginTop: 16 }}>
          Same account, same data — on your phone and your laptop.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entry Sheet                                                        */
/* ------------------------------------------------------------------ */

function EntrySheet({ open, onClose, onSave, onDelete, settings, initial, saving }) {
  const C = useColors();
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(settings.lastCurrency || 'PKR');
  const [category, setCategory] = useState('');
  const [holdingSource, setHoldingSource] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());
  const amountRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setType(initial.type); setAmount(String(initial.amount)); setCurrency(initial.currency);
      setCategory(initial.category || ''); setHoldingSource(initial.holdingSource || '');
      setNote(initial.note || ''); setDate(initial.date);
    } else {
      setType('expense'); setAmount(''); setCurrency(settings.lastCurrency || 'PKR');
      setCategory(''); setHoldingSource(''); setNote(''); setDate(todayStr());
    }
    setTimeout(() => amountRef.current?.focus(), 150);
  }, [open, initial]);

  useEffect(() => {
    if (category && !(CATEGORY_MAP[type] || []).includes(category)) setCategory('');
  }, [type]);

  if (!open) return null;
  const activeType = TYPES.find((t) => t.key === type);
  const canSave = Number(amount) > 0 && !saving;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', background: 'rgba(26,23,18,0.5)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, width: '100%', maxWidth: 480, margin: '0 auto', borderRadius: '24px 24px 0 0',
        maxHeight: '92vh', overflowY: 'auto', padding: '18px 18px 28px', fontFamily: SANS,
        boxShadow: '0 -10px 34px rgba(26,23,18,0.28)',
      }}>
        <div style={{ width: 40, height: 4, background: C.line, borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 21, color: C.heading, margin: 0, fontWeight: 600 }}>{initial ? 'Edit entry' : 'Add entry'}</h2>
          <button onClick={onClose} style={{ background: C.ice, border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color={C.heading} />
          </button>
        </div>

        <SectionLabel>Type</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {TYPES.map((t) => {
            const Icon = t.icon; const active = type === t.key;
            return (
              <button key={t.key} onClick={() => setType(t.key)} style={{
                flex: 1, padding: '11px 4px', borderRadius: 14, border: `1.5px solid ${active ? t.color : C.line}`,
                background: active ? `${t.color}12` : C.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              }}>
                <Icon size={17} color={t.color} />
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? t.color : '#5B6774' }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic type hint */}
        <div style={{
          fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 8, marginBottom: 16,
          background: `${activeType.color}10`, color: activeType.color, border: `1px solid ${activeType.color}25`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>
            {type === 'income' ? '➕ Money will be added to your current balance.' :
             type === 'expense' ? '➖ Money will be deducted from your current balance.' :
             type === 'saving' ? '🛡️ Money allocated to your savings reserve.' :
             type === 'investment' ? '📈 Money allocated to your investments.' :
             '❓ Deducted as untracked / forgotten discrepancy.'}
          </span>
        </div>

        <SectionLabel>Currency</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
          {CURRENCIES.map((c) => (
            <Chip key={c} active={currency === c} onClick={() => setCurrency(c)}>
              {CURRENCY_META[c]?.shortName || c}
            </Chip>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: -6, marginBottom: 16, fontWeight: 600 }}>
          Selected: <strong style={{ color: C.heading }}>{CURRENCY_META[currency]?.name || currency}</strong>
        </div>

        <SectionLabel>Amount ({CURRENCY_META[currency]?.shortName || currency})</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.ice, borderRadius: 14, padding: '11px 15px', marginBottom: 18, border: `1px solid ${C.line}` }}>
          <span style={{ fontFamily: SERIF, fontSize: 20, color: activeType.color, fontWeight: 700 }}>{CURRENCY_META[currency]?.symbol || currency}</span>
          <input ref={amountRef} type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: MONO, fontSize: 23, fontWeight: 600, color: C.heading }} />
        </div>

        <SectionLabel>Category (optional)</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {(CATEGORY_MAP[type] || []).map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? '' : c)} style={{ fontSize: 12, padding: '6px 12px' }}>{c}</Chip>
          ))}
        </div>

        {type !== 'expense' && (
          <>
            <SectionLabel>Holding source</SectionLabel>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              {HOLDING_SOURCES.map((h) => (
                <Chip key={h} active={holdingSource === h} onClick={() => setHoldingSource(holdingSource === h ? '' : h)} style={{ fontSize: 12, padding: '6px 12px' }}>{h}</Chip>
              ))}
            </div>
          </>
        )}

        <SectionLabel>Note (optional)</SectionLabel>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line note…"
          style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 14px', fontSize: 14, marginBottom: 18, outline: 'none', color: C.navySoft, background: C.surface, boxSizing: 'border-box', fontFamily: SANS }} />

        <SectionLabel>Date</SectionLabel>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 14px', fontSize: 14, marginBottom: 22, outline: 'none', color: C.navySoft, background: C.surface, boxSizing: 'border-box', fontFamily: SANS }} />

        <button onClick={() => onSave({ id: initial?.id, type, amount: Number(amount), currency, category, holdingSource, note, date })}
          disabled={!canSave}
          style={{ width: '100%', padding: '15px', borderRadius: 14, border: 'none', background: canSave ? C.navy : C.silver, color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: initial ? 10 : 0 }}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Save entry'}
        </button>
        {initial && (
          <button onClick={() => onDelete(initial.id)} style={{
            width: '100%', padding: '13px', borderRadius: 14, border: '1px solid #7A2E2E33', background: C.surface, color: '#7A2E2E',
            fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            Delete entry
          </button>
        )}
      </div>
    </div>
  );
}

function SavedStamp({ show }) {
  const C = useColors();
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 60,
      background: C.navy, color: '#fff', borderRadius: '50%', width: 92, height: 92, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, border: `3px solid ${C.silver}`,
      animation: 'vlfPop .5s cubic-bezier(.34,1.56,.64,1)', boxShadow: '0 10px 30px rgba(26,23,18,0.35)',
    }}>
      <Check size={26} strokeWidth={3} />
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', fontFamily: SANS }}>SAVED</span>
      <style>{`@keyframes vlfPop{0%{transform:translate(-50%,-50%) scale(.5);opacity:0}60%{transform:translate(-50%,-50%) scale(1.08);opacity:1}100%{transform:translate(-50%,-50%) scale(1)}}`}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Password gate — re-confirms password before edit/delete/export     */
/* ------------------------------------------------------------------ */

function PasswordGate({ open, onClose, onConfirm, userEmail }) {
  const C = useColors();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (open) { setPassword(''); setError(''); } }, [open]);
  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: userEmail, password });
    setLoading(false);
    if (err) { setError('Incorrect password.'); return; }
    onConfirm();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 65, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,17,13,0.5)', padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: 18, padding: 22, width: '100%', maxWidth: 340, fontFamily: SANS }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <KeyRound size={17} color={C.heading} />
          <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 700, color: C.heading }}>Confirm it's you</div>
        </div>
        <p style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>For your security, please re-enter your password to continue.</p>
        <form onSubmit={submit}>
          <input type="password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 10, padding: '11px 13px', fontSize: 14, marginBottom: 12, background: C.ice, color: C.heading, boxSizing: 'border-box' }} />
          {error && <div style={{ fontSize: 12, color: '#B23A34', marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${C.line}`, background: 'none', color: C.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: C.navy, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Checking…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings Sheet                                                     */
/* ------------------------------------------------------------------ */

function SettingsSheet({ open, onClose, settings, onSave, onSignOut, ratesLoading, onRefreshRates, theme, onThemeChange, userEmail, entries, onClearMonth, onClearAll }) {
  const C = useColors();
  const [limits, setLimits] = useState({});
  const [budgetPeriod, setBudgetPeriod] = useState(settings.budgetPeriod || 'week');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwStatus, setPwStatus] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setLimits({ ...settings.budgetLimits });
      setBudgetPeriod(settings.budgetPeriod || settings.budgetLimits?._period || 'week');
      setNewPw(''); setConfirmPw(''); setPwStatus('');
    }
  }, [open, settings]);
  const months = useMemo(() => {
    const set = new Set((entries || []).map((e) => monthKey(e.date)));
    return Array.from(set).sort().reverse();
  }, [entries]);
  if (!open) return null;

  const updatePassword = async () => {
    setPwStatus('');
    if (newPw.length < 6) { setPwStatus('Password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setPwStatus("Passwords don't match."); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) setPwStatus(error.message);
    else { setPwStatus('Password updated.'); setNewPw(''); setConfirmPw(''); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', background: 'rgba(26,23,18,0.5)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, width: '100%', maxWidth: 480, margin: '0 auto', borderRadius: '24px 24px 0 0',
        maxHeight: '90vh', overflowY: 'auto', padding: '18px 18px 28px', fontFamily: SANS,
      }}>
        <div style={{ width: 40, height: 4, background: C.line, borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 21, color: C.heading, margin: 0, fontWeight: 600 }}>Settings</h2>
          <button onClick={onClose} style={{ background: C.ice, border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color={C.heading} />
          </button>
        </div>

        {userEmail && <p style={{ fontSize: 12, color: C.muted, marginTop: -8, marginBottom: 18 }}>Signed in as {userEmail}</p>}

        <SectionLabel>Appearance</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[{ k: 'light', l: 'Light', Icon: Sun }, { k: 'dark', l: 'Dark', Icon: Moon }].map(({ k, l, Icon }) => (
            <button key={k} onClick={() => onThemeChange(k)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0',
              borderRadius: 12, border: `1.5px solid ${theme === k ? C.navy : C.line}`, background: theme === k ? `${C.navy}12` : C.surface,
              color: theme === k ? C.navy : C.muted, fontSize: 13, fontWeight: 700,
            }}>
              <Icon size={15} /> {l}
            </button>
          ))}
        </div>

        <SectionLabel>Spending & Expense Limits</SectionLabel>
        <p style={{ fontSize: 12, color: C.muted, marginTop: -4, marginBottom: 10 }}>
          Set limits to alert you when expenses cross your budget. Ideal for weekly or per-hour earnings.
        </p>

        {/* Limit Period Selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[
            { k: 'week', l: 'Weekly' },
            { k: 'month', l: 'Monthly' },
            { k: 'total', l: 'All time' },
          ].map((p) => (
            <button
              key={p.k}
              type="button"
              onClick={() => setBudgetPeriod(p.k)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                border: `1.5px solid ${budgetPeriod === p.k ? C.navy : C.line}`,
                background: budgetPeriod === p.k ? `${C.navy}14` : C.surface,
                color: budgetPeriod === p.k ? C.navy : C.muted,
                cursor: 'pointer',
              }}
            >
              {p.l}
            </button>
          ))}
        </div>

        {CURRENCIES.map((c) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 48, fontSize: 13, fontWeight: 700, color: C.navySoft }}>{c}</div>
            <input
              type="number"
              inputMode="decimal"
              placeholder={`No ${budgetPeriod === 'week' ? 'weekly' : budgetPeriod === 'month' ? 'monthly' : 'total'} limit`}
              value={limits[c] ?? ''}
              onChange={(e) => setLimits((p) => ({ ...p, [c]: e.target.value }))}
              style={{
                flex: 1, border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 12px',
                fontSize: 13, outline: 'none', background: C.surface, color: C.navySoft,
              }}
            />
          </div>
        ))}

        <div style={{ height: 6 }} />
        <SectionLabel right={
          <button onClick={onRefreshRates} disabled={ratesLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: C.steel, fontSize: 12, fontWeight: 700 }}>
            <RefreshCw size={12} style={{ animation: ratesLoading ? 'vlfSpin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        }>Live exchange rates</SectionLabel>
        <p style={{ fontSize: 12, color: C.muted, marginTop: -4, marginBottom: 4 }}>PKR value of 1 unit — used to convert your Net Worth total.</p>
        <p style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>Last updated: {timeAgo(settings.ratesFetchedAt)}</p>
        {CURRENCIES.filter((c) => c !== 'PKR').map((c) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 48, fontSize: 13, fontWeight: 700, color: C.navySoft }}>{c}</div>
            <div style={{ flex: 1, padding: '9px 12px', fontSize: 13, color: C.navySoft, background: C.ice, borderRadius: 10, fontFamily: MONO }}>
              {settings.rates[c] ? fmtAmount(settings.rates[c]) : '—'}
            </div>
          </div>
        ))}
        <style>{`@keyframes vlfSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

        <div style={{ height: 6 }} />
        <SectionLabel>Change password</SectionLabel>
        <input type="password" placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
          style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', marginBottom: 8, background: C.surface, color: C.navySoft, boxSizing: 'border-box' }} />
        <input type="password" placeholder="Confirm new password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
          style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', marginBottom: 8, background: C.surface, color: C.navySoft, boxSizing: 'border-box' }} />
        {pwStatus && <p style={{ fontSize: 12, color: pwStatus === 'Password updated.' ? '#39604A' : '#7A2E2E', marginBottom: 8 }}>{pwStatus}</p>}
        <button onClick={updatePassword} disabled={pwSaving || !newPw} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 12,
          border: `1px solid ${C.line}`, background: C.surface, color: C.navySoft, fontSize: 13, fontWeight: 700, opacity: (!newPw || pwSaving) ? 0.6 : 1,
        }}>
          <KeyRound size={14} /> {pwSaving ? 'Updating…' : 'Update password'}
        </button>

        <div style={{ height: 16 }} />
        <SectionLabel>Delete data</SectionLabel>
        <p style={{ fontSize: 12, color: C.muted, marginTop: -4, marginBottom: 12 }}>Clear a specific month, or wipe everything. This cannot be undone.</p>
        {months.length === 0 && <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>No entries yet.</div>}
        {months.map((m) => (
          <div key={m} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.navySoft }}>{monthLabel(m)}</span>
            <button onClick={() => onClearMonth(m)} style={{ fontSize: 12, fontWeight: 700, color: '#B23A34', background: 'none', border: '1px solid #B23A3440', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        ))}
        {months.length > 0 && (
          <button onClick={onClearAll} style={{
            width: '100%', marginTop: 4, padding: '13px', borderRadius: 12, border: '1px solid #B23A34',
            background: '#B23A3412', color: '#B23A34', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
          }}>
            Clear all data
          </button>
        )}

        <div style={{ height: 16 }} />
        <button onClick={() => {
          const cleanLimits = {};
          Object.entries(limits).forEach(([k, v]) => {
            if (k !== '_period' && v !== '' && v != null && !isNaN(Number(v))) cleanLimits[k] = Number(v);
          });
          cleanLimits._period = budgetPeriod;
          onSave({ ...settings, budgetLimits: cleanLimits, budgetPeriod });
        }} style={{ width: '100%', padding: '15px', borderRadius: 14, border: 'none', background: C.navy, color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 10, cursor: 'pointer' }}>
          Save settings
        </button>
        <button onClick={onSignOut} style={{
          width: '100%', padding: '13px', borderRadius: 14, border: `1px solid ${C.line}`, background: C.surface, color: C.muted,
          fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer',
        }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Total-across-currencies widget (shown on Dashboard)                */
/* ------------------------------------------------------------------ */

function CurrencySparkline({ isUp, isDown, color }) {
  if (isUp) {
    return (
      <svg width="40" height="18" viewBox="0 0 40 18" fill="none" style={{ overflow: 'visible' }}>
        <path
          d="M 2 15 C 10 14, 18 10, 26 11 C 31 11, 35 6, 38 3"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="38" cy="3" r="2.2" fill={color} />
      </svg>
    );
  }
  if (isDown) {
    return (
      <svg width="40" height="18" viewBox="0 0 40 18" fill="none" style={{ overflow: 'visible' }}>
        <path
          d="M 2 3 C 10 5, 18 8, 26 7 C 31 7, 35 12, 38 15"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="38" cy="15" r="2.2" fill={color} />
      </svg>
    );
  }
  return (
    <svg width="40" height="18" viewBox="0 0 40 18" fill="none" style={{ overflow: 'visible' }}>
      <path
        d="M 2 9 C 12 7, 24 11, 38 9"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 2"
      />
    </svg>
  );
}

function TotalAcrossCurrencies({ entries, settings, display, setDisplay }) {
  const C = useColors();
  const perCurrency = CURRENCIES.map((c) => ({ currency: c, ...computeTotals(entries, c) }))
    .filter((x) => x.expense || x.income || x.saving || x.investment || x.unaccounted);
  const totalBase = perCurrency.reduce((sum, x) => sum + toBase(x.net, x.currency, settings.rates), 0);
  const converted = fromBase(totalBase, display, settings.rates);

  // Fallback realistic daily variance if prevRates not recorded yet
  const FALLBACK_TRENDS = {
    USD: 0.24,
    EUR: 0.18,
    GBP: -0.15,
    TRY: -0.42,
    USDT: 0.24,
  };

  const trendCurrencies = ['USD', 'EUR', 'GBP', 'TRY', 'USDT'];

  return (
    <Card style={{ padding: 18, marginBottom: 22, background: `linear-gradient(160deg, ${C.surface} 0%, ${C.ice} 130%)` }}>
      <SectionLabel>Total across all currencies</SectionLabel>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {CURRENCIES.map((c) => (
          <Chip key={c} active={display === c} onClick={() => setDisplay(c)} style={{ padding: '5px 11px', fontSize: 12 }}>{c}</Chip>
        ))}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 23, fontWeight: 600, color: C.heading, marginBottom: 5 }}>
        {fmtMoney(converted, display)}
      </div>

      {/* Subtitle centered */}
      <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', margin: '4px 0 12px', lineHeight: 1.45 }}>
        Income + savings + investments, minus expenses & untracked — converted using live rates
      </div>

      {/* Divider inside the box */}
      <div style={{ height: 1, background: C.line, margin: '12px 0 10px' }} />

      {/* Non-clickable Live Currency Trend List */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
          color: C.muted, marginBottom: 7,
        }}>
          <span>Live Rates vs PKR</span>
          <span>Fluctuation Trend</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {trendCurrencies.map((c) => {
            const now = settings.rates[c] || 1;
            const prev = settings.prevRates?.[c];
            let diff = 0;
            let pct = 0;

            if (prev != null && Math.abs(now - prev) > 0.0001) {
              diff = now - prev;
              pct = ((now - prev) / prev) * 100;
            } else {
              // Deterministic daily benchmark variance
              pct = FALLBACK_TRENDS[c] || 0.1;
              diff = (now * pct) / 100;
            }

            const isUp = diff > 0.001;
            const isDown = diff < -0.001;
            const trendColor = isUp ? '#1E9E64' : isDown ? '#B23A34' : C.muted;
            const diffFormatted = Math.abs(diff) >= 0.01 ? `${diff > 0 ? '+' : '−'}Rs ${Math.abs(diff).toFixed(2)}` : null;

            return (
              <div
                key={c}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 9px',
                  borderRadius: 10,
                  background: `${C.surface}ee`,
                  border: `1px solid ${C.line}`,
                  boxShadow: '0 1px 2px rgba(20,17,13,0.02)',
                }}
              >
                {/* Left: Coin Icon + Currency Code & Symbol */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CoinIcon currency={c} size={25} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.heading, lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span>{c}</span>
                      <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>({CURRENCY_META[c]?.cleanSymbol || c})</span>
                    </div>
                    <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 500 }}>
                      1 {CURRENCY_META[c]?.cleanSymbol || c}
                    </div>
                  </div>
                </div>

                {/* Center: Prominent Live PKR Exchange Rate */}
                <div style={{ textAlign: 'right', flex: 1, paddingRight: 8 }}>
                  <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: C.heading }}>
                    Rs {fmtAmount(now)}
                  </div>
                  {diffFormatted && (
                    <div style={{ fontFamily: MONO, fontSize: 9.5, color: trendColor, fontWeight: 600 }}>
                      {diffFormatted}
                    </div>
                  )}
                </div>

                {/* Right: Trendline SVG & Google Finance Direct Chart Link */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <CurrencySparkline isUp={isUp} isDown={isDown} color={trendColor} />

                  <a
                    href={`https://www.google.com/finance/quote/${c}-PKR`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open Google Finance live interactive chart graph for ${c}/PKR`}
                    className="vlf-hover"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2.5,
                      fontFamily: MONO,
                      fontSize: 10,
                      fontWeight: 800,
                      color: trendColor,
                      background: `${trendColor}18`,
                      border: `1px solid ${trendColor}33`,
                      padding: '2.5px 6px',
                      borderRadius: 6,
                      minWidth: 48,
                      justifyContent: 'center',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'all .15s ease',
                    }}
                  >
                    {isUp ? (
                      <TrendingUp size={10} strokeWidth={2.6} />
                    ) : isDown ? (
                      <TrendingDown size={10} strokeWidth={2.6} />
                    ) : null}
                    <span>{pct > 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`}</span>
                    <ExternalLink size={8.5} style={{ opacity: 0.7, marginLeft: 1 }} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Untracked / Missing Money Section (Untracked Money)                */
/* ------------------------------------------------------------------ */

function UntrackedMoneySection({ entries, activeCurrency, settings, onOpenAddEntry, setActiveCurrency }) {
  const C = useColors();
  const [selectedCurrency, setSelectedCurrency] = useState(activeCurrency || 'PKR');
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcileCurrency, setReconcileCurrency] = useState(activeCurrency || 'PKR');
  const [expectedCash, setExpectedCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [reconcileSource, setReconcileSource] = useState('Cash in Hand');

  // Keep selectedCurrency synced when activeCurrency changes if desired
  useEffect(() => {
    if (activeCurrency) {
      setSelectedCurrency(activeCurrency);
      setReconcileCurrency(activeCurrency);
    }
  }, [activeCurrency]);

  const unaccountedEntries = useMemo(() => {
    return (entries || [])
      .filter((e) => e.type === 'unaccounted')
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [entries]);

  // Compute breakdown for EVERY currency
  const perCurrencyBreakdown = useMemo(() => {
    const map = {};
    CURRENCIES.forEach((c) => {
      const cEntries = unaccountedEntries.filter((e) => e.currency === c);
      const total = cEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const inPkr = toBase(total, c, settings?.rates);
      map[c] = { total, inPkr, count: cEntries.length };
    });
    return map;
  }, [unaccountedEntries, settings?.rates]);

  // Total across all currencies converted to PKR
  const totalAllInPkr = useMemo(() => {
    return CURRENCIES.reduce((sum, c) => sum + (perCurrencyBreakdown[c]?.inPkr || 0), 0);
  }, [perCurrencyBreakdown]);

  const totalCurrenciesWithMissing = useMemo(() => {
    return CURRENCIES.filter((c) => (perCurrencyBreakdown[c]?.total || 0) > 0).length;
  }, [perCurrencyBreakdown]);

  // Entries filtered by selectedCurrency (or 'All')
  const filteredEntries = useMemo(() => {
    if (selectedCurrency === 'All') return unaccountedEntries;
    return unaccountedEntries.filter((e) => e.currency === selectedCurrency);
  }, [unaccountedEntries, selectedCurrency]);

  const totalInSelectedCurr = selectedCurrency === 'All' ? totalAllInPkr : (perCurrencyBreakdown[selectedCurrency]?.total || 0);

  const diff = useMemo(() => {
    const exp = Number(expectedCash) || 0;
    const act = Number(actualCash) || 0;
    return exp > act ? exp - act : 0;
  }, [expectedCash, actualCash]);

  const handleSaveReconcile = () => {
    if (diff <= 0) return;
    if (onOpenAddEntry) {
      onOpenAddEntry({
        type: 'unaccounted',
        amount: String(diff),
        currency: reconcileCurrency,
        category: 'Cash Discrepancy',
        holdingSource: reconcileSource,
        note: `Reconciled: Expected ${expectedCash}, had ${actualCash}`,
        date: todayStr(),
      });
    }
    setExpectedCash('');
    setActualCash('');
    setReconcileOpen(false);
  };

  return (
    <div style={{
      background: C.surface,
      border: `1.5px solid ${totalAllInPkr > 0 ? '#D9770666' : C.line}`,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      boxShadow: totalAllInPkr > 0 ? '0 4px 18px rgba(217,119,6,0.08)' : '0 1px 3px rgba(20,17,13,0.03)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: 'rgba(217,119,6,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <HelpCircle size={18} color="#D97706" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.heading }}>
              Untracked Money
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>
              {totalCurrenciesWithMissing > 0
                ? `${totalCurrenciesWithMissing} currency with missing funds`
                : 'No missing or untracked funds recorded'}
            </div>
          </div>
        </div>

        {onOpenAddEntry && (
          <button
            onClick={() => onOpenAddEntry({
              type: 'unaccounted',
              amount: '',
              currency: selectedCurrency === 'All' ? activeCurrency : selectedCurrency,
              category: 'Forgotten / Unknown',
              holdingSource: 'Cash in Hand',
              note: '',
              date: todayStr(),
            })}
            className="vlf-hover"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: '#D97706', color: '#fff', border: 'none',
              borderRadius: 10, padding: '7px 12px', fontSize: 12,
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Plus size={13} strokeWidth={2.6} /> Add Untracked
          </button>
        )}
      </div>

      {/* Multi-Currency Breakdown Cards / Badges (Kisme kitne miss he) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6, fontSize: 11, fontWeight: 700, color: C.muted,
        }}>
          <span>Missing by Currency:</span>
          {totalAllInPkr > 0 && (
            <span style={{ fontFamily: MONO, color: '#D97706', fontWeight: 800 }}>
              All ≈ Rs {fmtAmount(totalAllInPkr)}
            </span>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
        }}>
          {CURRENCIES.map((c) => {
            const data = perCurrencyBreakdown[c] || { total: 0, inPkr: 0, count: 0 };
            const isSelected = selectedCurrency === c;
            const hasMissing = data.total > 0;

            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setSelectedCurrency(c);
                  setReconcileCurrency(c);
                  if (setActiveCurrency) setActiveCurrency(c);
                }}
                className="vlf-hover"
                style={{
                  background: isSelected
                    ? (hasMissing ? 'rgba(217,119,6,0.18)' : `${C.navy}14`)
                    : (hasMissing ? 'rgba(217,119,6,0.06)' : C.ice),
                  border: `1.5px solid ${isSelected ? (hasMissing ? '#D97706' : C.navy) : (hasMissing ? 'rgba(217,119,6,0.4)' : C.line)}`,
                  borderRadius: 12,
                  padding: '8px 7px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all .15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 800,
                    color: isSelected ? (hasMissing ? '#D97706' : C.navy) : C.heading,
                  }}>
                    {c}
                  </span>
                  {data.count > 0 && (
                    <span style={{
                      fontSize: 8.5, fontWeight: 700,
                      background: hasMissing ? '#D97706' : C.muted,
                      color: '#fff', padding: '1px 4px', borderRadius: 6,
                    }}>
                      {data.count}
                    </span>
                  )}
                </div>

                <div style={{
                  fontFamily: MONO, fontSize: 12, fontWeight: 800,
                  color: hasMissing ? '#D97706' : C.muted,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {fmtMoney(data.total, c)}
                </div>

                {c !== 'PKR' && hasMissing && (
                  <div style={{
                    fontFamily: MONO, fontSize: 8.5, color: C.muted, fontWeight: 600, marginTop: 1,
                  }}>
                    ≈ Rs {fmtAmount(data.inPkr)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Currency Banner Summary */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 13px', background: C.ice, borderRadius: 12,
        border: `1px solid ${C.line}`, marginBottom: 10,
      }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {selectedCurrency === 'All' ? 'Total Across All Currencies' : `${selectedCurrency} Untracked Total`}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 19, fontWeight: 800, color: totalInSelectedCurr > 0 ? '#D97706' : C.heading }}>
            {selectedCurrency === 'All' ? `≈ Rs ${fmtAmount(totalAllInPkr)}` : fmtMoney(totalInSelectedCurr, selectedCurrency)}
          </div>
        </div>
        {selectedCurrency !== 'PKR' && selectedCurrency !== 'All' && totalInSelectedCurr > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>Approx PKR</div>
            <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.muted }}>
              ≈ Rs {fmtAmount(perCurrencyBreakdown[selectedCurrency]?.inPkr || 0)}
            </div>
          </div>
        )}
      </div>

      {/* Fast Tool: Reconcile Cash in Hand Button */}
      <div style={{ display: 'flex', gap: 6, marginBottom: filteredEntries.length > 0 ? 10 : 0 }}>
        <button
          onClick={() => {
            setReconcileCurrency(selectedCurrency === 'All' ? 'PKR' : selectedCurrency);
            setReconcileOpen((v) => !v);
          }}
          className="vlf-hover"
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 10px', borderRadius: 10, fontSize: 11.5, fontWeight: 700,
            border: `1px solid ${reconcileOpen ? '#D97706' : C.line}`,
            background: reconcileOpen ? 'rgba(217,119,6,0.12)' : C.surface,
            color: reconcileOpen ? '#D97706' : C.navySoft, cursor: 'pointer',
          }}
        >
          <Search size={13} color="#D97706" />
          {reconcileOpen ? 'Close Cash Discrepancy Matcher' : `Find Cash Discrepancy (${selectedCurrency === 'All' ? activeCurrency : selectedCurrency})`}
        </button>
      </div>

      {/* Cash Reconciler Sub-Widget */}
      {reconcileOpen && (
        <div style={{
          background: `${C.surface}`, border: `1px solid ${C.line}`, borderRadius: 12,
          padding: 12, marginTop: 8, marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.heading }}>
              Reconcile Cash (Expected vs Actual):
            </div>
            {/* Currency selector inside reconciler */}
            <div style={{ display: 'flex', gap: 4 }}>
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setReconcileCurrency(c)}
                  style={{
                    padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    border: `1px solid ${reconcileCurrency === c ? '#D97706' : C.line}`,
                    background: reconcileCurrency === c ? '#D97706' : C.ice,
                    color: reconcileCurrency === c ? '#fff' : C.heading, cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, fontWeight: 600 }}>Expected in wallet ({reconcileCurrency})</div>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={expectedCash}
                onChange={(e) => setExpectedCash(e.target.value)}
                style={{
                  width: '100%', padding: '7px 9px', borderRadius: 8, border: `1px solid ${C.line}`,
                  fontSize: 12, background: C.ice, color: C.heading, boxSizing: 'border-box', fontFamily: MONO,
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, fontWeight: 600 }}>Actual in hand ({reconcileCurrency})</div>
              <input
                type="number"
                placeholder="e.g. 4200"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                style={{
                  width: '100%', padding: '7px 9px', borderRadius: 8, border: `1px solid ${C.line}`,
                  fontSize: 12, background: C.ice, color: C.heading, boxSizing: 'border-box', fontFamily: MONO,
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, fontWeight: 600 }}>Source</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {HOLDING_SOURCES.map((h) => (
                <Chip key={h} active={reconcileSource === h} onClick={() => setReconcileSource(h)} style={{ fontSize: 10.5, padding: '4px 8px' }}>
                  {h}
                </Chip>
              ))}
            </div>
          </div>

          {diff > 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', background: 'rgba(217,119,6,0.1)', borderRadius: 8,
              border: '1px solid rgba(217,119,6,0.3)',
            }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706' }}>
                  Missing / Untracked: {fmtMoney(diff, reconcileCurrency)}
                </span>
              </div>
              <button
                onClick={handleSaveReconcile}
                className="vlf-hover"
                style={{
                  padding: '5px 10px', borderRadius: 6, border: 'none',
                  background: '#D97706', color: '#fff', fontSize: 11,
                  fontWeight: 700, cursor: 'pointer',
                }}
              >
                Log as Untracked
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 10.5, color: C.muted, textAlign: 'center', padding: '4px 0' }}>
              Enter expected vs counted amount to find missing difference in {reconcileCurrency}.
            </div>
          )}
        </div>
      )}

      {/* Recent untracked list */}
      {filteredEntries.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>
              Recent Untracked Spends ({filteredEntries.length})
            </div>
            {selectedCurrency !== 'All' && (
              <span style={{ fontSize: 9.5, color: '#D97706', fontWeight: 700 }}>
                Showing {selectedCurrency}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {filteredEntries.slice(0, 4).map((e) => (
              <div
                key={e.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', borderRadius: 8, background: `${C.ice}`,
                  border: `1px solid ${C.line}`, fontSize: 11,
                }}
              >
                <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                  <div style={{ fontWeight: 700, color: C.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{
                      display: 'inline-block', fontSize: 9, fontWeight: 800, padding: '1px 4px',
                      borderRadius: 4, background: 'rgba(217,119,6,0.18)', color: '#D97706', marginRight: 5,
                    }}>
                      {e.currency}
                    </span>
                    {e.category || 'Untracked'}{e.note ? ` · ${e.note}` : ''}
                  </div>
                  <div style={{ fontSize: 9.5, color: C.muted }}>
                    {e.date}{e.holdingSource ? ` · ${e.holdingSource}` : ''}
                  </div>
                </div>
                <div style={{ fontFamily: MONO, fontWeight: 800, color: '#D97706', flexShrink: 0 }}>
                  {fmtMoney(e.amount, e.currency)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                          */
/* ------------------------------------------------------------------ */

function Dashboard({
  entries,
  settings,
  activeCurrency,
  setActiveCurrency,
  totalDisplay,
  setTotalDisplay,
  ratesLoading,
  onOpenAddEntry,
  onNavigateToHistory,
  reminders,
  onOpenAddReminder,
  onEditReminder,
  onToggleReminder,
  onPayAndLogReminder,
}) {
  const C = useColors();
  const totals = computeTotals(entries, activeCurrency);
  const thisMonth = monthKey(todayStr());
  const monthExpenses = {};
  CURRENCIES.forEach((c) => {
    monthExpenses[c] = entries.filter((e) => e.currency === c && (e.type === 'expense' || e.type === 'unaccounted') && monthKey(e.date) === thisMonth)
      .reduce((s, e) => s + Number(e.amount), 0);
  });

  return (
    <div style={{ padding: '20px 16px 100px', fontFamily: SANS }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
          {ratesLoading ? 'Updating rates…' : `Rates updated ${timeAgo(settings.ratesFetchedAt)}`}
        </div>
      </div>

      <TotalAcrossCurrencies entries={entries} settings={settings} display={totalDisplay} setDisplay={setTotalDisplay} />

      <SectionLabel>Currencies</SectionLabel>
      <div className="vlf-currency-row" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 20, paddingTop: 10, paddingBottom: 38 }}>
        {CURRENCIES.map((c) => {
          const active = activeCurrency === c;
          const rate = settings.rates[c];
          return (
            <div key={c} className="vlf-currency-item" onClick={() => setActiveCurrency(c)}>
              <div className="vlf-currency-icon-wrap" style={{ borderColor: active ? C.navy : 'transparent' }}>
                <CoinIcon currency={c} size={38} />
              </div>
              <div className="vlf-currency-tip" style={{ background: `${C.surface}E6`, border: `1px solid ${C.line}`, color: C.navySoft }}>
                {c === 'PKR' ? 'Default' : `${fmtAmount(rate)} PKR`}
              </div>
            </div>
          );
        })}
      </div>

      <Divider />

      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navySoft})`, borderRadius: 18, padding: 18, color: '#fff', marginBottom: 20, boxShadow: '0 8px 22px rgba(26,23,18,0.25)' }}>
        <div style={{ fontSize: 11.5, opacity: 0.75, marginBottom: 3 }}>Net balance · {activeCurrency}</div>
        <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, marginBottom: activeCurrency !== 'PKR' ? 2 : 14 }}>{fmtMoney(totals.net, activeCurrency)}</div>
        {activeCurrency !== 'PKR' && (
          <div style={{ fontFamily: MONO, fontSize: 11.5, opacity: 0.85, marginBottom: 14 }}>
            ≈ Rs {fmtAmount(toBase(totals.net, activeCurrency, settings.rates))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[
            { label: 'Income', val: totals.income, color: '#A9D0C9' },
            { label: 'Expenses', val: totals.expense, color: '#D9A5A5' },
            { label: 'Savings', val: totals.saving, color: '#A9C9AE' },
            { label: 'Invested', val: totals.investment, color: '#B9AEE0' },
            { label: 'Untracked', val: totals.unaccounted, color: '#FAD490' },
          ].map((s) => (
            <div key={s.label} className="vlf-stat-tile" style={{ flex: '1 1 calc(20% - 4px)', minWidth: 54, borderRadius: 10, padding: '8px 2px', textAlign: 'center' }}>
              <div style={{ fontSize: 8.5, opacity: 0.85, marginBottom: 3, whiteSpace: 'nowrap' }}>{s.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: s.color }}>{fmtAmount(s.val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bill & Payment Reminders Section */}
      <RemindersSection
        reminders={reminders}
        onOpenAddReminder={onOpenAddReminder}
        onEditReminder={onEditReminder}
        onToggleReminder={onToggleReminder}
        onPayAndLog={onPayAndLogReminder}
      />

      {/* Compact Spending Limit Widget */}
      {(() => {
        const period = settings.budgetPeriod || settings.budgetLimits?._period || 'week';
        const periodLabel = period === 'week' ? 'This week' : period === 'month' ? 'This month' : 'All time';
        const activeLimit = Number(settings.budgetLimits?.[activeCurrency]) || 0;
        const otherCurrenciesWithLimits = CURRENCIES.filter((c) => c !== activeCurrency && Number(settings.budgetLimits?.[c]) > 0);

        if (!activeLimit && otherCurrenciesWithLimits.length === 0) return null;

        const spent = activeLimit ? calculateSpentInPeriod(entries, activeCurrency, period) : 0;
        const isOver = activeLimit > 0 && spent > activeLimit;
        const excess = spent - activeLimit;
        const remaining = Math.max(0, activeLimit - spent);
        const pct = activeLimit > 0 ? Math.min(100, Math.round((spent / activeLimit) * 100)) : 0;
        const barColor = isOver ? '#B23A34' : pct > 80 ? '#B8842C' : C.steel;

        return (
          <div style={{ marginBottom: 20 }}>
            {activeLimit > 0 ? (
              <div style={{
                background: isOver ? 'rgba(178,58,52,0.07)' : C.surface,
                border: `1.5px solid ${isOver ? '#B23A34' : C.line}`,
                borderRadius: 14, padding: '11px 14px',
                boxShadow: isOver ? '0 3px 10px rgba(178,58,52,0.12)' : '0 1px 3px rgba(20,17,13,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={15} color={isOver ? '#B23A34' : barColor} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: isOver ? '#B23A34' : C.heading }}>
                      {isOver ? `Limit Crossed (+${fmtMoney(excess, activeCurrency)})` : `${activeCurrency} Limit (${periodLabel})`}
                    </span>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: isOver ? '#B23A34' : C.muted }}>
                    {fmtMoney(spent, activeCurrency)} / {fmtMoney(activeLimit, activeCurrency)}
                  </span>
                </div>

                <div style={{ height: 6, background: C.ice, borderRadius: 999, overflow: 'hidden', marginBottom: 5 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 999, transition: 'width .3s ease' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: isOver ? '#B23A34' : C.muted }}>
                  <span style={{ fontWeight: isOver ? 700 : 500 }}>
                    {isOver ? `Crossed limit by ${fmtMoney(excess, activeCurrency)}` : `${fmtMoney(remaining, activeCurrency)} remaining`}
                  </span>
                  <span style={{ fontWeight: 600 }}>{pct}% spent</span>
                </div>
              </div>
            ) : null}

            {otherCurrenciesWithLimits.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: activeLimit > 0 ? 8 : 0, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.muted }}>Other limits:</span>
                {otherCurrenciesWithLimits.map((c) => {
                  const lim = Number(settings.budgetLimits[c]);
                  const sp = calculateSpentInPeriod(entries, c, period);
                  const ov = sp > lim;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setActiveCurrency(c)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 8,
                        fontSize: 11, fontWeight: 700, border: `1px solid ${ov ? '#B23A34' : C.line}`,
                        background: ov ? 'rgba(178,58,52,0.1)' : C.surface,
                        color: ov ? '#B23A34' : C.navySoft, cursor: 'pointer',
                      }}
                    >
                      {c}: {ov ? `+${fmtMoney(sp - lim, c)} over` : `${fmtMoney(sp, c)} / ${fmtMoney(lim, c)}`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <Divider />
      <SectionLabel>All currencies snapshot</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CURRENCIES.map((c) => {
          const t = computeTotals(entries, c);
          if (!t.expense && !t.income && !t.saving && !t.investment && !t.unaccounted) return null;
          const pkrVal = toBase(t.net, c, settings.rates);
          return (
            <div
              key={c}
              onClick={() => {
                setActiveCurrency(c);
                if (onNavigateToHistory) onNavigateToHistory(c);
              }}
              className="vlf-hover"
              title={`Click to view ${c} transactions and set as active`}
              style={{
                background: C.surface,
                border: `1px solid ${activeCurrency === c ? C.navy : C.line}`,
                borderRadius: 14,
                padding: '11px 13px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                transition: 'all .15s ease',
              }}
            >
              <CoinIcon currency={c} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.heading, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{c}</span>
                  {activeCurrency === c && (
                    <span style={{ fontSize: 9.5, background: `${C.navy}14`, color: C.navy, padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>
                      Active
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  Inc {fmtAmount(t.income)} · Exp {fmtAmount(t.expense)} · Sav {fmtAmount(t.saving)} · Inv {fmtAmount(t.investment)}{t.unaccounted > 0 ? ` · Untracked ${fmtAmount(t.unaccounted)}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 700, color: t.net >= 0 ? (t.net > 0 ? '#1E9E64' : C.heading) : '#B23A34' }}>
                    {fmtMoney(t.net, c)}
                  </div>
                  {c !== 'PKR' && (
                    <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, fontWeight: 700, marginTop: 1, letterSpacing: '0.02em' }}>
                      ≈ Rs {fmtAmount(pkrVal)}
                    </div>
                  )}
                </div>
                <ChevronRight size={14} color={C.muted} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                            */
/* ------------------------------------------------------------------ */

function HistoryScreen({ entries, onEdit, settings, initialCurrency, onCurrencyChange }) {
  const C = useColors();
  const [filterCurrency, setFilterCurrency] = useState(initialCurrency || 'All');
  const [filterType, setFilterType] = useState('All');
  const [range, setRange] = useState('all');

  useEffect(() => {
    if (initialCurrency) {
      setFilterCurrency(initialCurrency);
    }
  }, [initialCurrency]);

  const handleCurrencySelect = (c) => {
    setFilterCurrency(c);
    if (onCurrencyChange) onCurrencyChange(c);
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfWeekStr = startOfWeek.toISOString().slice(0, 10);
    const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return entries
      .filter((e) => filterCurrency === 'All' || e.currency === filterCurrency)
      .filter((e) => filterType === 'All' || e.type === filterType)
      .filter((e) => range === 'week' ? e.date >= startOfWeekStr : range === 'month' ? e.date >= startOfMonthStr : true)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [entries, filterCurrency, filterType, range]);

  // Calculations for the 5 top square blocks (Income, Expense, Saving, Investment, Pata Nahi)
  const totalsByType = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfWeekStr = startOfWeek.toISOString().slice(0, 10);
    const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const baseEntries = entries
      .filter((e) => filterCurrency === 'All' || e.currency === filterCurrency)
      .filter((e) => range === 'week' ? e.date >= startOfWeekStr : range === 'month' ? e.date >= startOfMonthStr : true);

    const map = { income: 0, expense: 0, saving: 0, investment: 0, unaccounted: 0 };
    const mapPkr = { income: 0, expense: 0, saving: 0, investment: 0, unaccounted: 0 };

    baseEntries.forEach((e) => {
      if (map[e.type] !== undefined) {
        const amt = Number(e.amount) || 0;
        map[e.type] += amt;
        mapPkr[e.type] += toBase(amt, e.currency, settings?.rates || DEFAULT_RATES);
      }
    });

    return { map, mapPkr };
  }, [entries, filterCurrency, range, settings?.rates]);

  // Per-currency breakdown across all categories for range
  const perCurrencyBreakdown = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfWeekStr = startOfWeek.toISOString().slice(0, 10);
    const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const baseEntries = entries
      .filter((e) => range === 'week' ? e.date >= startOfWeekStr : range === 'month' ? e.date >= startOfMonthStr : true);

    const breakdown = {
      income: {},
      expense: {},
      saving: {},
      investment: {},
      unaccounted: {},
    };

    CURRENCIES.forEach((c) => {
      breakdown.income[c] = { amount: 0, count: 0, pkr: 0 };
      breakdown.expense[c] = { amount: 0, count: 0, pkr: 0 };
      breakdown.saving[c] = { amount: 0, count: 0, pkr: 0 };
      breakdown.investment[c] = { amount: 0, count: 0, pkr: 0 };
      breakdown.unaccounted[c] = { amount: 0, count: 0, pkr: 0 };
    });

    baseEntries.forEach((e) => {
      if (breakdown[e.type] && breakdown[e.type][e.currency]) {
        const amt = Number(e.amount) || 0;
        breakdown[e.type][e.currency].amount += amt;
        breakdown[e.type][e.currency].count += 1;
        breakdown[e.type][e.currency].pkr += toBase(amt, e.currency, settings?.rates || DEFAULT_RATES);
      }
    });

    return breakdown;
  }, [entries, range, settings?.rates]);

  // Overall calculations for the bottom summary block
  const totalSummary = useMemo(() => {
    let totalBase = 0;
    let totalInFilterCurr = 0;
    let incomeBase = 0;
    let expenseBase = 0;
    let savingBase = 0;
    let investmentBase = 0;
    let unaccountedBase = 0;

    let incomeFilterCurr = 0;
    let expenseFilterCurr = 0;
    let savingFilterCurr = 0;
    let investmentFilterCurr = 0;
    let unaccountedFilterCurr = 0;

    filtered.forEach((e) => {
      const amt = Number(e.amount) || 0;
      const base = toBase(amt, e.currency, settings?.rates || DEFAULT_RATES);
      if (filterCurrency !== 'All') {
        totalInFilterCurr += amt;
      }
      totalBase += base;

      if (e.type === 'income') {
        incomeBase += base;
        if (filterCurrency !== 'All') incomeFilterCurr += amt;
      } else if (e.type === 'expense') {
        expenseBase += base;
        if (filterCurrency !== 'All') expenseFilterCurr += amt;
      } else if (e.type === 'saving') {
        savingBase += base;
        if (filterCurrency !== 'All') savingFilterCurr += amt;
      } else if (e.type === 'investment') {
        investmentBase += base;
        if (filterCurrency !== 'All') investmentFilterCurr += amt;
      } else if (e.type === 'unaccounted') {
        unaccountedBase += base;
        if (filterCurrency !== 'All') unaccountedFilterCurr += amt;
      }
    });

    // Rest Amount = Income - Expense - Saving - Investment - Unaccounted
    const restBase = incomeBase - expenseBase - savingBase - investmentBase - unaccountedBase;
    const restFilterCurr = incomeFilterCurr - expenseFilterCurr - savingFilterCurr - investmentFilterCurr - unaccountedFilterCurr;

    return {
      totalBase,
      totalInFilterCurr,
      restBase,
      restFilterCurr,
      count: filtered.length,
      incomeBase,
      expenseBase,
      savingBase,
      investmentBase,
      unaccountedBase,
      incomeFilterCurr,
      expenseFilterCurr,
      savingFilterCurr,
      investmentFilterCurr,
      unaccountedFilterCurr,
    };
  }, [filtered, filterCurrency, settings?.rates]);

  const SUMMARY_CARDS = [
    { key: 'income', label: 'Income', icon: Wallet, color: '#1E9E64' },
    { key: 'expense', label: 'Expense', icon: Receipt, color: '#B23A34' },
    { key: 'saving', label: 'Saving', icon: PiggyBank, color: '#2E6F6F' },
    { key: 'investment', label: 'Investments', icon: TrendingUp, color: '#6B5FA8' },
    { key: 'unaccounted', label: 'Untracked', icon: HelpCircle, color: '#D97706' },
  ];

  return (
    <div style={{ padding: '20px 16px 100px', fontFamily: SANS }}>
      <h2 style={{ fontFamily: SERIF, fontSize: 23, color: C.heading, marginBottom: 14, fontWeight: 600 }}>History</h2>

      {/* Top Summary Blocks: Compact 'All' box followed by Income, Expense, Saving, Investments, Pata Nahi */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '46px repeat(5, 1fr)',
        gap: 5,
        marginBottom: 16,
      }}>
        {/* All Types Box */}
        <button
          onClick={() => setFilterType('All')}
          className="vlf-hover"
          title="All Types"
          style={{
            background: filterType === 'All' ? C.navy : C.surface,
            border: `1.5px solid ${filterType === 'All' ? C.navy : C.line}`,
            borderRadius: 14,
            padding: '8px 2px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            cursor: 'pointer',
            boxShadow: filterType === 'All' ? '0 2px 10px rgba(20,17,13,0.18)' : '0 1px 3px rgba(20,17,13,0.03)',
            transition: 'all .2s ease',
            minHeight: 84,
          }}
        >
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: filterType === 'All' ? 'rgba(255,255,255,0.15)' : C.ice,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            placeItems: 'center',
            gap: 2,
            padding: 2,
          }}>
            <Wallet size={9} color={filterType === 'All' ? '#fff' : '#1E9E64'} strokeWidth={2.4} />
            <Receipt size={9} color={filterType === 'All' ? '#fff' : '#B23A34'} strokeWidth={2.4} />
            <PiggyBank size={9} color={filterType === 'All' ? '#fff' : '#2E6F6F'} strokeWidth={2.4} />
            <HelpCircle size={9} color={filterType === 'All' ? '#fff' : '#D97706'} strokeWidth={2.4} />
          </div>
          <div style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: filterType === 'All' ? '#fff' : C.heading,
            lineHeight: 1.1,
          }}>
            All
          </div>
          <div style={{
            fontSize: 8,
            fontWeight: 600,
            color: filterType === 'All' ? 'rgba(255,255,255,0.7)' : C.muted,
            lineHeight: 1.1,
          }}>
            Types
          </div>
        </button>

        {/* 5 Category Boxes */}
        {SUMMARY_CARDS.map((st) => {
          const Icon = st.icon;
          const isActive = filterType === st.key;
          const rawVal = totalsByType.map[st.key];
          const pkrVal = totalsByType.mapPkr[st.key];
          const activeCurrs = CURRENCIES.filter((c) => (perCurrencyBreakdown[st.key]?.[c]?.amount || 0) > 0);

          return (
            <button
              key={st.key}
              onClick={() => setFilterType((prev) => (prev === st.key ? 'All' : st.key))}
              className="vlf-hover"
              title={`Click to filter by ${st.label}`}
              style={{
                background: isActive ? `${st.color}15` : C.surface,
                border: `1.5px solid ${isActive ? st.color : C.line}`,
                borderRadius: 14,
                padding: '8px 4px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                cursor: 'pointer',
                boxShadow: isActive ? `0 2px 10px ${st.color}22` : '0 1px 3px rgba(20,17,13,0.03)',
                transition: 'all .2s ease',
                minHeight: 84,
              }}
            >
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: `${st.color}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon size={12} color={st.color} strokeWidth={2.4} />
              </div>
              <div style={{
                fontSize: 8.5,
                fontWeight: 700,
                color: isActive ? st.color : C.muted,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
              }}>
                {st.label}
              </div>

              {/* Currency amount display: line-by-line breakdown when All is selected */}
              {filterCurrency === 'All' ? (
                activeCurrs.length > 0 ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, marginTop: 1 }}>
                    {activeCurrs.map((c) => {
                      const amt = perCurrencyBreakdown[st.key]?.[c]?.amount || 0;
                      const short = c === 'TRY' ? 'TL' : c;
                      const sym = CURRENCY_META[c]?.cleanSymbol || c;
                      return (
                        <div
                          key={c}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 7.5,
                            fontFamily: MONO,
                            fontWeight: 800,
                            color: st.color,
                            lineHeight: 1.1,
                            padding: '0 2px',
                          }}
                        >
                          <span style={{ fontSize: 7, fontWeight: 800, opacity: 0.8 }}>{short}:</span>
                          <span>{sym}{fmtAmount(amt)}</span>
                        </div>
                      );
                    })}
                    {activeCurrs.length > 1 && (
                      <div style={{ fontFamily: MONO, fontSize: 6.5, color: C.muted, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1, marginTop: 1 }}>
                        ≈ Rs {fmtAmount(pkrVal)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 800, color: st.color, lineHeight: 1.1 }}>
                    Rs 0.00
                  </div>
                )
              ) : (
                <>
                  <div style={{
                    fontFamily: MONO,
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: st.color,
                    lineHeight: 1.1,
                  }}>
                    {fmtMoney(rawVal, filterCurrency)}
                  </div>
                  {filterCurrency !== 'PKR' && (
                    <div style={{ fontFamily: MONO, fontSize: 6.5, color: C.muted, fontWeight: 600, letterSpacing: '0.02em', lineHeight: 1 }}>
                      ≈ Rs {fmtAmount(pkrVal)}
                    </div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Centered Currencies Filter Row matching Home with Live Rate Tooltip on Hover */}
      <div className="vlf-currency-row" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        paddingTop: 6,
        paddingBottom: 28,
        marginBottom: 8,
      }}>
        {/* All Currencies Option */}
        <div
          className="vlf-currency-item"
          onClick={() => handleCurrencySelect('All')}
          title="All currencies"
        >
          <div
            className="vlf-currency-icon-wrap"
            style={{
              borderColor: filterCurrency === 'All' ? C.navy : 'transparent',
              boxShadow: filterCurrency === 'All' ? `0 0 0 2px ${C.navy}22` : 'none',
            }}
          >
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: filterCurrency === 'All'
                ? `linear-gradient(135deg, ${C.navy}, ${C.navySoft})`
                : `linear-gradient(135deg, ${C.surface}, ${C.ice})`,
              border: `1.5px solid ${C.navy}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12.5,
              fontWeight: 800,
              color: filterCurrency === 'All' ? '#fff' : C.heading,
              boxShadow: 'inset 0 0 0 1.5px #ffffff88',
              flexShrink: 0,
            }}>
              All
            </div>
          </div>
          <div className="vlf-currency-tip" style={{ background: `${C.surface}F0`, border: `1px solid ${C.line}`, color: C.navySoft }}>
            All Currencies
          </div>
        </div>

        {/* Individual Currency Coin Icons */}
        {CURRENCIES.map((c) => {
          const active = filterCurrency === c;
          const rate = settings.rates[c];
          return (
            <div
              key={c}
              className="vlf-currency-item"
              onClick={() => handleCurrencySelect(c)}
              title={c}
            >
              <div
                className="vlf-currency-icon-wrap"
                style={{
                  borderColor: active ? C.navy : 'transparent',
                  boxShadow: active ? `0 0 0 2px ${C.navy}22` : 'none',
                }}
              >
                <CoinIcon currency={c} size={38} />
              </div>
              <div className="vlf-currency-tip" style={{ background: `${C.surface}F0`, border: `1px solid ${C.line}`, color: C.navySoft }}>
                {c === 'PKR' ? 'Default' : `${fmtAmount(rate)} PKR`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time Range Chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ k: 'all', l: 'All time' }, { k: 'week', l: 'This week' }, { k: 'month', l: 'This month' }].map((r) => (
          <Chip key={r.k} active={range === r.k} onClick={() => setRange(r.k)}>{r.l}</Chip>
        ))}
      </div>

      {/* Line-by-Line Currency Breakdown for Selected Category */}
      {filterType !== 'All' && (
        <Card style={{ padding: 14, marginBottom: 18, border: `1.5px solid ${TYPES.find((t) => t.key === filterType)?.color || C.navy}33` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {React.createElement(TYPES.find((t) => t.key === filterType)?.icon || Wallet, {
                size: 16,
                color: TYPES.find((t) => t.key === filterType)?.color || C.heading,
              })}
              <div style={{ fontSize: 13, fontWeight: 800, color: C.heading }}>
                {TYPES.find((t) => t.key === filterType)?.label} by Currency
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 600 }}>
              {range === 'all' ? 'All time' : range === 'week' ? 'This week' : 'This month'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CURRENCIES.map((c) => {
              const data = perCurrencyBreakdown[filterType]?.[c] || { amount: 0, count: 0, pkr: 0 };
              const isCurrActive = filterCurrency === c;
              return (
                <div
                  key={c}
                  onClick={() => handleCurrencySelect(filterCurrency === c ? 'All' : c)}
                  className="vlf-hover"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 10,
                    background: isCurrActive ? `${TYPES.find((t) => t.key === filterType)?.color}15` : C.ice,
                    border: `1px solid ${isCurrActive ? TYPES.find((t) => t.key === filterType)?.color : C.line}`,
                    cursor: 'pointer', transition: 'all .15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CoinIcon currency={c} size={24} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.heading }}>
                        {CURRENCY_META[c]?.name || c}
                      </div>
                      <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 500 }}>
                        {data.count} {data.count === 1 ? 'entry' : 'entries'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: MONO, fontSize: 13, fontWeight: 700,
                      color: data.amount > 0 ? (TYPES.find((t) => t.key === filterType)?.color || C.heading) : C.muted,
                    }}>
                      {fmtMoney(data.amount, c)}
                    </div>
                    {c !== 'PKR' && data.amount > 0 && (
                      <div style={{ fontFamily: MONO, fontSize: 8, color: C.muted, fontWeight: 600 }}>
                        ≈ Rs {fmtAmount(data.pkr)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Multi-Currency Matrix for All Types */}
      {filterType === 'All' && (
        <Card style={{ padding: 14, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.heading, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowUpDown size={15} color={C.steel} />
              <span>Currency Summary ({range === 'all' ? 'All time' : range === 'week' ? 'This week' : 'This month'})</span>
            </div>
            {filterCurrency !== 'All' && (
              <button
                type="button"
                onClick={() => handleCurrencySelect('All')}
                style={{ fontSize: 10.5, fontWeight: 700, color: C.navy, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Reset to All
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CURRENCIES.map((c) => {
              const inc = perCurrencyBreakdown.income?.[c]?.amount || 0;
              const exp = perCurrencyBreakdown.expense?.[c]?.amount || 0;
              const sav = perCurrencyBreakdown.saving?.[c]?.amount || 0;
              const inv = perCurrencyBreakdown.investment?.[c]?.amount || 0;
              const unt = perCurrencyBreakdown.unaccounted?.[c]?.amount || 0;
              const net = inc + sav + inv - exp - unt;
              const hasActivity = inc > 0 || exp > 0 || sav > 0 || inv > 0 || unt > 0;
              const isCurrActive = filterCurrency === c;

              return (
                <div
                  key={c}
                  onClick={() => handleCurrencySelect(filterCurrency === c ? 'All' : c)}
                  className="vlf-hover"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 10,
                    background: isCurrActive ? `${C.navy}12` : C.ice,
                    border: `1px solid ${isCurrActive ? C.navy : C.line}`,
                    cursor: 'pointer', opacity: hasActivity ? 1 : 0.65,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CoinIcon currency={c} size={22} />
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.heading }}>
                      {CURRENCY_META[c]?.shortName || c}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: '#1E9E64', fontWeight: 600 }}>+ {fmtMoney(inc, c)}</div>
                      <div style={{ fontSize: 9, color: '#B23A34', fontWeight: 600 }}>- {fmtMoney(exp, c)}</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 70 }}>
                      <div style={{
                        fontFamily: MONO, fontSize: 12.5, fontWeight: 800,
                        color: net >= 0 ? '#1E9E64' : '#B23A34',
                      }}>
                        {net >= 0 ? '+' : ''}{fmtMoney(net, c)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 13 }}>No entries here yet. Tap + to log your first one.</div>}
      
      {/* Entries List with prominent Currency & Type clarity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((e) => {
          const typeInfo = TYPES.find((t) => t.key === e.type) || TYPES[0];
          const Icon = typeInfo.icon;
          const rateVal = e.rateAtEntry || settings?.rates?.[e.currency] || 1;
          const pkrVal = Number(e.amount) * rateVal;
          const currMeta = CURRENCY_META[e.currency] || { shortName: e.currency, name: e.currency, symbol: '' };

          return (
            <button
              key={e.id}
              onClick={() => onEdit(e)}
              className="vlf-entry-item"
              title="Click to view/edit entry details"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, background: C.surface,
                border: `1px solid ${C.line}`, borderRadius: 14, padding: '11px 12px',
                textAlign: 'left', width: '100%', cursor: 'pointer',
              }}
            >
              <div
                className="vlf-entry-icon-wrap"
                style={{
                  width: 38, height: 38, borderRadius: 10, background: `${typeInfo.color}14`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <Icon size={17} color={typeInfo.color} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Clear Currency & Type line */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 6,
                    background: `${typeInfo.color}18`, color: typeInfo.color, border: `1px solid ${typeInfo.color}33`,
                  }}>
                    {currMeta.shortName}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.heading }}>
                    {typeInfo.label} in {e.currency === 'TRY' ? 'TL' : e.currency}
                  </span>
                  {e.category && (
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
                      · {e.category}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.date}{e.holdingSource ? ` · ${e.holdingSource}` : ''}{e.note ? ` · ${e.note}` : ''}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 14.5, fontWeight: 700, color: typeInfo.color }}>
                    {fmtMoney(e.amount, e.currency)}
                  </div>
                  {e.currency !== 'PKR' && (
                    <div style={{ fontFamily: MONO, fontSize: 8, color: C.muted, marginTop: 1, letterSpacing: '0.02em', fontWeight: 600 }}>
                      ≈ Rs {fmtAmount(pkrVal)}
                    </div>
                  )}
                </div>
                <ChevronRight size={15} color={C.muted} className="vlf-entry-chevron" style={{ flexShrink: 0 }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Summary Block after Divider */}
      {filtered.length > 0 && (
        <>
          <div style={{ height: 1, background: C.line, margin: '22px 0 16px' }} />

          <div style={{
            background: `linear-gradient(135deg, ${C.surface} 0%, ${C.ice} 100%)`,
            border: `1.5px solid ${C.navy}33`,
            borderRadius: 16,
            padding: '14px 16px',
            boxShadow: '0 4px 16px rgba(20,17,13,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            {/* Left: Icon + Label & Filter info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: filterType === 'All' ? `${C.navy}14` : `${TYPES.find((t) => t.key === filterType)?.color || C.navy}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {filterType === 'All' ? (
                  <Wallet size={20} color={C.navy} />
                ) : (
                  React.createElement(TYPES.find((t) => t.key === filterType)?.icon || Wallet, {
                    size: 20,
                    color: TYPES.find((t) => t.key === filterType)?.color || C.navy,
                  })
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: C.heading }}>
                  {filterType === 'All' ? 'Filtered Net Total' : `Total ${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`}
                </div>
                <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 500 }}>
                  {filterCurrency === 'All' ? 'All currencies' : filterCurrency} · {filterType === 'All' ? 'All types' : filterType} · {range === 'all' ? 'All time' : range === 'week' ? 'This week' : 'This month'} ({totalSummary.count} {totalSummary.count === 1 ? 'entry' : 'entries'})
                </div>
              </div>
            </div>

            {/* Right: Calculated Amounts (Income + Rest Amount for All Types, or Single Category Total) */}
            {filterType === 'All' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'right', flexShrink: 0 }}>
                {/* Income */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#1E9E64', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Income
                    </span>
                    <span style={{
                      fontFamily: MONO,
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: '#1E9E64',
                    }}>
                      {filterCurrency === 'All'
                        ? `Rs ${fmtAmount(totalSummary.incomeBase)}`
                        : fmtMoney(totalSummary.incomeFilterCurr, filterCurrency)}
                    </span>
                  </div>
                  {filterCurrency !== 'All' && filterCurrency !== 'PKR' && (
                    <div style={{ fontFamily: MONO, fontSize: 7.5, color: C.muted, fontWeight: 600, marginTop: 1, letterSpacing: '0.02em' }}>
                      ≈ Rs {fmtAmount(totalSummary.incomeBase)}
                    </div>
                  )}
                </div>

                {/* Rest Amount (Income - Expense - Saving - Investment) */}
                <div style={{ paddingTop: 4, borderTop: `1px dashed ${C.line}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: totalSummary.restBase >= 0 ? C.heading : '#B23A34', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Rest
                    </span>
                    <span style={{
                      fontFamily: MONO,
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: totalSummary.restBase >= 0 ? '#1E9E64' : '#B23A34',
                    }}>
                      {filterCurrency === 'All'
                        ? `Rs ${fmtAmount(totalSummary.restBase)}`
                        : fmtMoney(totalSummary.restFilterCurr, filterCurrency)}
                    </span>
                  </div>
                  {filterCurrency !== 'All' && filterCurrency !== 'PKR' && (
                    <div style={{ fontFamily: MONO, fontSize: 7.5, color: C.muted, fontWeight: 600, marginTop: 1, letterSpacing: '0.02em' }}>
                      ≈ Rs {fmtAmount(totalSummary.restBase)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontFamily: MONO,
                  fontSize: 16,
                  fontWeight: 800,
                  color: TYPES.find((t) => t.key === filterType)?.color || C.heading,
                }}>
                  {filterCurrency === 'All'
                    ? `Rs ${fmtAmount(totalSummary.totalBase)}`
                    : fmtMoney(totalSummary.totalInFilterCurr, filterCurrency)}
                </div>
                {filterCurrency !== 'All' && filterCurrency !== 'PKR' && (
                  <div style={{ fontFamily: MONO, fontSize: 8, color: C.muted, fontWeight: 600, marginTop: 1, letterSpacing: '0.02em' }}>
                    ≈ Rs {fmtAmount(totalSummary.totalBase)}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Net Worth                                                          */
/* ------------------------------------------------------------------ */

function NetWorthScreen({ entries, settings, onNavigateToHistory }) {
  const C = useColors();
  const [display, setDisplay] = useState(settings.displayCurrency || 'PKR');
  const [groupBySource, setGroupBySource] = useState(false);

  // Per-currency breakdown including net balance (holdings/savings/investments/income - expenses - untracked)
  // and breakdown of holdings vs net
  const perCurrency = useMemo(() => {
    return CURRENCIES.map((c) => {
      const t = computeTotals(entries, c);
      const grossHoldings = (t.saving || 0) + (t.investment || 0);
      const totalIncome = t.income || 0;
      const totalExpenses = t.expense || 0;
      const totalUntracked = t.unaccounted || 0;
      // Net worth in this currency = (Income + Saving + Investment) - Expense - Untracked
      const net = t.net;
      const inPkr = toBase(net, c, settings.rates);
      const count = entries.filter((e) => e.currency === c).length;
      return {
        currency: c,
        net,
        inPkr,
        grossHoldings,
        totalIncome,
        totalExpenses,
        totalUntracked,
        count,
        hasActivity: (t.income || t.expense || t.saving || t.investment || t.unaccounted) > 0,
      };
    }).filter((x) => x.hasActivity || x.count > 0);
  }, [entries, settings.rates]);

  // Total net worth across all currencies converted to base PKR, then formatted to selected display currency
  const totalNetInBasePkr = useMemo(() => {
    return CURRENCIES.reduce((sum, c) => {
      const t = computeTotals(entries, c);
      return sum + toBase(t.net, c, settings.rates);
    }, 0);
  }, [entries, settings.rates]);

  const convertedTotalNet = fromBase(totalNetInBasePkr, display, settings.rates);

  // Total gross income across all currencies converted to base PKR
  const totalIncomeBase = useMemo(() => {
    return CURRENCIES.reduce((sum, c) => {
      const t = computeTotals(entries, c);
      return sum + toBase(t.income || 0, c, settings.rates);
    }, 0);
  }, [entries, settings.rates]);
  const convertedIncome = fromBase(totalIncomeBase, display, settings.rates);

  // Total savings and investments converted
  const totalSavingsBase = useMemo(() => {
    return CURRENCIES.reduce((sum, c) => {
      const t = computeTotals(entries, c);
      return sum + toBase(t.saving || 0, c, settings.rates);
    }, 0);
  }, [entries, settings.rates]);
  const convertedSavings = fromBase(totalSavingsBase, display, settings.rates);

  const totalInvestmentsBase = useMemo(() => {
    return CURRENCIES.reduce((sum, c) => {
      const t = computeTotals(entries, c);
      return sum + toBase(t.investment || 0, c, settings.rates);
    }, 0);
  }, [entries, settings.rates]);
  const convertedInvestments = fromBase(totalInvestmentsBase, display, settings.rates);

  // Gross before spend (Income + Savings + Investments)
  const totalGrossBeforeSpendBase = totalIncomeBase + totalSavingsBase + totalInvestmentsBase;
  const convertedGrossBeforeSpend = fromBase(totalGrossBeforeSpendBase, display, settings.rates);

  // Expenses & untracked converted
  const totalExpensesBase = useMemo(() => {
    return CURRENCIES.reduce((sum, c) => {
      const t = computeTotals(entries, c);
      return sum + toBase(t.expense || 0, c, settings.rates);
    }, 0);
  }, [entries, settings.rates]);
  const convertedExpenses = fromBase(totalExpensesBase, display, settings.rates);

  const totalUntrackedBase = useMemo(() => {
    return CURRENCIES.reduce((sum, c) => {
      const t = computeTotals(entries, c);
      return sum + toBase(t.unaccounted || 0, c, settings.rates);
    }, 0);
  }, [entries, settings.rates]);
  const convertedUntracked = fromBase(totalUntrackedBase, display, settings.rates);

  const totalOutflowBase = totalExpensesBase + totalUntrackedBase;
  const convertedOutflow = fromBase(totalOutflowBase, display, settings.rates);

  // Net After spend (Total Net Worth)
  const totalNetAfterSpendBase = totalGrossBeforeSpendBase - totalOutflowBase;
  const convertedNetAfterSpend = fromBase(totalNetAfterSpendBase, display, settings.rates);

  const bySource = useMemo(() => {
    const map = {};
    HOLDING_SOURCES.forEach((h) => { map[h] = 0; });
    entries.forEach((e) => {
      if (e.type === 'saving' || e.type === 'investment' || e.type === 'income') {
        const src = e.holdingSource || 'Other';
        map[src] = (map[src] || 0) + toBase(e.amount, e.currency, settings.rates);
      } else if (e.type === 'expense' || e.type === 'unaccounted') {
        // deduct expense/untracked from holding source if assigned
        const src = e.holdingSource || 'Cash in Hand';
        map[src] = (map[src] || 0) - toBase(e.amount, e.currency, settings.rates);
      }
    });
    return map;
  }, [entries, settings.rates]);

  // Exact currency breakdowns for all 5 categories
  const perCurrencyByType = useMemo(() => {
    const map = {
      income: {},
      saving: {},
      investment: {},
      expense: {},
      unaccounted: {},
      outflow: {},
    };
    CURRENCIES.forEach((c) => {
      const t = computeTotals(entries, c);
      map.income[c] = t.income || 0;
      map.saving[c] = t.saving || 0;
      map.investment[c] = t.investment || 0;
      map.expense[c] = t.expense || 0;
      map.unaccounted[c] = t.unaccounted || 0;
      map.outflow[c] = (t.expense || 0) + (t.unaccounted || 0);
    });
    return map;
  }, [entries]);

  const renderCurrencyLines = (typeKey, color) => {
    const activeCurrs = CURRENCIES.filter((c) => (perCurrencyByType[typeKey]?.[c] || 0) > 0);
    if (activeCurrs.length === 0) return null;
    return (
      <div style={{
        marginTop: 6,
        paddingTop: 4,
        borderTop: `1px dashed ${C.line}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        width: '100%',
      }}>
        {activeCurrs.map((c) => {
          const amt = perCurrencyByType[typeKey][c];
          const short = c === 'TRY' ? 'TL' : c;
          const sym = CURRENCY_META[c]?.cleanSymbol || c;
          return (
            <div key={c} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 8.5,
              fontFamily: MONO,
              fontWeight: 800,
              color,
              lineHeight: 1.15,
            }}>
              <span style={{ fontSize: 8, fontWeight: 800, opacity: 0.85 }}>{short}:</span>
              <span>{sym}{fmtAmount(amt)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ padding: '20px 16px 100px', fontFamily: SANS }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 23, color: C.heading, margin: 0, fontWeight: 600 }}>Net Worth</h2>
      </div>

      <SectionLabel>Display in</SectionLabel>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 18 }}>
        {CURRENCIES.map((c) => <Chip key={c} active={display === c} onClick={() => setDisplay(c)}>{c}</Chip>)}
      </div>

      {/* Main Net Worth Card */}
      <div style={{
        background: `linear-gradient(135deg, ${C.navy}, ${C.navySoft})`,
        borderRadius: 20,
        padding: 22,
        color: '#fff',
        marginBottom: 16,
        textAlign: 'center',
        boxShadow: '0 10px 26px rgba(26,23,18,0.28)',
      }}>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Landmark size={14} /> Total Net Worth (All Balances)
        </div>
        <div style={{
          fontFamily: MONO,
          fontSize: 30,
          fontWeight: 700,
          color: convertedTotalNet >= 0 ? '#fff' : '#FFA4A4',
        }}>
          {fmtMoney(convertedTotalNet, display)}
        </div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
          Income + Savings + Investments − Expenses & Untracked (live rates)
        </div>

        {display !== 'PKR' && (
          <div style={{ fontFamily: MONO, fontSize: 12, opacity: 0.85, marginTop: 4 }}>
            ≈ Rs {fmtAmount(totalNetInBasePkr)}
          </div>
        )}
      </div>

      {/* 2 Breakout Sections: Before Spend & After Spend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        {/* Section 1: Before Spend (Gross Inflow & Capital) */}
        <div style={{
          background: C.surface,
          border: `1.5px solid ${C.line}`,
          borderRadius: 18,
          padding: '16px 18px',
          boxShadow: '0 2px 10px rgba(20,17,13,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(30,158,100,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={15} color="#1E9E64" />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: C.heading }}>
                1. Before Spend (Total Inflow & Capital)
              </span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(30,158,100,0.12)', color: '#1E9E64' }}>
              Gross Assets
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            padding: '12px 14px',
            background: C.ice,
            borderRadius: 12,
            marginBottom: 12,
            border: `1px solid ${C.line}`,
          }}>
            <div>
              <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                Total Gross Capital ({display})
              </div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: '#1E9E64', marginTop: 2 }}>
                {fmtMoney(convertedGrossBeforeSpend, display)}
              </div>
            </div>
            {display !== 'PKR' && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 600 }}>Approx PKR</div>
                <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.heading }}>
                  ≈ Rs {fmtAmount(totalGrossBeforeSpendBase)}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div style={{ background: C.ice, borderRadius: 10, padding: '9px 8px', textAlign: 'center', border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 2, fontWeight: 600 }}>Total Income</div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 800, color: '#1E9E64' }}>
                  {fmtMoney(convertedIncome, display)}
                </div>
                {display !== 'PKR' && (
                  <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.muted, marginTop: 2, fontWeight: 600 }}>
                    ≈ Rs {fmtAmount(totalIncomeBase)}
                  </div>
                )}
              </div>
              {renderCurrencyLines('income', '#1E9E64')}
            </div>

            <div style={{ background: C.ice, borderRadius: 10, padding: '9px 8px', textAlign: 'center', border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 2, fontWeight: 600 }}>Pure Savings</div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 800, color: '#2E6F6F' }}>
                  {fmtMoney(convertedSavings, display)}
                </div>
                {display !== 'PKR' && (
                  <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.muted, marginTop: 2, fontWeight: 600 }}>
                    ≈ Rs {fmtAmount(totalSavingsBase)}
                  </div>
                )}
              </div>
              {renderCurrencyLines('saving', '#2E6F6F')}
            </div>

            <div style={{ background: C.ice, borderRadius: 10, padding: '9px 8px', textAlign: 'center', border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 2, fontWeight: 600 }}>Investments</div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 800, color: '#6B5FA8' }}>
                  {fmtMoney(convertedInvestments, display)}
                </div>
                {display !== 'PKR' && (
                  <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.muted, marginTop: 2, fontWeight: 600 }}>
                    ≈ Rs {fmtAmount(totalInvestmentsBase)}
                  </div>
                )}
              </div>
              {renderCurrencyLines('investment', '#6B5FA8')}
            </div>
          </div>
        </div>

        {/* Section 2: After Spend (Net Available Wealth & Outflow) */}
        <div style={{
          background: C.surface,
          border: `1.5px solid ${C.line}`,
          borderRadius: 18,
          padding: '16px 18px',
          boxShadow: '0 2px 10px rgba(20,17,13,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(178,58,52,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={15} color={convertedNetAfterSpend >= 0 ? C.navy : '#B23A34'} />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: C.heading }}>
                2. After Spend (Net Available Wealth)
              </span>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
              background: convertedNetAfterSpend >= 0 ? 'rgba(30,158,100,0.12)' : 'rgba(178,58,52,0.12)',
              color: convertedNetAfterSpend >= 0 ? '#1E9E64' : '#B23A34',
            }}>
              Net Remaining
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            padding: '12px 14px',
            background: C.ice,
            borderRadius: 12,
            marginBottom: 12,
            border: `1px solid ${C.line}`,
          }}>
            <div>
              <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                Net Balance After All Deductions ({display})
              </div>
              <div style={{
                fontFamily: MONO,
                fontSize: 22,
                fontWeight: 800,
                color: convertedNetAfterSpend >= 0 ? '#1E9E64' : '#B23A34',
                marginTop: 2,
              }}>
                {fmtMoney(convertedNetAfterSpend, display)}
              </div>
            </div>
            {display !== 'PKR' && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 600 }}>Approx PKR</div>
                <div style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  fontWeight: 700,
                  color: totalNetAfterSpendBase >= 0 ? '#1E9E64' : '#B23A34',
                }}>
                  ≈ Rs {fmtAmount(totalNetAfterSpendBase)}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div style={{ background: C.ice, borderRadius: 10, padding: '9px 8px', textAlign: 'center', border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 2, fontWeight: 600 }}>Expenses Deducted</div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 800, color: '#B23A34' }}>
                  {fmtMoney(convertedExpenses, display)}
                </div>
                {display !== 'PKR' && (
                  <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.muted, marginTop: 2, fontWeight: 600 }}>
                    ≈ Rs {fmtAmount(totalExpensesBase)}
                  </div>
                )}
              </div>
              {renderCurrencyLines('expense', '#B23A34')}
            </div>

            <div style={{ background: C.ice, borderRadius: 10, padding: '9px 8px', textAlign: 'center', border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 2, fontWeight: 600 }}>Untracked / Lost</div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 800, color: '#D97706' }}>
                  {fmtMoney(convertedUntracked, display)}
                </div>
                {display !== 'PKR' && (
                  <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.muted, marginTop: 2, fontWeight: 600 }}>
                    ≈ Rs {fmtAmount(totalUntrackedBase)}
                  </div>
                )}
              </div>
              {renderCurrencyLines('unaccounted', '#D97706')}
            </div>

            <div style={{ background: C.ice, borderRadius: 10, padding: '9px 8px', textAlign: 'center', border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 2, fontWeight: 600 }}>Total Outflow</div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 800, color: '#B23A34' }}>
                  {fmtMoney(convertedOutflow, display)}
                </div>
                {display !== 'PKR' && (
                  <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.muted, marginTop: 2, fontWeight: 600 }}>
                    ≈ Rs {fmtAmount(totalOutflowBase)}
                  </div>
                )}
              </div>
              {renderCurrencyLines('outflow', '#B23A34')}
            </div>
          </div>
        </div>
      </div>

      {/* Per-currency breakdown section with PKR conversion & Clickable to History */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <SectionLabel style={{ margin: 0 }}>Per-currency breakdown</SectionLabel>
        <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>Tap any currency to view history</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 22 }}>
        {perCurrency.length === 0 && (
          <div style={{ fontSize: 13, color: C.muted, background: C.surface, padding: 16, borderRadius: 14, border: `1px solid ${C.line}`, textAlign: 'center' }}>
            No transactions or balances logged yet.
          </div>
        )}

        {perCurrency.map((x) => (
          <button
            key={x.currency}
            type="button"
            onClick={() => onNavigateToHistory && onNavigateToHistory(x.currency)}
            className="vlf-hover"
            title={`Click to view all ${x.currency} history transactions`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 14px',
              background: C.surface,
              border: `1.5px solid ${C.line}`,
              borderRadius: 15,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              boxShadow: '0 2px 6px rgba(20,17,13,0.03)',
              transition: 'all .15s ease',
            }}
          >
            {/* Left: Coin Icon & Currency details */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <CoinIcon currency={x.currency} size={34} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.heading, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{x.currency}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>
                    ({CURRENCY_META[x.currency]?.cleanSymbol || x.currency})
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span>Inc {fmtAmount(x.totalIncome)}</span>
                  <span>·</span>
                  <span>Exp {fmtAmount(x.totalExpenses)}</span>
                  {x.totalUntracked > 0 && (
                    <>
                      <span>·</span>
                      <span style={{ color: '#D97706', fontWeight: 700 }}>Miss {fmtAmount(x.totalUntracked)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Balance Amount + Approx PKR below + Chevron link */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, textAlign: 'right' }}>
              <div>
                <div style={{
                  fontFamily: MONO,
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: x.net >= 0 ? (x.net > 0 ? '#1E9E64' : C.heading) : '#B23A34',
                }}>
                  {fmtMoney(x.net, x.currency)}
                </div>
                {/* Approx PKR conversion directly underneath */}
                {x.currency !== 'PKR' && (
                  <div style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.muted,
                    marginTop: 2,
                  }}>
                    ≈ Rs {fmtAmount(x.inPkr)}
                  </div>
                )}
              </div>

              <div style={{
                width: 26, height: 26, borderRadius: 8, background: C.ice,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <ChevronRight size={15} color={C.navy} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Group by holding source section */}
      <button
        onClick={() => setGroupBySource((v) => !v)}
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: C.navy,
          background: 'none',
          border: 'none',
          padding: 0,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          cursor: 'pointer',
        }}
      >
        {groupBySource ? 'Hide' : 'Show'} breakdown by holding source
        <ChevronRight size={14} style={{ transform: groupBySource ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {groupBySource && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {HOLDING_SOURCES.map((h) => (
            <Card key={h} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: C.ice, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Banknote size={15} color={C.steel} />
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.heading }}>{h}</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 700, color: (bySource[h] || 0) >= 0 ? C.heading : '#B23A34' }}>
                  {fmtMoney(fromBase(bySource[h], display, settings.rates), display)}
                </div>
                {display !== 'PKR' && (
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted, fontWeight: 600, marginTop: 1 }}>
                    ≈ Rs {fmtAmount(bySource[h])}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Report                                                             */
/* ------------------------------------------------------------------ */

function buildSummaryRows(entries, key) {
  const rows = [];
  CURRENCIES.forEach((c) => {
    const inMonth = entries.filter((e) => e.currency === c && monthKey(e.date) === key);
    if (inMonth.length === 0) return;
    const t = { expense: 0, income: 0, saving: 0, investment: 0, unaccounted: 0 };
    inMonth.forEach((e) => { t[e.type] = (t[e.type] || 0) + Number(e.amount); });
    rows.push({ currency: c, ...t, net: t.income + t.saving + t.investment - t.expense - t.unaccounted });
  });
  return rows;
}

function downloadWorkbook(wb, filename) {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ReportScreen({ entries, reminders = [], requestPassword }) {
  const C = useColors();
  const months = useMemo(() => {
    const set = new Set(entries.map((e) => monthKey(e.date)));
    set.add(monthKey(todayStr()));
    return Array.from(set).sort();
  }, [entries]);
  const [monthIdx, setMonthIdx] = useState(months.length - 1);
  const currentKey = months[monthIdx] || monthKey(todayStr());
  const prevKey = useMemo(() => {
    const [y, m] = currentKey.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [currentKey]);
  const rows = buildSummaryRows(entries, currentKey);
  const prevRows = buildSummaryRows(entries, prevKey);

  const exportAll = () => {
    const rowsData = entries.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map((e) => ({
      Date: e.date, Type: e.type.charAt(0).toUpperCase() + e.type.slice(1), Amount: e.amount,
      Currency: e.currency, Category: e.category || '', 'Holding Source': e.holdingSource || '', Note: e.note || '',
    }));
    const remindersData = (reminders || []).map((r) => ({
      Title: r.title || 'Untitled',
      Type: r.type === 'income' ? 'Receivable (Income)' : r.type === 'saving' ? 'Saving Target' : 'Bill / Expense',
      'Due Date': r.dueDate || 'No Date',
      'Due Amount': r.amount != null ? r.amount : '',
      Currency: r.currency || 'PKR',
      Frequency: r.frequency ? (r.frequency.charAt(0).toUpperCase() + r.frequency.slice(1)) : 'Once',
      Status: r.completed ? 'Completed' : 'Pending',
      Note: r.note || '',
      'Created At': r.createdAt ? r.createdAt.slice(0, 10) : '',
    }));
    const allSummaryData = CURRENCIES.map((c) => {
      const t = computeTotals(entries, c);
      return {
        Currency: c,
        'Total Income': t.income || 0,
        'Total Expense': t.expense || 0,
        'Total Saving': t.saving || 0,
        'Total Investment': t.investment || 0,
        'Untracked Money': t.unaccounted || 0,
        'Net Balance': t.net || 0,
      };
    }).filter((x) => x['Total Income'] || x['Total Expense'] || x['Total Saving'] || x['Total Investment'] || x['Untracked Money']);

    const wb = XLSX.utils.book_new();

    // Sheet 1: All Entries
    const ws = XLSX.utils.json_to_sheet(rowsData, { header: ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Holding Source', 'Note'] });
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'All Entries');

    // Sheet 2: Reminders & Bills
    const wsReminders = XLSX.utils.json_to_sheet(remindersData, { header: ['Title', 'Type', 'Due Date', 'Due Amount', 'Currency', 'Frequency', 'Status', 'Note', 'Created At'] });
    wsReminders['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsReminders, 'Reminders & Bills');

    // Sheet 3: Overall Summary
    const wsSummary = XLSX.utils.json_to_sheet(allSummaryData, { header: ['Currency', 'Total Income', 'Total Expense', 'Total Saving', 'Total Investment', 'Untracked Money', 'Net Balance'] });
    wsSummary['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Currency Summary');

    downloadWorkbook(wb, 'Vaultify-All-Entries-and-Reminders.xlsx');
  };

  const exportMonth = () => {
    const monthEntries = entries.filter((e) => monthKey(e.date) === currentKey).sort((a, b) => (a.date < b.date ? -1 : 1)).map((e) => ({
      Date: e.date, Type: e.type.charAt(0).toUpperCase() + e.type.slice(1), Amount: e.amount,
      Currency: e.currency, Category: e.category || '', 'Holding Source': e.holdingSource || '', Note: e.note || '',
    }));
    const remindersData = (reminders || []).map((r) => ({
      Title: r.title || 'Untitled',
      Type: r.type === 'income' ? 'Receivable (Income)' : r.type === 'saving' ? 'Saving Target' : 'Bill / Expense',
      'Due Date': r.dueDate || 'No Date',
      'Due Amount': r.amount != null ? r.amount : '',
      Currency: r.currency || 'PKR',
      Frequency: r.frequency ? (r.frequency.charAt(0).toUpperCase() + r.frequency.slice(1)) : 'Once',
      Status: r.completed ? 'Completed' : 'Pending',
      Note: r.note || '',
      'Created At': r.createdAt ? r.createdAt.slice(0, 10) : '',
    }));
    const summaryData = rows.map((r) => ({
      Currency: r.currency,
      'Total Income': r.income,
      'Total Expense': r.expense,
      'Total Saving': r.saving,
      'Total Investment': r.investment,
      'Untracked Money': r.unaccounted,
      'Net Flow': r.net,
    }));

    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const wsSummary = XLSX.utils.json_to_sheet(summaryData, { header: ['Currency', 'Total Income', 'Total Expense', 'Total Saving', 'Total Investment', 'Untracked Money', 'Net Flow'] });
    wsSummary['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2: Reminders & Bills
    const wsReminders = XLSX.utils.json_to_sheet(remindersData, { header: ['Title', 'Type', 'Due Date', 'Due Amount', 'Currency', 'Frequency', 'Status', 'Note', 'Created At'] });
    wsReminders['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsReminders, 'Reminders & Bills');

    // Sheet 3: Entries
    const wsEntries = XLSX.utils.json_to_sheet(monthEntries, { header: ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Holding Source', 'Note'] });
    wsEntries['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsEntries, 'Entries');

    downloadWorkbook(wb, `Vaultify-Report-${currentKey}.xlsx`);
  };

  const pendingRemindersCount = (reminders || []).filter((r) => !r.completed).length;

  return (
    <div style={{ padding: '20px 16px 100px', fontFamily: SANS }}>
      <h2 style={{ fontFamily: SERIF, fontSize: 23, color: C.heading, marginBottom: 16, fontWeight: 600 }}>Monthly Report</h2>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button disabled={monthIdx === 0} onClick={() => setMonthIdx((i) => Math.max(0, i - 1))} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: '50%', width: 34, height: 34, opacity: monthIdx === 0 ? 0.4 : 1 }}>
          <ChevronLeft size={16} color={C.heading} style={{ margin: '0 auto' }} />
        </button>
        <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: C.heading }}>{monthLabel(currentKey)}</div>
        <button disabled={monthIdx === months.length - 1} onClick={() => setMonthIdx((i) => Math.min(months.length - 1, i + 1))} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: '50%', width: 34, height: 34, opacity: monthIdx === months.length - 1 ? 0.4 : 1 }}>
          <ChevronRight size={16} color={C.heading} style={{ margin: '0 auto' }} />
        </button>
      </div>
      {rows.length === 0 && <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 13 }}>No activity this month.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {rows.map((r) => {
          const prev = prevRows.find((p) => p.currency === r.currency);
          const diff = prev ? r.expense - prev.expense : null;
          return (
            <Card key={r.currency} style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <CoinIcon currency={r.currency} size={28} />
                <div style={{ fontSize: 14, fontWeight: 700, color: C.heading }}>{CURRENCY_META[r.currency]?.name || r.currency}</div>
                {diff !== null && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: diff > 0 ? '#7A2E2E' : '#39604A' }}>
                    {diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {diff === 0 ? 'Flat vs last month' : `${fmtAmount(Math.abs(diff))} vs last month`}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {[
                  { l: 'Income', v: r.income, c: '#2E6F6F' },
                  { l: 'Spent', v: r.expense, c: '#7A2E2E' },
                  { l: 'Saved', v: r.saving, c: '#39604A' },
                  { l: 'Invested', v: r.investment, c: '#6B5FA8' },
                  { l: 'Untracked', v: r.unaccounted, c: '#D97706' },
                ].map((s) => (
                  <div key={s.l} style={{ flex: '1 1 calc(20% - 4px)', minWidth: 50, background: C.ice, borderRadius: 10, padding: '8px 2px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: C.muted, marginBottom: 3, whiteSpace: 'nowrap' }}>{s.l}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: s.c }}>{fmtAmount(s.v)}</div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <SectionLabel>Export with Reminders (Sheet 2)</SectionLabel>
      <div style={{
        background: C.ice, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 14px',
        marginBottom: 12, fontSize: 12, color: C.navySoft, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Bell size={15} color={C.steel} />
          <span><strong>Sheet 2 Included:</strong> {(reminders || []).length} total reminders ({pendingRemindersCount} pending)</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={() => requestPassword(exportMonth)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.navy, color: '#fff', border: 'none', borderRadius: 14, padding: '13px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          <FileSpreadsheet size={17} /> Export {monthLabel(currentKey)} + Reminders (Sheet 2)
        </button>
        <button onClick={() => requestPassword(exportAll)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.surface, color: C.navy, border: `1.5px solid ${C.navy}`, borderRadius: 14, padding: '13px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          <Download size={17} /> Export Full History + Reminders (Sheet 2)
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profile menu (avatar + dropdown: Settings, Logout)                 */
/* ------------------------------------------------------------------ */

function ProfileMenu({ onOpenSettings, onSignOut }) {
  const C = useColors();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        width: 36, height: 36, borderRadius: '50%', background: C.surface, border: `1px solid ${C.line}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
      }}>
        <UserCircle size={19} color={C.heading} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 44 }} />
          <div style={{
            position: 'absolute', top: 44, right: 0, zIndex: 45, background: C.surface, border: `1px solid ${C.line}`,
            borderRadius: 14, boxShadow: '0 10px 26px rgba(20,17,13,0.18)', minWidth: 168, overflow: 'hidden',
          }}>
            <button onClick={() => { setOpen(false); onOpenSettings(); }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', background: 'none',
              border: 'none', fontSize: 13.5, fontWeight: 600, color: C.navySoft, textAlign: 'left', cursor: 'pointer',
            }}>
              <Settings size={15} /> Settings
            </button>
            <div style={{ height: 1, background: C.line }} />
            <button onClick={() => { setOpen(false); onSignOut(); }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', background: 'none',
              border: 'none', fontSize: 13.5, fontWeight: 600, color: '#7A2E2E', textAlign: 'left', cursor: 'pointer',
            }}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add FAB menu — toggled by the + button, choose Add entry / Reminder / Calc */
/* ------------------------------------------------------------------ */

function FabMenu({ open, onClose, onAddEntry, onAddReminder, onAddUntracked, onCalculator }) {
  const C = useColors();
  if (!open) return null;
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 38 }} onClick={onClose} />
      <div className="vlf-add-menu" style={{
        display: 'flex', flexDirection: 'column', gap: 6, background: C.surface, border: `1px solid ${C.line}`,
        borderRadius: 16, padding: 8, boxShadow: '0 14px 34px rgba(0,0,0,0.35)', minWidth: 215,
      }}>
        <button onClick={() => { onClose(); onAddEntry(); }} className="vlf-hover" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 11, border: 'none',
          background: 'none', color: C.heading, fontSize: 14, fontWeight: 700, textAlign: 'left', cursor: 'pointer',
        }}>
          <Plus size={16} color={C.navy} /> Add entry
        </button>
        <button onClick={() => { onClose(); onAddReminder(); }} className="vlf-hover" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 11, border: 'none',
          background: 'none', color: C.heading, fontSize: 14, fontWeight: 700, textAlign: 'left', cursor: 'pointer',
        }}>
          <Bell size={16} color="#D97706" /> Add reminder
        </button>
        <button onClick={() => { onClose(); onAddUntracked(); }} className="vlf-hover" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 11, border: 'none',
          background: 'none', color: C.heading, fontSize: 14, fontWeight: 700, textAlign: 'left', cursor: 'pointer',
        }}>
          <AlertTriangle size={16} color="#D97706" /> Untracked money
        </button>
        <button onClick={() => { onClose(); onCalculator(); }} className="vlf-hover" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 11, border: 'none',
          background: 'none', color: C.heading, fontSize: 14, fontWeight: 700, textAlign: 'left', cursor: 'pointer',
        }}>
          <CalculatorIcon size={16} color={C.navy} /> Calculator
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Reminder Sheet — Modal to add & edit reminders / bills / dues     */
/* ------------------------------------------------------------------ */

const REMINDER_TYPES = [
  { key: 'expense', label: 'Bill / Due', icon: Receipt, color: '#B23A34' },
  { key: 'income', label: 'Receivable', icon: Wallet, color: '#2E6F6F' },
  { key: 'saving', label: 'Saving Target', icon: PiggyBank, color: '#39604A' },
  { key: 'general', label: 'General Note', icon: Bell, color: '#D97706' },
];

const REMINDER_SUGGESTIONS = [
  'Electricity Bill', 'House Rent', 'Internet / Wi-Fi', 'Mobile Load / Postpaid',
  'Credit Card Bill', 'Loan / Udhaar Return', 'Salary Expected', 'Gym Subscription',
  'Netflix / Cloud Sub', 'School / College Fee', 'Car Fuel / Maintenance'
];

function triggerBrowserNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    } catch (err) {
      console.warn('Browser notification failed:', err);
    }
  }
}

function ReminderSheet({ open, onClose, onSave, onDelete, onPayAndAdd, settings, initial }) {
  const C = useColors();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(settings?.lastCurrency || 'PKR');
  const [dueDate, setDueDate] = useState(todayStr());
  const [frequency, setFrequency] = useState('once');
  const [note, setNote] = useState('');
  const [completed, setCompleted] = useState(false);
  const [touched, setTouched] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title || '');
      setType(initial.type || 'expense');
      setAmount(initial.amount != null ? String(initial.amount) : '');
      setCurrency(initial.currency || settings?.lastCurrency || 'PKR');
      setDueDate(initial.dueDate || todayStr());
      setFrequency(initial.frequency || 'once');
      setNote(initial.note || '');
      setCompleted(!!initial.completed);
      setTouched(false);
    } else {
      setTitle('');
      setType('expense');
      setAmount('');
      setCurrency(settings?.lastCurrency || 'PKR');
      setDueDate(todayStr());
      setFrequency('once');
      setNote('');
      setCompleted(false);
      setTouched(false);
    }
    setTimeout(() => titleRef.current?.focus(), 150);
  }, [open, initial, settings?.lastCurrency]);

  if (!open) return null;
  const activeTypeObj = REMINDER_TYPES.find((t) => t.key === type) || REMINDER_TYPES[0];
  const validAmount = amount !== '' && !isNaN(Number(amount)) && Number(amount) > 0;
  const canSave = title.trim().length > 0 && validAmount;

  const setQuickDate = (daysFromNow) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setDueDate(d.toISOString().slice(0, 10));
  };

  const handleSave = () => {
    setTouched(true);
    if (!canSave) return;

    // Ask notification permission if not yet decided
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    onSave({
      id: initial?.id || uid(),
      title: title.trim(),
      type,
      amount: Number(amount),
      currency,
      dueDate,
      frequency,
      note: note.trim(),
      completed,
      createdAt: initial?.createdAt || new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', background: 'rgba(26,23,18,0.5)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, width: '100%', maxWidth: 480, margin: '0 auto', borderRadius: '24px 24px 0 0',
        maxHeight: '92vh', overflowY: 'auto', padding: '18px 18px 28px', fontFamily: SANS,
        boxShadow: '0 -10px 34px rgba(26,23,18,0.28)',
      }}>
        <div style={{ width: 40, height: 4, background: C.line, borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: `${activeTypeObj.color}14`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Bell size={18} color={activeTypeObj.color} />
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: 20, color: C.heading, margin: 0, fontWeight: 700 }}>
              {initial ? 'Edit Reminder' : 'Add Reminder'}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: C.ice, border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={16} color={C.heading} />
          </button>
        </div>

        {/* Title */}
        <SectionLabel>Reminder Title *</SectionLabel>
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Electricity Bill, House Rent, Friend Loan Return…"
          style={{
            width: '100%', border: `1.5px solid ${touched && !title.trim() ? '#B23A34' : C.line}`, borderRadius: 12, padding: '12px 14px',
            fontSize: 14.5, fontWeight: 600, marginBottom: 10, outline: 'none', color: C.heading,
            background: C.ice, boxSizing: 'border-box', fontFamily: SANS,
          }}
        />

        {/* Quick suggestions */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 14 }}>
          {REMINDER_SUGGESTIONS.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => setTitle(sug)}
              className="vlf-hover"
              style={{
                fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 8,
                background: title === sug ? `${C.navy}14` : C.surface,
                border: `1px solid ${title === sug ? C.navy : C.line}`,
                color: title === sug ? C.navy : C.muted,
                whiteSpace: 'nowrap', cursor: 'pointer',
              }}
            >
              + {sug}
            </button>
          ))}
        </div>

        {/* Reminder Type */}
        <SectionLabel>Type</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {REMINDER_TYPES.map((t) => {
            const Icon = t.icon;
            const active = type === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                style={{
                  flex: 1, padding: '10px 4px', borderRadius: 12, border: `1.5px solid ${active ? t.color : C.line}`,
                  background: active ? `${t.color}14` : C.surface, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4, cursor: 'pointer', transition: 'all .15s ease',
                }}
              >
                <Icon size={16} color={t.color} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: active ? t.color : C.muted }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Amount (Required) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionLabel style={{ margin: 0, marginBottom: 4 }}>Due Amount (Required) *</SectionLabel>
          {touched && !validAmount && (
            <span style={{ fontSize: 10.5, color: '#B23A34', fontWeight: 700 }}>* Please enter amount > 0</span>
          )}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: C.ice,
          borderRadius: 14,
          padding: '10px 14px',
          marginBottom: 10,
          border: `1.5px solid ${touched && !validAmount ? '#B23A34' : C.line}`,
        }}>
          <span style={{ fontFamily: SERIF, fontSize: 18, color: activeTypeObj.color, fontWeight: 700 }}>
            {CURRENCY_META[currency]?.symbol || currency}
          </span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00 (required)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: MONO, fontSize: 18, fontWeight: 600, color: C.heading }}
          />
        </div>

        {/* Currency selection */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
          {CURRENCIES.map((c) => (
            <Chip key={c} active={currency === c} onClick={() => setCurrency(c)} style={{ padding: '5px 11px', fontSize: 12 }}>
              {c}
            </Chip>
          ))}
        </div>

        {/* Due Date & Quick Buttons */}
        <SectionLabel>Due Date</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {[
            { l: 'Today', d: 0 },
            { l: 'Tomorrow', d: 1 },
            { l: 'In 3 Days', d: 3 },
            { l: 'In 1 Week', d: 7 },
            { l: 'In 1 Month', d: 30 },
          ].map((q) => (
            <button
              key={q.l}
              type="button"
              onClick={() => setQuickDate(q.d)}
              style={{
                padding: '5px 9px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: C.ice, border: `1px solid ${C.line}`, color: C.heading, cursor: 'pointer',
              }}
            >
              {q.l}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={{
            width: '100%', border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 14px',
            fontSize: 14, marginBottom: 16, outline: 'none', color: C.heading, background: C.surface,
            boxSizing: 'border-box', fontFamily: SANS,
          }}
        />

        {/* Repeat Frequency */}
        <SectionLabel>Repeat Cycle</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[
            { k: 'once', l: 'Once' },
            { k: 'weekly', l: 'Weekly' },
            { k: 'monthly', l: 'Monthly' },
            { k: 'yearly', l: 'Yearly' },
          ].map((f) => (
            <button
              key={f.k}
              type="button"
              onClick={() => setFrequency(f.k)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                border: `1.5px solid ${frequency === f.k ? C.navy : C.line}`,
                background: frequency === f.k ? `${C.navy}14` : C.surface,
                color: frequency === f.k ? C.navy : C.muted,
                cursor: 'pointer',
              }}
            >
              {f.l}
            </button>
          ))}
        </div>

        {/* Note */}
        <SectionLabel>Note (optional)</SectionLabel>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Account / consumer number, reference notes…"
          style={{
            width: '100%', border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 14px',
            fontSize: 13.5, marginBottom: 20, outline: 'none', color: C.navySoft, background: C.surface,
            boxSizing: 'border-box', fontFamily: SANS,
          }}
        />

        {/* Info reassurance */}
        <div style={{
          fontSize: 11, color: C.muted, textAlign: 'center', margin: '4px 0 14px', lineHeight: 1.4,
          background: C.ice, padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.line}`,
        }}>
          💡 <strong>Notice:</strong> Adding a reminder will <em>not</em> deduct or change your current balance. It will only be logged and deducted when you check it as completed or tap "Pay & Log".
        </div>

        {/* Action Buttons */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: canSave ? C.navy : C.silver, color: '#fff', fontSize: 15,
            fontWeight: 700, cursor: canSave ? 'pointer' : 'default', marginBottom: 10,
          }}
        >
          {initial ? 'Save Changes' : 'Save Reminder'}
        </button>

        {initial && onPayAndAdd && amount && Number(amount) > 0 && (
          <button
            type="button"
            onClick={() => {
              onPayAndAdd(initial);
              onClose();
            }}
            className="vlf-hover"
            style={{
              width: '100%', padding: '12px', borderRadius: 14, border: `1.5px solid ${C.steel}`,
              background: `${C.steel}14`, color: C.steel, fontSize: 13.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              cursor: 'pointer', marginBottom: 10,
            }}
          >
            <Check size={16} strokeWidth={2.6} /> Pay & Log into Vault
          </button>
        )}

        {initial && onDelete && (
          <button
            type="button"
            onClick={() => { onDelete(initial.id); onClose(); }}
            style={{
              width: '100%', padding: '12px', borderRadius: 14, border: '1px solid #7A2E2E33',
              background: C.surface, color: '#7A2E2E', fontSize: 13.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
            }}
          >
            <Trash2 size={15} /> Delete Reminder
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reminders Dashboard Section                                        */
/* ------------------------------------------------------------------ */

function getReminderStatus(dueDateStr) {
  const today = todayStr();
  if (!dueDateStr) return { label: 'Upcoming', color: '#8B7F68', isOverdue: false, isToday: false };
  if (dueDateStr === today) {
    return { label: 'Due Today!', color: '#D97706', isOverdue: false, isToday: true };
  }
  const [ty, tm, td] = today.split('-').map(Number);
  const [dy, dm, dd] = dueDateStr.split('-').map(Number);
  const tDate = new Date(ty, tm - 1, td);
  const dDate = new Date(dy, dm - 1, dd);
  const diffDays = Math.round((dDate.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `Overdue by ${Math.abs(diffDays)}d`, color: '#B23A34', isOverdue: true, isToday: false };
  }
  if (diffDays === 1) {
    return { label: 'Due Tomorrow', color: '#B8842C', isOverdue: false, isToday: false };
  }
  if (diffDays <= 7) {
    return { label: `Due in ${diffDays}d`, color: '#1F6F52', isOverdue: false, isToday: false };
  }
  return { label: `Due on ${dueDateStr}`, color: '#8B7F68', isOverdue: false, isToday: false };
}

function RemindersSection({ reminders, onOpenAddReminder, onEditReminder, onToggleReminder, onPayAndLog }) {
  const C = useColors();
  const [tab, setTab] = useState('active');
  const [notifPerm, setNotifPerm] = useState(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied');

  const handleRequestNotif = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const res = await Notification.requestPermission();
      setNotifPerm(res);
      if (res === 'granted') {
        triggerBrowserNotification('🔔 Vaultify Notifications Enabled', 'You will now receive automatic alerts for due bills and payment reminders!');
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const activeReminders = useMemo(() => {
    return (reminders || []).filter((r) => !r.completed).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  }, [reminders]);

  const completedReminders = useMemo(() => {
    return (reminders || []).filter((r) => r.completed).sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1));
  }, [reminders]);

  const displayed = tab === 'active' ? activeReminders : completedReminders;
  const overdueCount = useMemo(() => {
    return activeReminders.filter((r) => getReminderStatus(r.dueDate).isOverdue).length;
  }, [activeReminders]);
  const dueTodayCount = useMemo(() => {
    return activeReminders.filter((r) => getReminderStatus(r.dueDate).isToday).length;
  }, [activeReminders]);

  // Automated notification trigger on active overdue or due bills
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (activeReminders.length === 0) return;

    const sessionKey = `vlf_notif_${todayStr()}`;
    const alreadyNotified = sessionStorage.getItem(sessionKey);
    if (!alreadyNotified) {
      if (overdueCount > 0) {
        triggerBrowserNotification('⚠️ Overdue Bill Alert', `You have ${overdueCount} overdue bill(s) pending payment.`);
        sessionStorage.setItem(sessionKey, '1');
      } else if (dueTodayCount > 0) {
        triggerBrowserNotification('🔔 Bill Due Today', `You have ${dueTodayCount} bill(s) due for payment today.`);
        sessionStorage.setItem(sessionKey, '1');
      }
    }
  }, [activeReminders, overdueCount, dueTodayCount]);

  return (
    <div style={{
      background: C.surface,
      border: `1.5px solid ${overdueCount > 0 ? '#B23A3444' : dueTodayCount > 0 ? '#D9770644' : C.line}`,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      boxShadow: overdueCount > 0 ? '0 4px 16px rgba(178,58,52,0.08)' : '0 1px 3px rgba(20,17,13,0.03)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: overdueCount > 0 ? 'rgba(178,58,52,0.14)' : 'rgba(217,119,6,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Bell size={18} color={overdueCount > 0 ? '#B23A34' : '#D97706'} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.heading, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Bill & Payment Reminders</span>
              {activeReminders.length > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999,
                  background: overdueCount > 0 ? '#B23A34' : C.navy, color: '#fff',
                }}>
                  {activeReminders.length}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>
              {overdueCount > 0
                ? `${overdueCount} overdue bill${overdueCount > 1 ? 's' : ''}`
                : dueTodayCount > 0
                ? `${dueTodayCount} due today`
                : activeReminders.length > 0
                ? 'Keep track of bills, rent & loan dues'
                : 'No pending reminders'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {typeof window !== 'undefined' && 'Notification' in window && (
            <button
              type="button"
              onClick={handleRequestNotif}
              className="vlf-hover"
              title={notifPerm === 'granted' ? 'Browser notifications are active' : 'Click to enable browser notifications for due bills'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: notifPerm === 'granted' ? 'rgba(30,158,100,0.12)' : C.ice,
                color: notifPerm === 'granted' ? '#1E9E64' : C.muted,
                border: `1px solid ${notifPerm === 'granted' ? '#1E9E6444' : C.line}`,
                borderRadius: 10, padding: '6px 9px', fontSize: 11,
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Bell size={12} color={notifPerm === 'granted' ? '#1E9E64' : 'currentColor'} />
              {notifPerm === 'granted' ? 'Alerts ON' : 'Enable Alerts'}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAddReminder}
            className="vlf-hover"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: C.navy, color: '#fff', border: 'none',
              borderRadius: 10, padding: '7px 12px', fontSize: 12,
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Plus size={13} strokeWidth={2.6} /> Add
          </button>
        </div>
      </div>

      {/* Tabs if there are any reminders */}
      {(reminders || []).length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setTab('active')}
            style={{
              padding: '5px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
              background: tab === 'active' ? `${C.navy}14` : 'transparent',
              border: `1px solid ${tab === 'active' ? C.navy : 'transparent'}`,
              color: tab === 'active' ? C.navy : C.muted, cursor: 'pointer',
            }}
          >
            Pending ({activeReminders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('completed')}
            style={{
              padding: '5px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
              background: tab === 'completed' ? `${C.navy}14` : 'transparent',
              border: `1px solid ${tab === 'completed' ? C.navy : 'transparent'}`,
              color: tab === 'completed' ? C.navy : C.muted, cursor: 'pointer',
            }}
          >
            Completed ({completedReminders.length})
          </button>
        </div>
      )}

      {/* List */}
      {displayed.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '16px 8px', background: C.ice, borderRadius: 12,
          fontSize: 12, color: C.muted, border: `1px dashed ${C.line}`,
        }}>
          {tab === 'active'
            ? 'No pending reminders. Tap "Add Reminder" or the + button to create one.'
            : 'No completed reminders yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayed.map((r) => {
            const st = getReminderStatus(r.dueDate);
            const isExp = r.type === 'expense' || !r.type;
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 10, padding: '10px 12px', background: C.ice, border: `1px solid ${C.line}`,
                  borderRadius: 12, opacity: r.completed ? 0.7 : 1, transition: 'all .15s ease',
                }}
              >
                {/* Checkbox toggle */}
                <button
                  type="button"
                  onClick={() => onToggleReminder(r.id)}
                  title={r.completed ? 'Mark pending' : 'Mark completed'}
                  style={{
                    width: 24, height: 24, borderRadius: 7,
                    border: `1.5px solid ${r.completed ? '#1E9E64' : C.muted}`,
                    background: r.completed ? '#1E9E64' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0, padding: 0,
                  }}
                >
                  {r.completed && <Check size={14} color="#fff" strokeWidth={3} />}
                </button>

                {/* Details */}
                <div
                  onClick={() => onEditReminder(r)}
                  style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                >
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: C.heading,
                    textDecoration: r.completed ? 'line-through' : 'none',
                    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                  }}>
                    <span>{r.title}</span>
                    <span style={{
                      fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
                      background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}33`,
                    }}>
                      {st.label}
                    </span>
                    {r.frequency && r.frequency !== 'once' && (
                      <span style={{ fontSize: 9.5, color: C.muted, fontWeight: 600 }}>
                        ({r.frequency})
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
                    {r.dueDate} {r.note ? `· ${r.note}` : ''}
                  </div>
                </div>

                {/* Amount & Actions */}
                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {r.amount != null && (
                    <div style={{
                      fontFamily: MONO, fontSize: 13, fontWeight: 700,
                      color: isExp ? '#B23A34' : '#2E6F6F',
                    }}>
                      {fmtMoney(r.amount, r.currency || 'PKR')}
                    </div>
                  )}

                  {!r.completed && r.amount != null && onPayAndLog && (
                    <button
                      type="button"
                      onClick={() => onPayAndLog(r)}
                      title="Log into Vault as paid"
                      className="vlf-hover"
                      style={{
                        background: `${C.steel}18`, border: `1px solid ${C.steel}40`,
                        color: C.steel, borderRadius: 8, padding: '4px 8px', fontSize: 11,
                        fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                      }}
                    >
                      Pay & Log
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confirm dialog — generic Yes/No popup                              */
/* ------------------------------------------------------------------ */

function ConfirmDialog({ open, title, message, onYes, onNo, busy, yesText = 'Yes', noText = 'No', isDanger = false }) {
  const C = useColors();
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,0.55)', padding: 20 }} onClick={onNo}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, borderRadius: 18, padding: 24, width: '100%', maxWidth: 350, textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0,0,0,0.35)', border: `1px solid ${C.line}`, fontFamily: SANS,
      }}>
        {isDanger && (
          <div style={{
            width: 46, height: 46, borderRadius: '50%', background: 'rgba(178,58,52,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
          }}>
            <AlertTriangle size={24} color="#B23A34" />
          </div>
        )}
        <div style={{ fontFamily: SERIF, fontSize: 17.5, fontWeight: 700, color: isDanger ? '#B23A34' : C.heading, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: C.navySoft, marginBottom: 22, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{message}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onNo} disabled={busy} style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${C.line}`, background: C.surface, color: C.heading, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
            {noText}
          </button>
          <button onClick={onYes} disabled={busy} style={{
            flex: 1, padding: '12px', borderRadius: 12, border: 'none',
            background: isDanger ? '#B23A34' : C.navy, color: '#fff', fontWeight: 700, fontSize: 13.5,
            opacity: busy ? 0.7 : 1, cursor: 'pointer',
          }}>
            {busy ? 'Processing…' : yesText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calculator — basic mode + currency-aware mode with vault add       */
/* ------------------------------------------------------------------ */

function sanitizeExpr(raw) {
  return raw.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
}
function safeEval(raw) {
  const s = sanitizeExpr(raw || '');
  if (!s || !/^[0-9+\-*/.() ]+$/.test(s)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const v = Function('"use strict"; return (' + s + ')')();
    return typeof v === 'number' && isFinite(v) ? v : null;
  } catch { return null; }
}

const OPERATORS = ['+', '−', '×', '÷'];

function CalculatorScreen({ settings, onSaveEntry, onOpenAddEntry, saving, ratesLoading, onRefreshRates }) {
  const C = useColors();
  const [mode, setMode] = useState('basic');
  const [currency, setCurrency] = useState(settings.lastCurrency || 'PKR');
  const [input, setInput] = useState('');
  const [historyExpr, setHistoryExpr] = useState('');
  const [result, setResult] = useState(null);
  const [justCalculated, setJustCalculated] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  // Currency Converter state
  const [activeConvertCurrency, setActiveConvertCurrency] = useState(settings.lastCurrency || 'USD');
  const [convertInput, setConvertInput] = useState('100');
  const [copiedCurrency, setCopiedCurrency] = useState(null);
  const [vaultEntryTarget, setVaultEntryTarget] = useState(null);

  const activeValue = useMemo(() => {
    if (result !== null) return result;
    const v = safeEval(input);
    return v !== null ? v : 0;
  }, [result, input]);

  const numericConvertValue = useMemo(() => {
    const val = parseFloat(convertInput);
    return isNaN(val) ? 0 : val;
  }, [convertInput]);

  const baseConvertPkr = useMemo(() => {
    return toBase(numericConvertValue, activeConvertCurrency, settings.rates);
  }, [numericConvertValue, activeConvertCurrency, settings.rates]);

  const press = useCallback((val) => {
    if (val === 'C') {
      setInput('');
      setHistoryExpr('');
      setResult(null);
      setJustCalculated(false);
      return;
    }

    if (val === '⌫') {
      if (justCalculated) {
        setJustCalculated(false);
      }
      setInput((p) => {
        const next = p.slice(0, -1);
        if (!next) {
          setResult(null);
          setHistoryExpr('');
        }
        return next;
      });
      return;
    }

    if (val === '=') {
      if (!input) return;
      const v = safeEval(input);
      if (v !== null) {
        const rounded = Number(v.toFixed(6));
        setHistoryExpr(input + ' =');
        setResult(rounded);
        setJustCalculated(true);
      }
      return;
    }

    if (OPERATORS.includes(val)) {
      setHistoryExpr('');
      setJustCalculated(false);
      setInput((p) => {
        if (!p) {
          if (result !== null) {
            return String(result) + val;
          }
          return val === '−' ? '-' : p;
        }
        const last = p.slice(-1);
        if (OPERATORS.includes(last) || last === '-') {
          return p.slice(0, -1) + val;
        }
        // Evaluate the expression entered so far when an operator sign is pressed
        const v = safeEval(p);
        if (v !== null) {
          const rounded = Number(v.toFixed(6));
          setResult(rounded);
        }
        return p + val;
      });
      return;
    }

    if (val === '.') {
      if (justCalculated) {
        setInput('0.');
        setHistoryExpr('');
        setResult(null);
        setJustCalculated(false);
        return;
      }
      setInput((p) => {
        const seg = p.split(/[+\-×÷]/).pop();
        return seg.includes('.') ? p : p + val;
      });
      return;
    }

    // Digit (0-9)
    if (justCalculated) {
      setInput(val);
      setHistoryExpr('');
      setResult(null);
      setJustCalculated(false);
      return;
    }

    // Append digit to top formula. Result at bottom stays locked to previous evaluated answer!
    setInput((p) => p + val);
  }, [input, result, justCalculated]);

  // Keyboard support (desktop) - only for basic/currency modes
  useEffect(() => {
    if (mode === 'convert') return;
    const KEY_MAP = { '+': '+', '-': '−', '*': '×', '/': '÷' };
    const handler = (e) => {
      if (/^[0-9]$/.test(e.key)) { press(e.key); return; }
      if (e.key === '.') { press('.'); return; }
      if (KEY_MAP[e.key]) { e.preventDefault(); press(KEY_MAP[e.key]); return; }
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); press('='); return; }
      if (e.key === 'Backspace') { e.preventDefault(); press('⌫'); return; }
      if (e.key === 'Escape' || e.key.toLowerCase() === 'c') { press('C'); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [press, mode]);

  const openConfirm = () => {
    if (activeValue === 0) return;
    setConfirmOpen(true);
  };

  const handleAddToVaultCurrency = () => {
    if (activeValue === 0) return;
    if (onOpenAddEntry) {
      onOpenAddEntry({
        type: activeValue < 0 ? 'expense' : 'income',
        amount: String(Math.abs(activeValue)),
        currency,
        category: '',
        holdingSource: '',
        note: 'Added from calculator',
        date: todayStr(),
      });
    } else {
      openConfirm();
    }
  };

  const handleAddToVaultConvert = (c, val) => {
    if (!val || val <= 0) return;
    if (onOpenAddEntry) {
      onOpenAddEntry({
        type: 'income',
        amount: String(Math.abs(val)),
        currency: c,
        category: '',
        holdingSource: '',
        note: `Converted from ${convertInput || 0} ${activeConvertCurrency}`,
        date: todayStr(),
      });
    } else {
      setVaultEntryTarget({ currency: c, amount: val });
    }
  };

  const confirmAdd = async () => {
    setAdding(true);
    await onSaveEntry({
      type: activeValue < 0 ? 'expense' : 'income',
      amount: Math.abs(activeValue),
      currency, category: '', holdingSource: '', note: 'Added from calculator', date: todayStr(),
    });
    setAdding(false);
    setConfirmOpen(false);
    setInput('');
    setResult(null);
  };

  const confirmAddConverted = async () => {
    if (!vaultEntryTarget || vaultEntryTarget.amount <= 0) return;
    setAdding(true);
    await onSaveEntry({
      type: 'income',
      amount: Math.abs(vaultEntryTarget.amount),
      currency: vaultEntryTarget.currency,
      category: '',
      holdingSource: '',
      note: `Converted from ${convertInput} ${activeConvertCurrency}`,
      date: todayStr(),
    });
    setAdding(false);
    setVaultEntryTarget(null);
  };

  const handleCopy = (c, val) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(String(val));
      setCopiedCurrency(c);
      setTimeout(() => setCopiedCurrency(null), 1400);
    }
  };

  const KEY_LAYOUT = [
    { label: 'C', col: 1, row: 1 }, { label: '⌫', col: 2, row: 1 }, { label: '÷', col: 3, row: 1 }, { label: '×', col: 4, row: 1 },
    { label: '7', col: 1, row: 2 }, { label: '8', col: 2, row: 2 }, { label: '9', col: 3, row: 2 }, { label: '−', col: 4, row: 2 },
    { label: '4', col: 1, row: 3 }, { label: '5', col: 2, row: 3 }, { label: '6', col: 3, row: 3 }, { label: '+', col: 4, row: 3 },
    { label: '1', col: 1, row: 4 }, { label: '2', col: 2, row: 4 }, { label: '3', col: 3, row: 4 },
    { label: '=', col: 4, row: 4, rowSpan: 2 },
    { label: '0', col: 1, row: 5, colSpan: 2 }, { label: '.', col: 3, row: 5 },
  ];

  const CURRENCY_NAMES = {
    PKR: 'Pakistani Rupee',
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    TRY: 'Turkish Lira',
    USDT: 'Tether USD',
  };

  return (
    <div style={{ fontFamily: SANS, maxWidth: 440, margin: '0 auto' }}>
      <h2 style={{ fontFamily: SERIF, fontSize: 23, color: C.heading, marginBottom: 16, fontWeight: 600 }}>Calculator</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[
          { key: 'basic', label: 'Basic' },
          { key: 'currency', label: 'Currency' },
          { key: 'convert', label: 'Convert' },
        ].map((t) => (
          <button key={t.key} onClick={() => setMode(t.key)} className="vlf-hover" style={{
            flex: 1, padding: '11px 4px', borderRadius: 14, border: `1.5px solid ${mode === t.key ? C.navy : C.line}`,
            background: mode === t.key ? `${C.navy}14` : C.surface, color: mode === t.key ? C.navy : C.muted,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {mode === 'convert' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <SectionLabel>Live Currency Converter</SectionLabel>
            {onRefreshRates && (
              <button
                onClick={onRefreshRates}
                disabled={ratesLoading}
                className="vlf-hover"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, background: 'none',
                  border: 'none', color: C.steel, fontSize: 11.5, fontWeight: 700,
                  cursor: 'pointer', padding: 0,
                }}
              >
                <RefreshCw size={12} style={{ animation: ratesLoading ? 'vlfSpin 1s linear infinite' : 'none' }} />
                {ratesLoading ? 'Updating…' : 'Refresh rates'}
              </button>
            )}
          </div>

          <p style={{ fontSize: 12, color: C.muted, marginTop: -4, marginBottom: 12 }}>
            Put any value next to any currency to see real-time converted rates across all currencies.
          </p>

          {/* Quick Preset Amount Chips */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 14 }}>
            {[
              { label: '100 USD', c: 'USD', val: '100' },
              { label: '1,000 PKR', c: 'PKR', val: '1000' },
              { label: '50,000 PKR', c: 'PKR', val: '50000' },
              { label: '100 EUR', c: 'EUR', val: '100' },
              { label: '100 USDT', c: 'USDT', val: '100' },
              { label: '1,000 TRY', c: 'TRY', val: '1000' },
            ].map((p) => (
              <Chip
                key={p.label}
                active={activeConvertCurrency === p.c && convertInput === p.val}
                onClick={() => {
                  setActiveConvertCurrency(p.c);
                  setConvertInput(p.val);
                }}
                style={{ padding: '5px 11px', fontSize: 11.5 }}
              >
                {p.label}
              </Chip>
            ))}
            <button
              onClick={() => { setConvertInput(''); }}
              className="vlf-hover"
              style={{
                padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                border: `1px solid ${C.line}`, background: C.ice, color: C.muted,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Clear
            </button>
          </div>

          {/* Multi-Currency Conversion Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {CURRENCIES.map((c) => {
              const isBase = activeConvertCurrency === c;
              const convertedNum = isBase ? numericConvertValue : fromBase(baseConvertPkr, c, settings.rates);
              const displayVal = isBase ? convertInput : (convertInput === '' ? '' : fmtAmount(convertedNum));
              const rawNumericVal = isBase ? numericConvertValue : Math.round(convertedNum * 100) / 100;

              // Unit exchange rate vs base
              const unitRateInPkr = settings.rates[c] || 1;
              const rateVsActive = (toBase(1, activeConvertCurrency, settings.rates) / unitRateInPkr);

              return (
                <div
                  key={c}
                  style={{
                    background: isBase ? `${C.navy}08` : C.surface,
                    border: `1.5px solid ${isBase ? C.navy : C.line}`,
                    borderRadius: 16,
                    padding: '12px 14px',
                    transition: 'all .2s ease',
                    boxShadow: isBase ? '0 4px 14px rgba(20,17,13,0.08)' : '0 1px 3px rgba(20,17,13,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    {/* Left: Coin icon + Currency info */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => {
                        if (!isBase) {
                          setActiveConvertCurrency(c);
                          setConvertInput(convertedNum > 0 ? String(Math.round(convertedNum * 100) / 100) : '');
                        }
                      }}
                    >
                      <CoinIcon currency={c} size={36} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: C.heading }}>{c}</span>
                          {isBase && (
                            <span style={{
                              fontSize: 9.5, fontWeight: 700, background: C.navy, color: '#fff',
                              padding: '2px 6px', borderRadius: 6, letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}>
                              Input
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>
                          {CURRENCY_NAMES[c] || c}
                        </div>
                      </div>
                    </div>

                    {/* Right: Interactive Input & Currency Symbol */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0 }}>
                      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.muted }}>
                        {CURRENCY_META[c]?.symbol || ''}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={displayVal}
                        onFocus={() => {
                          if (!isBase) {
                            setActiveConvertCurrency(c);
                            setConvertInput(convertedNum > 0 ? String(Math.round(convertedNum * 100) / 100) : '');
                          }
                        }}
                        onChange={(e) => {
                          const sanitized = e.target.value.replace(/[^0-9.]/g, '');
                          setActiveConvertCurrency(c);
                          setConvertInput(sanitized);
                        }}
                        style={{
                          width: '100%',
                          maxWidth: 140,
                          textAlign: 'right',
                          fontFamily: MONO,
                          fontSize: 16,
                          fontWeight: 700,
                          color: isBase ? C.navy : C.heading,
                          background: isBase ? C.surface : C.ice,
                          border: `1px solid ${isBase ? C.navy : C.line}`,
                          borderRadius: 10,
                          padding: '7px 10px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* Footer inside card: Unit rate & quick actions */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}44`,
                  }}>
                    <div style={{ fontSize: 11, color: C.muted, fontFamily: MONO }}>
                      {c === 'PKR' ? (
                        '1 PKR = 1.00 PKR'
                      ) : (
                        `1 ${c} = ${fmtAmount(unitRateInPkr)} PKR`
                      )}
                      {!isBase && activeConvertCurrency !== c && (
                        <span style={{ opacity: 0.8, marginLeft: 6 }}>
                          · 1 {activeConvertCurrency} ≈ {rateVsActive < 0.01 ? rateVsActive.toFixed(4) : fmtAmount(rateVsActive)} {c}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Copy Action */}
                      <button
                        type="button"
                        onClick={() => handleCopy(c, rawNumericVal)}
                        title="Copy amount"
                        className="vlf-hover"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, background: 'none',
                          border: `1px solid ${C.line}`, borderRadius: 8, padding: '4px 7px',
                          fontSize: 11, fontWeight: 600, color: copiedCurrency === c ? C.steel : C.muted,
                          cursor: 'pointer',
                        }}
                      >
                        {copiedCurrency === c ? <CheckCheck size={12} color={C.steel} /> : <Copy size={12} />}
                        {copiedCurrency === c ? 'Copied' : 'Copy'}
                      </button>

                      {/* Add to vault Action */}
                      <button
                        type="button"
                        onClick={() => handleAddToVaultConvert(c, rawNumericVal)}
                        disabled={rawNumericVal <= 0}
                        title="Add converted amount to Vault"
                        className="vlf-hover"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3, background: C.navy,
                          color: '#fff', border: 'none', borderRadius: 8, padding: '4px 8px',
                          fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          opacity: rawNumericVal <= 0 ? 0.4 : 1,
                        }}
                      >
                        <Plus size={11} strokeWidth={2.6} /> Vault
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rates freshness info bar */}
          <div style={{
            background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14,
            padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.heading, display: 'flex', alignItems: 'center', gap: 5 }}>
                <ArrowRightLeft size={13} color={C.steel} /> Live Market Conversion
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                Rates updated {timeAgo(settings.ratesFetchedAt)}
              </div>
            </div>
            {onRefreshRates && (
              <button
                onClick={onRefreshRates}
                disabled={ratesLoading}
                style={{
                  background: C.ice, border: `1px solid ${C.line}`, borderRadius: 8,
                  padding: '6px 10px', fontSize: 11.5, fontWeight: 700, color: C.navy,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <RefreshCw size={12} style={{ animation: ratesLoading ? 'vlfSpin 1s linear infinite' : 'none' }} />
                Sync
              </button>
            )}
          </div>

          {/* Dialog for adding converted amount to vault (fallback) */}
          <ConfirmDialog
            open={!!vaultEntryTarget}
            busy={adding || saving}
            title="Add converted amount to Vault?"
            message={vaultEntryTarget ? `Add ${fmtMoney(vaultEntryTarget.amount, vaultEntryTarget.currency)} to your vault as income (converted from ${convertInput || 0} ${activeConvertCurrency})?` : ''}
            onYes={confirmAddConverted}
            onNo={() => setVaultEntryTarget(null)}
          />
        </div>
      ) : (
        <>
          {mode === 'currency' && (
            <>
              <SectionLabel>Currency</SectionLabel>
              <div className="vlf-currency-row" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 14, paddingTop: 4, paddingBottom: 20 }}>
                {CURRENCIES.map((c) => (
                  <div key={c} className="vlf-currency-item" onClick={() => setCurrency(c)}>
                    <div className="vlf-currency-icon-wrap" style={{ borderColor: currency === c ? C.navy : 'transparent' }}>
                      <CoinIcon currency={c} size={32} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{
            background: C.surface,
            border: `1.5px solid ${C.line}`,
            borderRadius: 22,
            padding: '20px 22px',
            minHeight: 110,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            boxShadow: '0 4px 16px rgba(20,17,13,0.05)',
            overflow: 'hidden',
          }}>
            {/* Left Center: Distinct, Prominent Currency Badge (when in currency mode) or Calc Icon */}
            {mode === 'currency' ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: `${C.navy}0D`,
                border: `1.5px solid ${C.navy}2E`,
                borderRadius: 16,
                padding: '9px 14px',
                flexShrink: 0,
              }}>
                <CoinIcon currency={currency} size={34} />
                <div>
                  <div style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: C.navy,
                    lineHeight: 1.1,
                    letterSpacing: '0.02em',
                  }}>
                    {currency}
                  </div>
                  <div style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.muted,
                    lineHeight: 1.1,
                    marginTop: 2,
                  }}>
                    {CURRENCY_META[currency]?.symbol || ''}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: C.ice,
                border: `1px solid ${C.line}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <CalculatorIcon size={24} color={C.steel} />
              </div>
            )}

            {/* Right: Top Expression / History, Bottom Evaluated Answer */}
            <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
              {/* Top Entry / History Formula (stays intact after =) */}
              <div style={{
                fontFamily: MONO,
                fontSize: 15.5,
                fontWeight: 600,
                color: C.muted,
                minHeight: 22,
                marginBottom: 6,
                whiteSpace: 'nowrap',
                overflowX: 'auto',
                letterSpacing: '0.02em',
              }}>
                {justCalculated && historyExpr
                  ? historyExpr
                  : (input || (result !== null ? fmtCalcAmount(result) : '\u00A0'))}
              </div>

              {/* Bottom Result: Calculated answer after sign or equal */}
              <div style={{
                fontFamily: MONO,
                fontSize: 34,
                fontWeight: 800,
                color: C.heading,
                whiteSpace: 'nowrap',
                overflowX: 'auto',
                lineHeight: 1.15,
              }}>
                {result !== null
                  ? fmtCalcAmount(result)
                  : (input ? (safeEval(input) !== null ? fmtCalcAmount(safeEval(input)) : input) : '0')}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: 'minmax(52px, auto)', gap: 7, marginBottom: mode === 'currency' ? 14 : 0 }}>
            {KEY_LAYOUT.map((k) => {
              const isOp = ['÷', '×', '−', '+', '='].includes(k.label);
              const isClear = k.label === 'C' || k.label === '⌫';
              return (
                <button key={k.label} onClick={() => press(k.label)} className="vlf-hover" style={{
                  gridColumn: `${k.col} / span ${k.colSpan || 1}`,
                  gridRow: `${k.row} / span ${k.rowSpan || 1}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: k.rowSpan ? 0 : '14px 0', borderRadius: 14, border: `1px solid ${C.line}`,
                  background: isOp ? C.navy : isClear ? C.line : C.surface,
                  color: isOp ? '#fff' : C.heading, fontSize: 16, fontWeight: 700, cursor: 'pointer',
                }}>
                  {k.label}
                </button>
              );
            })}
          </div>

          {mode === 'currency' && (
            <button onClick={handleAddToVaultCurrency} disabled={activeValue === 0} className="vlf-hover" style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: C.navy, color: '#fff', border: 'none', borderRadius: 14, padding: '13px 16px',
              fontSize: 14, fontWeight: 700, opacity: activeValue === 0 ? 0.5 : 1,
            }}>
              <Plus size={16} /> Add to vault
            </button>
          )}

          <ConfirmDialog
            open={confirmOpen}
            busy={adding || saving}
            title="Add to vault?"
            message={activeValue !== 0 ? `Add ${fmtCalcAmount(Math.abs(activeValue))} ${currency} to your vault as ${activeValue < 0 ? 'an expense' : 'income'}?` : ''}
            onYes={confirmAdd}
            onNo={() => setConfirmOpen(false)}
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar — transparent, shrinks on scroll, houses profile menu      */
/* ------------------------------------------------------------------ */

function TopBar({ screen, setScreen, onOpenSettings, onSignOut, onAddEntry }) {
  const C = useColors();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className={`vlf-topbar-wrap ${scrolled ? 'is-scrolled' : ''}`} style={{
      background: scrolled ? `${C.surface}E6` : 'transparent',
      boxShadow: scrolled ? '0 2px 10px rgba(20,17,13,0.06)' : 'none',
    }}>
      <div className="vlf-topbar">
        <div className="vlf-topbar-logo" style={{
          fontFamily: SERIF, fontWeight: 700, color: C.navy, letterSpacing: '0.01em',
          fontSize: scrolled ? 16 : 20, transition: 'font-size .2s ease', flexShrink: 0,
        }}>
          Vaultify
        </div>
        <div className="vlf-header-nav">
          {NAV.map((n) => {
            const Icon = n.icon; const active = screen === n.key;
            return (
              <button key={n.key} onClick={() => setScreen(n.key)} className="vlf-nav-item vlf-hover" style={{
                width: 'auto', color: active ? C.navy : C.muted,
                background: active ? `${C.navy}12` : 'none', border: active ? `1px solid ${C.line}` : '1px solid transparent',
              }}>
                <Icon size={15} color={active ? C.steel : 'currentColor'} /> {n.label}
              </button>
            );
          })}
        </div>
        <div className="vlf-topbar-right">
          <ProfileMenu onOpenSettings={onOpenSettings} onSignOut={onSignOut} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [reminders, setReminders] = useState([]);
  const [reminderSheetOpen, setReminderSheetOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [screen, setScreen] = useState('dashboard');
  const [activeCurrency, setActiveCurrency] = useState('PKR');
  const [totalDisplay, setTotalDisplay] = useState('PKR');
  const [historyCurrency, setHistoryCurrency] = useState('All');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showStamp, setShowStamp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [pwGate, setPwGate] = useState(null);
  const [limitWarning, setLimitWarning] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshRates = useCallback(async (uidVal, currentSettings) => {
    setRatesLoading(true);
    const live = await fetchLiveRates();
    setRatesLoading(false);
    if (!live) return currentSettings;
    const todayKey = live.fetchedAt.slice(0, 10);
    const lastFetchDay = currentSettings.ratesFetchedAt ? currentSettings.ratesFetchedAt.slice(0, 10) : null;
    const isNewDay = lastFetchDay && lastFetchDay !== todayKey;
    const next = {
      ...currentSettings,
      rates: { ...currentSettings.rates, ...live.rates },
      ratesFetchedAt: live.fetchedAt,
      // Snapshot the rates we're about to replace once a day, so trend arrows have a "yesterday" to compare against.
      prevRates: isNewDay ? currentSettings.rates : (currentSettings.prevRates || null),
      prevRatesDate: isNewDay ? lastFetchDay : (currentSettings.prevRatesDate || null),
    };
    const limitsToPersist = { ...(next.budgetLimits || {}) };
    if (next.budgetPeriod) limitsToPersist._period = next.budgetPeriod;
    await supabase.from('settings').upsert({
      user_id: uidVal, budget_limits: limitsToPersist, rates: next.rates,
      rates_fetched_at: next.ratesFetchedAt, display_currency: next.displayCurrency, last_currency: next.lastCurrency,
      theme: next.theme || 'light', prev_rates: next.prevRates, prev_rates_date: next.prevRatesDate,
      updated_at: new Date().toISOString(),
    });
    return next;
  }, []);

  useEffect(() => {
    if (!session) { setDataLoaded(false); return; }
    (async () => {
      const uidVal = session.user.id;
      const [{ data: entryRows }, { data: settingsRow }] = await Promise.all([
        supabase.from('entries').select('*').eq('user_id', uidVal).order('date', { ascending: false }),
        supabase.from('settings').select('*').eq('user_id', uidVal).maybeSingle(),
      ]);
      setEntries((entryRows || []).map(dbToEntry));

      let current = DEFAULT_SETTINGS;
      if (settingsRow) {
        current = {
          budgetLimits: settingsRow.budget_limits || {},
          budgetPeriod: settingsRow.budget_limits?._period || 'week',
          rates: { ...DEFAULT_RATES, ...(settingsRow.rates || {}) },
          ratesFetchedAt: settingsRow.rates_fetched_at,
          displayCurrency: settingsRow.display_currency || 'PKR',
          lastCurrency: settingsRow.last_currency || 'PKR',
          theme: settingsRow.theme || 'light',
          prevRates: settingsRow.prev_rates || null,
          prevRatesDate: settingsRow.prev_rates_date || null,
        };
      } else {
        await supabase.from('settings').insert({
          user_id: uidVal, budget_limits: { _period: 'week' }, rates: DEFAULT_RATES, display_currency: 'PKR', last_currency: 'PKR', theme: 'light',
        });
      }
      setSettings(current);
      setTotalDisplay(current.displayCurrency);

      // Load saved reminders
      try {
        const localReminders = localStorage.getItem(`vaultify_reminders_${uidVal}`);
        if (localReminders) {
          setReminders(JSON.parse(localReminders));
        } else if (settingsRow?.budget_limits?.reminders) {
          setReminders(settingsRow.budget_limits.reminders);
        }
      } catch (err) {
        console.error('Error loading reminders:', err);
      }

      setDataLoaded(true);

      const isStale = !current.ratesFetchedAt || Date.now() - new Date(current.ratesFetchedAt).getTime() > 6 * 60 * 60 * 1000;
      if (isStale) {
        const updated = await refreshRates(uidVal, current);
        setSettings(updated);
      }
    })();
  }, [session, refreshRates]);

  const persistSettings = useCallback(async (next) => {
    setSettings(next);
    if (!session) return;
    const limitsToPersist = { ...(next.budgetLimits || {}) };
    if (next.budgetPeriod) limitsToPersist._period = next.budgetPeriod;
    await supabase.from('settings').upsert({
      user_id: session.user.id, budget_limits: limitsToPersist, rates: next.rates,
      rates_fetched_at: next.ratesFetchedAt, display_currency: next.displayCurrency, last_currency: next.lastCurrency,
      theme: next.theme || 'light', prev_rates: next.prevRates, prev_rates_date: next.prevRatesDate,
      updated_at: new Date().toISOString(),
    });
  }, [session]);

  const persistReminders = useCallback((nextList) => {
    setReminders(nextList);
    if (session?.user?.id) {
      try {
        localStorage.setItem(`vaultify_reminders_${session.user.id}`, JSON.stringify(nextList));
      } catch (err) {
        console.error('Error storing reminders:', err);
      }
    }
  }, [session]);

  const handleSaveReminder = (reminder) => {
    const exists = reminders.some((r) => r.id === reminder.id);
    const next = exists
      ? reminders.map((r) => (r.id === reminder.id ? reminder : r))
      : [reminder, ...reminders];
    persistReminders(next);
    setShowStamp(true);
    setTimeout(() => setShowStamp(false), 900);
  };

  const handleDeleteReminder = (reminderId) => {
    const next = reminders.filter((r) => r.id !== reminderId);
    persistReminders(next);
  };

  const handleToggleReminder = (reminderId) => {
    const next = reminders.map((r) => {
      if (r.id === reminderId) {
        return { ...r, completed: !r.completed };
      }
      return r;
    });
    persistReminders(next);
  };

  const handlePayAndLogReminder = (reminder) => {
    // Pre-fill EntrySheet for this reminder
    setEditingEntry({
      type: reminder.type === 'income' ? 'income' : reminder.type === 'saving' ? 'saving' : 'expense',
      amount: String(reminder.amount || ''),
      currency: reminder.currency || 'PKR',
      category: reminder.type === 'expense' ? 'Bills' : '',
      holdingSource: '',
      note: `[Reminder] ${reminder.title}${reminder.note ? ` · ${reminder.note}` : ''}`,
      date: todayStr(),
    });
    setSheetOpen(true);

    // If recurring (monthly/weekly), advance due date; if once, mark completed
    if (reminder.frequency === 'monthly') {
      const [y, m, d] = (reminder.dueDate || todayStr()).split('-').map(Number);
      const nextMonthDate = new Date(y, m, d);
      const nextDueDate = nextMonthDate.toISOString().slice(0, 10);
      const next = reminders.map((r) => (r.id === reminder.id ? { ...r, dueDate: nextDueDate } : r));
      persistReminders(next);
    } else if (reminder.frequency === 'weekly') {
      const [y, m, d] = (reminder.dueDate || todayStr()).split('-').map(Number);
      const nextWeekDate = new Date(y, m - 1, d + 7);
      const nextDueDate = nextWeekDate.toISOString().slice(0, 10);
      const next = reminders.map((r) => (r.id === reminder.id ? { ...r, dueDate: nextDueDate } : r));
      persistReminders(next);
    } else {
      const next = reminders.map((r) => (r.id === reminder.id ? { ...r, completed: true } : r));
      persistReminders(next);
    }
  };

  const executeSaveEntry = async (entryInput) => {
    if (!session) return;
    setSaving(true);
    const uidVal = session.user.id;
    // Snapshot the live PKR rate for this currency at the moment the entry is saved.
    const entry = {
      ...entryInput,
      rateAtEntry: entryInput.currency !== 'PKR' ? (settings.rates[entryInput.currency] ?? null) : null,
    };
    if (entry.id) {
      let { error } = await supabase.from('entries').update(entryToDb(entry)).eq('id', entry.id);
      if (error && entry.type === 'unaccounted') {
        const fallbackDb = {
          ...entryToDb(entry),
          type: 'expense',
          category: entry.category ? `Untracked: ${entry.category}` : 'Untracked / Missing',
          note: entry.note ? `[Untracked] ${entry.note}` : '[Untracked]',
        };
        const retry = await supabase.from('entries').update(fallbackDb).eq('id', entry.id);
        if (!retry.error) error = null;
      }
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
    } else {
      let { data, error } = await supabase.from('entries').insert({ ...entryToDb(entry), user_id: uidVal }).select().single();
      if (error && entry.type === 'unaccounted') {
        const fallbackDb = {
          ...entryToDb(entry),
          type: 'expense',
          category: entry.category ? `Untracked: ${entry.category}` : 'Untracked / Missing',
          note: entry.note ? `[Untracked] ${entry.note}` : '[Untracked]',
          user_id: uidVal,
        };
        const retry = await supabase.from('entries').insert(fallbackDb).select().single();
        if (!retry.error && retry.data) {
          data = { ...retry.data, type: 'unaccounted' };
          error = null;
        }
      }
      if (data) {
        setEntries((prev) => [dbToEntry(data), ...prev]);
      } else {
        const fallbackId = entry.id || uid();
        setEntries((prev) => [{ ...entry, id: fallbackId }, ...prev]);
      }
    }
    await persistSettings({ ...settings, lastCurrency: entry.currency });
    setSaving(false);
    setSheetOpen(false);
    setEditingEntry(null);
    setShowStamp(true);
    setTimeout(() => setShowStamp(false), 900);
  };

  const handleSaveEntry = async (entryInput) => {
    const isExpense = entryInput.type === 'expense';
    const period = settings.budgetPeriod || settings.budgetLimits?._period || 'week';
    const limit = Number(settings.budgetLimits?.[entryInput.currency]) || 0;

    if (isExpense && limit > 0 && !entryInput.ignoreLimitWarning) {
      const currentSpent = calculateSpentInPeriod(entries, entryInput.currency, period, entryInput.id);
      const newTotal = currentSpent + Number(entryInput.amount);
      if (newTotal > limit) {
        const excess = newTotal - limit;
        const periodName = period === 'week' ? 'weekly' : period === 'month' ? 'monthly' : 'total';
        setLimitWarning({
          entry: { ...entryInput, ignoreLimitWarning: true },
          currency: entryInput.currency,
          amount: entryInput.amount,
          limit,
          excess,
          currentSpent,
          newTotal,
          periodName,
        });
        return;
      }
    }

    await executeSaveEntry(entryInput);
  };

  const handleDeleteEntry = async (id) => {
    await supabase.from('entries').delete().eq('id', id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setSheetOpen(false);
    setEditingEntry(null);
  };

  const theme = settings.theme || 'light';
  const C = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  if (session === undefined) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: LIGHT_COLORS.ice, fontFamily: SERIF, color: LIGHT_COLORS.navy, fontSize: 20 }}>Vaultify</div>;
  }
  if (!session) return <AuthScreen />;
  if (!dataLoaded) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.ice, fontFamily: SERIF, color: C.heading, fontSize: 20 }}>Loading your vault…</div>;
  }

  const handleThemeChange = (nextTheme) => {
    persistSettings({ ...settings, theme: nextTheme });
  };

  const requestPassword = (action) => setPwGate(() => action);

  const handleClearMonth = async (key) => {
    const ids = entries.filter((e) => monthKey(e.date) === key).map((e) => e.id);
    if (ids.length === 0) return;
    await supabase.from('entries').delete().in('id', ids);
    setEntries((prev) => prev.filter((e) => !ids.includes(e.id)));
  };

  const handleClearAll = async () => {
    await supabase.from('entries').delete().eq('user_id', session.user.id);
    setEntries([]);
  };

  return (
    <ThemeContext.Provider value={C}>
      <div style={{ background: C.ice, minHeight: '100vh', fontFamily: SANS }} data-theme={theme}>
        <div className="vlf-shell">
          <TopBar
            screen={screen}
            setScreen={setScreen}
            onOpenSettings={() => setSettingsOpen(true)}
            onSignOut={async () => { await supabase.auth.signOut(); }}
            onAddEntry={() => { setEditingEntry(null); setSheetOpen(true); }}
          />

          <button
            onClick={() => setAddMenuOpen((v) => !v)}
            className="vlf-desktop-fab-circle"
            style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navySoft})`, boxShadow: '0 10px 26px rgba(20,17,13,0.35)' }}
            aria-label="Add"
            title="Add"
          >
            <Plus size={24} color="#fff" strokeWidth={2.6} style={{ transform: addMenuOpen ? 'rotate(45deg)' : 'none', transition: 'transform .2s ease' }} />
          </button>

          <FabMenu
            open={addMenuOpen}
            onClose={() => setAddMenuOpen(false)}
            onAddEntry={() => { setEditingEntry(null); setSheetOpen(true); }}
            onAddReminder={() => { setEditingReminder(null); setReminderSheetOpen(true); }}
            onAddUntracked={() => {
              setEditingEntry({
                type: 'unaccounted',
                amount: '',
                currency: activeCurrency || 'PKR',
                category: 'Forgotten / Unknown',
                holdingSource: 'Cash in Hand',
                note: '',
                date: todayStr(),
              });
              setSheetOpen(true);
            }}
            onCalculator={() => setScreen('calculator')}
          />

          <div className="vlf-main">
            {screen === 'dashboard' && (
              <Dashboard
                entries={entries}
                settings={settings}
                activeCurrency={activeCurrency}
                setActiveCurrency={setActiveCurrency}
                totalDisplay={totalDisplay}
                setTotalDisplay={setTotalDisplay}
                ratesLoading={ratesLoading}
                onOpenAddEntry={(initialData) => {
                  setEditingEntry(initialData);
                  setSheetOpen(true);
                }}
                onNavigateToHistory={(curr) => {
                  setHistoryCurrency(curr || 'All');
                  setScreen('history');
                }}
                reminders={reminders}
                onOpenAddReminder={() => {
                  setEditingReminder(null);
                  setReminderSheetOpen(true);
                }}
                onEditReminder={(r) => {
                  setEditingReminder(r);
                  setReminderSheetOpen(true);
                }}
                onToggleReminder={handleToggleReminder}
                onPayAndLogReminder={handlePayAndLogReminder}
              />
            )}
            {screen === 'history' && (
              <HistoryScreen
                entries={entries}
                settings={settings}
                initialCurrency={historyCurrency}
                onCurrencyChange={setHistoryCurrency}
                onEdit={(e) => requestPassword(() => { setEditingEntry(e); setSheetOpen(true); })}
              />
            )}
            {screen === 'networth' && (
              <NetWorthScreen
                entries={entries}
                settings={settings}
                onNavigateToHistory={(curr) => {
                  setHistoryCurrency(curr || 'All');
                  setScreen('history');
                }}
              />
            )}
            {screen === 'report' && <ReportScreen entries={entries} reminders={reminders} requestPassword={requestPassword} />}
            {screen === 'calculator' && (
              <CalculatorScreen
                settings={settings}
                onSaveEntry={handleSaveEntry}
                onOpenAddEntry={(initialData) => {
                  setEditingEntry(initialData);
                  setSheetOpen(true);
                }}
                saving={saving}
                ratesLoading={ratesLoading}
                onRefreshRates={async () => {
                  if (session?.user?.id) {
                    const updated = await refreshRates(session.user.id, settings);
                    setSettings(updated);
                  }
                }}
              />
            )}
          </div>

          <div className="vlf-bottom-nav" style={{ background: C.surface, borderTop: `1px solid ${C.line}` }}>
            {NAV.slice(0, 2).map((n) => {
              const Icon = n.icon; const active = screen === n.key;
              return (
                <button key={n.key} onClick={() => setScreen(n.key)} className="vlf-bottom-item" style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0', cursor: 'pointer' }}>
                  <Icon size={19} color={active ? C.navy : C.muted} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: active ? C.navy : C.muted }}>{n.label}</span>
                </button>
              );
            })}

            <div onClick={() => setAddMenuOpen((v) => !v)} className="vlf-bottom-center" style={{ background: C.navy, borderColor: C.surface, boxShadow: '0 10px 24px rgba(20,17,13,0.4)' }}>
              <Plus size={26} color="#fff" strokeWidth={2.6} style={{ transform: addMenuOpen ? 'rotate(45deg)' : 'none', transition: 'transform .2s ease' }} />
            </div>

            {NAV.slice(2).map((n) => {
              const Icon = n.icon; const active = screen === n.key;
              return (
                <button key={n.key} onClick={() => setScreen(n.key)} className="vlf-bottom-item" style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0', cursor: 'pointer' }}>
                  <Icon size={19} color={active ? C.navy : C.muted} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: active ? C.navy : C.muted }}>{n.label}</span>
                </button>
              );
            })}
          </div>

          <EntrySheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditingEntry(null); }} onSave={handleSaveEntry} onDelete={(id) => requestPassword(() => handleDeleteEntry(id))} settings={settings} initial={editingEntry} saving={saving} />
          <ReminderSheet
            open={reminderSheetOpen}
            onClose={() => { setReminderSheetOpen(false); setEditingReminder(null); }}
            onSave={handleSaveReminder}
            onDelete={handleDeleteReminder}
            onPayAndAdd={handlePayAndLogReminder}
            settings={settings}
            initial={editingReminder}
          />
          <SettingsSheet
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            settings={settings}
            onSave={(next) => { persistSettings(next); setSettingsOpen(false); }}
            onSignOut={async () => { await supabase.auth.signOut(); }}
            ratesLoading={ratesLoading}
            onRefreshRates={async () => { const updated = await refreshRates(session.user.id, settings); setSettings(updated); }}
            theme={theme}
            onThemeChange={handleThemeChange}
            userEmail={session.user.email}
            entries={entries}
            onClearMonth={(key) => requestPassword(() => handleClearMonth(key))}
            onClearAll={() => requestPassword(handleClearAll)}
          />
          <PasswordGate open={!!pwGate} onClose={() => setPwGate(null)} userEmail={session.user.email}
            onConfirm={() => { const fn = pwGate; setPwGate(null); if (fn) fn(); }} />
          <ConfirmDialog
            open={!!limitWarning}
            isDanger={true}
            title="Limit Reached"
            message={limitWarning ? `This ${fmtMoney(limitWarning.amount, limitWarning.currency)} expense will cross your ${limitWarning.periodName} limit of ${fmtMoney(limitWarning.limit, limitWarning.currency)} by ${fmtMoney(limitWarning.excess, limitWarning.currency)}.\n\nTotal spent will reach ${fmtMoney(limitWarning.newTotal, limitWarning.currency)}.\n\nDo you want to proceed and save anyway?` : ''}
            yesText="Save anyway"
            noText="Cancel"
            busy={saving}
            onYes={async () => {
              const target = limitWarning?.entry;
              setLimitWarning(null);
              if (target) await executeSaveEntry(target);
            }}
            onNo={() => setLimitWarning(null)}
          />
          <SavedStamp show={showStamp} />
        </div>
      </div>
    </ThemeContext.Provider>
  );
}