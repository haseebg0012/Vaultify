import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus, X, TrendingUp, TrendingDown, PiggyBank, Receipt, ChevronRight,
  ChevronLeft, ChevronDown, Settings, Download, Home, History as HistoryIcon,
  Landmark, FileSpreadsheet, Check, Banknote, RefreshCw, LogOut, ShieldCheck,
  Wallet, UserCircle, Sun, Moon, KeyRound, Mail, Calculator as CalculatorIcon,
  ArrowRightLeft, Copy, CheckCheck, ArrowUpDown, AlertTriangle, ExternalLink,
  HelpCircle, Search, Bell, Calendar, Clock, CheckCircle2, ListTodo, Trash2,
  Camera, RotateCcw, RotateCw, ZoomIn, ZoomOut, Move, Crop, Trash, Layers, Eye, EyeOff, Image, UserPlus, Upload,
  Sliders, Undo2, Sparkles, FolderPlus, ArrowRight, Lock, Shuffle, ClipboardPaste,
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
const DEFAULT_PROFILES = [
  {
    id: 'default',
    name: 'Personal Vault',
    avatar: null,
    enabledCurrencies: ['PKR', 'TRY', 'USD', 'EUR', 'GBP', 'USDT'],
  },
];
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

const formatWithCommas = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const s = String(val).replace(/,/g, '');
  const isNegative = s.startsWith('-');
  const clean = isNegative ? s.slice(1) : s;
  const parts = clean.split('.');
  const intPart = parts[0].replace(/\D/g, '');
  const formattedInt = intPart ? Number(intPart).toLocaleString('en-US') : (parts.length > 1 ? '0' : '');
  const res = isNegative ? `-${formattedInt}` : formattedInt;
  if (parts.length > 1) {
    return `${res}.${parts[1].replace(/\D/g, '')}`;
  }
  return res;
};

const parseCleanAmount = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const s = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const parts = s.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : s;
};

const formatExpressionWithCommas = (expr) => {
  if (!expr) return '';
  return String(expr).replace(/\b\d+(\.\d+)?\b/g, (m) => {
    const parts = m.split('.');
    const intPart = Number(parts[0]).toLocaleString('en-US');
    return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
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
  
  let rawNote = r.note || '';
  let workspaceId = null;
  const wsMatch = rawNote.match(/\[WS:([a-zA-Z0-9_\-]+)\]/);
  if (wsMatch) {
    workspaceId = wsMatch[1];
    rawNote = rawNote.replace(/\[WS:[a-zA-Z0-9_\-]+\]\s*/g, '');
  }

  let crossTransfer = null;
  const xferMatch = rawNote.match(/\[XFER:([^:\]]+):([^:\]]+):([^:\]]+)(?::([^:\]]+))?(?::([^:\]]+))?(?::([^:\]]+))?\]/);
  if (xferMatch) {
    crossTransfer = {
      id: xferMatch[1],
      sourceWorkspaceId: xferMatch[2],
      targetWorkspaceId: xferMatch[3],
      role: xferMatch[4] || 'transfer',
      counterpartAmount: xferMatch[5] ? Number(xferMatch[5]) : null,
      counterpartCurrency: xferMatch[6] || null,
    };
    rawNote = rawNote.replace(/\[XFER:[^\]]+\]\s*/g, '');
  }

  return {
    id: r.id,
    type: isUntrackedMarker ? 'unaccounted' : r.type,
    amount: Number(r.amount),
    currency: r.currency,
    category: r.category ? r.category.replace(/^Untracked:\s*/i, '') : '',
    holdingSource: r.holding_source || '',
    note: rawNote.replace(/\[Untracked\]\s*/g, '').trim(),
    date: r.date,
    rateAtEntry: r.rate_at_entry != null ? Number(r.rate_at_entry) : null,
    workspaceId: workspaceId || null,
    crossTransfer: crossTransfer || null,
  };
};

const entryToDb = (e) => {
  let finalNote = e.note || '';
  if (e.crossTransfer) {
    const { id, sourceWorkspaceId, targetWorkspaceId, role, counterpartAmount, counterpartCurrency } = e.crossTransfer;
    const xferTag = `[XFER:${id}:${sourceWorkspaceId}:${targetWorkspaceId}:${role || 'transfer'}:${counterpartAmount || ''}:${counterpartCurrency || ''}]`;
    if (!finalNote.includes(xferTag)) {
      finalNote = `${xferTag} ${finalNote}`.trim();
    }
  }
  if (e.workspaceId) {
    const wsTag = `[WS:${e.workspaceId}]`;
    if (!finalNote.includes(wsTag)) {
      finalNote = `${wsTag} ${finalNote}`.trim();
    }
  }
  return {
    type: e.type,
    amount: e.amount,
    currency: e.currency,
    category: e.category || null,
    holding_source: e.type === 'expense' ? null : (e.holdingSource || null),
    note: finalNote || null,
    date: e.date,
    rate_at_entry: e.rateAtEntry != null ? e.rateAtEntry : null,
  };
};

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
/* Splash Screen                                                      */
/* ------------------------------------------------------------------ */

function SplashScreen({ onComplete }) {
  const [stage, setStage] = useState('center'); // 'center' -> 'moving' -> 'done'

  useEffect(() => {
    // Stage 1: 'center' with pulse (0 to 1.1s)
    const t1 = setTimeout(() => {
      setStage('moving');
    }, 1100);

    // Stage 2: 'moving' to top and fading out (1.1s to 1.8s)
    const t2 = setTimeout(() => {
      setStage('done');
      if (onComplete) onComplete();
    }, 1750);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  if (stage === 'done') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#14110D',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1), transform 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: stage === 'moving' ? 0 : 1,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: stage === 'moving' ? 'translateY(-38vh) scale(0.65)' : 'translateY(0) scale(1)',
          transition: 'all 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Animated V Shield / Emblem */}
        <div
          style={{
            position: 'relative',
            width: 88,
            height: 88,
            borderRadius: 26,
            background: 'linear-gradient(135deg, #1F6F52 0%, #0F3D2C 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 16px 40px rgba(31,111,82,0.45)',
            animation: 'vlfSplashPulse 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: -8,
              borderRadius: 32,
              border: '2px solid rgba(31,111,82,0.4)',
              animation: 'vlfGlowRing 2s ease-in-out infinite',
            }}
          />
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 42,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              textShadow: '0 2px 10px rgba(0,0,0,0.3)',
            }}
          >
            V
          </span>
        </div>

        <div
          style={{
            marginTop: 18,
            fontFamily: SERIF,
            fontSize: 28,
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '0.02em',
          }}
        >
          Vaultify
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.6)',
            marginTop: 5,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          Wealth & Portfolio Intelligence
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Auth screen                                                        */
/* ------------------------------------------------------------------ */

function AuthScreen({ onSignupSuccess, onSignInSuccess }) {
  const C = useColors();
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');
  const [accountDeletedBanner, setAccountDeletedBanner] = useState(() => {
    try {
      return sessionStorage.getItem('vlf_account_deleted_banner') === '1';
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    if (accountDeletedBanner) {
      try {
        sessionStorage.removeItem('vlf_account_deleted_banner');
      } catch (e) {}
    }
  }, [accountDeletedBanner]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter your password.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        try {
          sessionStorage.setItem('vlf_login_action', 'signin');
          sessionStorage.removeItem('vlf_just_signed_up');
        } catch (e) {}
        const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        if (data?.user?.id) {
          try {
            // Existing user successfully logged in via Sign In - strictly bypass onboarding
            localStorage.setItem(`vlf_onboarded_${data.user.id}`, '1');
            localStorage.removeItem(`vlf_pending_signup_${data.user.id}`);
            sessionStorage.removeItem('vlf_just_signed_up');
          } catch (e) {}
        }
        if (onSignInSuccess) {
          onSignInSuccess();
        }
      } else if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim(),
            },
          },
        });
        if (err) throw err;

        const trimmedName = name.trim();
        try {
          sessionStorage.setItem('vlf_login_action', 'signup');
          sessionStorage.setItem('vlf_just_signed_up', '1');
          localStorage.setItem('vlf_pending_onboarding_name', trimmedName);
          if (data?.user?.id) {
            localStorage.setItem(`vlf_pending_onboarding_${data.user.id}`, trimmedName);
            localStorage.setItem(`vlf_pending_signup_${data.user.id}`, '1');
            localStorage.removeItem(`vlf_onboarded_${data.user.id}`);
          }
        } catch (e) {}

        if (onSignupSuccess) {
          onSignupSuccess(trimmedName, data?.user?.id);
        }

        if (data?.session) {
          setInfo('Account created successfully! Preparing your setup wizard…');
        } else {
          setInfo('Account created! If email confirmation is enabled in your Supabase project, check your inbox before signing in.');
        }
      } else if (mode === 'forgot') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
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
      <div style={{ width: '100%', maxWidth: 410 }}>
        {/* Top Logo and Header */}
        <div style={{ textAlign: 'center', marginBottom: 24, color: '#fff' }}>
          <div style={{
            width: 58,
            height: 58,
            margin: '0 auto 12px',
            borderRadius: 18,
            background: 'linear-gradient(135deg, #1F6F52 0%, #0F3D2C 100%)',
            border: '1px solid rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 24px rgba(0,0,0,0.3)',
          }}>
            <span style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 800, color: '#FFFFFF' }}>V</span>
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 27, fontWeight: 700, letterSpacing: '0.01em' }}>Vaultify</div>
          <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 4 }}>Private, multi-currency wealth & net worth tracking</div>
        </div>

        <Card style={{ padding: 24 }}>
          {accountDeletedBanner && (
            <div style={{
              background: '#1E9E6410',
              border: '1.5px solid #1E9E6438',
              borderRadius: 14,
              padding: '12px 14px',
              marginBottom: 18,
              animation: 'vlfPop .35s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: '#1E9E6422',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                }}>
                  <CheckCircle2 size={17} color="#1E9E64" strokeWidth={2.5} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#11653E', marginBottom: 2 }}>
                    Your account was deleted successfully
                  </div>
                  <div style={{ fontSize: 11.5, color: '#1B7247', lineHeight: 1.4 }}>
                    All your portfolio entries, active currencies, workspaces, and records have been permanently wiped.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAccountDeletedBanner(false)}
                  aria-label="Dismiss message"
                  style={{ background: 'none', border: 'none', color: '#1B7247', cursor: 'pointer', padding: 2, display: 'flex' }}
                >
                  <X size={15} />
                </button>
              </div>

              <div style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px solid #1E9E6422',
                fontSize: 11,
                color: '#1B7247',
                lineHeight: 1.45,
              }}>
                <strong>Disclaimer:</strong> Your email has been released. You can click <strong>"Create account"</strong> above at any time to start fresh with a clean portfolio.
              </div>
            </div>
          )}

          {mode !== 'forgot' && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: C.ice, padding: 4, borderRadius: 12 }}>
              {['signin', 'signup'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(''); setInfo(''); }}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700,
                    background: mode === m ? '#fff' : 'transparent', color: mode === m ? C.navy : C.muted,
                    boxShadow: mode === m ? '0 1px 3px rgba(26,23,18,0.12)' : 'none',
                    cursor: 'pointer',
                    transition: 'all .15s ease',
                  }}
                >
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
          )}

          {mode === 'forgot' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: C.heading, marginBottom: 4 }}>Reset password</div>
              <div style={{ fontSize: 12.5, color: C.muted }}>We'll email you a secure link to set a new password.</div>
            </div>
          )}

          <form onSubmit={submit}>
            {/* Full Name for Signup */}
            {mode === 'signup' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.navySoft, display: 'block', marginBottom: 6 }}>
                  Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      border: `1px solid ${C.line}`,
                      borderRadius: 10,
                      padding: '11px 13px',
                      fontSize: 14,
                      outline: 'none',
                      fontFamily: SANS,
                      background: '#FFFFFF',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Email field */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.navySoft, display: 'block', marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  border: `1px solid ${C.line}`,
                  borderRadius: 10,
                  padding: '11px 13px',
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: SANS,
                  background: '#FFFFFF',
                }}
              />
            </div>

            {/* Password field with Show/Hide Eye Toggle */}
            {mode !== 'forgot' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.navySoft, display: 'block', marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      border: `1px solid ${C.line}`,
                      borderRadius: 10,
                      padding: '11px 40px 11px 13px',
                      fontSize: 14,
                      outline: 'none',
                      fontFamily: SANS,
                      background: '#FFFFFF',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: C.muted,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4,
                    }}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            )}

            {/* Re-enter Password for Signup with Eye Toggle */}
            {mode === 'signup' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.navySoft, display: 'block', marginBottom: 6 }}>
                  Re-enter Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      border: `1px solid ${C.line}`,
                      borderRadius: 10,
                      padding: '11px 40px 11px 13px',
                      fontSize: 14,
                      outline: 'none',
                      fontFamily: SANS,
                      background: '#FFFFFF',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: C.muted,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4,
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signin' && (
              <div style={{ textAlign: 'right', marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}
                  style={{ background: 'none', border: 'none', color: C.steel, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div style={{
                fontSize: 12.5,
                color: '#A82D2D',
                background: '#FDF2F2',
                border: '1.5px solid #F8D7DA',
                padding: '12px 14px',
                borderRadius: 12,
                marginBottom: 14,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={15} color="#A82D2D" />
                  <span>{mode === 'signin' ? 'Sign In Failed / Account Not Found' : 'Error'}</span>
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.45, color: '#782020', marginBottom: mode === 'signin' ? 10 : 0 }}>
                  {mode === 'signin' && (error.toLowerCase().includes('invalid login credentials') || error.toLowerCase().includes('user not found') || error.toLowerCase().includes('invalid email or password'))
                    ? 'Account nahi mila ya login credentials durust nahi hain. Agar aapka account abhi tak nahi bana hua, toh baraye meharbani pehle "Create Account" par click karke naya account banayein.'
                    : error}
                </div>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError('');
                      setInfo('');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: C.navy,
                      color: '#fff',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <UserPlus size={13} /> Create Account (Naya Account Banayein) →
                  </button>
                )}
              </div>
            )}
            {info && (
              <div style={{ fontSize: 12.5, color: '#1F6F52', background: '#F0F9F5', border: '1px solid #D1E7DD', padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 12,
                border: 'none',
                background: C.navy,
                color: '#fff',
                fontSize: 14.5,
                fontWeight: 700,
                cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 14px rgba(20,17,13,0.2)',
                transition: 'all .15s ease',
              }}
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create Account & Setup' : 'Send reset link'}
            </button>

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); setInfo(''); }}
                style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: 'none', color: C.muted, fontSize: 12.5, fontWeight: 600, marginTop: 8, cursor: 'pointer' }}
              >
                Back to sign in
              </button>
            )}
          </form>
        </Card>

        <div style={{ textAlign: 'center', fontSize: 11.5, color: C.navySoft, opacity: 0.6, marginTop: 16 }}>
          Same account, real-time sync on mobile, tablet & desktop.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Post-Signup Onboarding Wizard                                      */
/* ------------------------------------------------------------------ */

function OnboardingWizard({ user, initialName = '', onComplete, currentTheme = 'light' }) {
  // Always start fresh at Step 1 on page refresh / initial load until completed
  const [step, setStep] = useState(1);
  const [animStage, setAnimStage] = useState('center'); // 'center' (first 1.8s) -> 'top'

  // Step 1: Vault Name
  const resolvedName = initialName || user?.user_metadata?.full_name || 'My';
  const [vaultName, setVaultName] = useState(() => {
    if (resolvedName && resolvedName !== 'My') {
      return `${resolvedName}'s Vault`;
    }
    return 'Personal Vault';
  });

  // Step 2: Theme
  const [selectedTheme, setSelectedTheme] = useState(currentTheme || 'light');

  // Step 3: Currencies
  const [selectedCurrencies, setSelectedCurrencies] = useState(['PKR', 'USD', 'EUR', 'GBP', 'TRY', 'USDT']);
  const [primaryCurrency, setPrimaryCurrency] = useState('PKR');

  // Additional available currencies user can add
  const ALL_ADDITIONAL_CURRENCIES = [
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', flag: '🇸🇦' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: '$', flag: '🇨🇦' },
    { code: 'AUD', name: 'Australian Dollar', symbol: '$', flag: '🇦🇺' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  ];

  // Dynamic colors for wizard based on chosen theme
  const C = selectedTheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  const changeStep = (nextStep) => {
    setStep(nextStep);
  };

  const handleRestartSetup = () => {
    setStep(1);
    setAnimStage('center');
    setVaultName(resolvedName && resolvedName !== 'My' ? `${resolvedName}'s Vault` : 'Personal Vault');
    setSelectedTheme(currentTheme || 'light');
    setSelectedCurrencies(['PKR', 'USD', 'EUR', 'GBP', 'TRY', 'USDT']);
    setPrimaryCurrency('PKR');
  };

  // Handle center-to-top animation timer on step change
  useEffect(() => {
    setAnimStage('center');
    const timer = setTimeout(() => {
      setAnimStage('top');
    }, 1800);
    return () => clearTimeout(timer);
  }, [step]);

  const toggleCurrency = (code) => {
    setSelectedCurrencies((prev) => {
      if (prev.includes(code)) {
        if (prev.length <= 1) return prev; // Keep at least one
        const filtered = prev.filter((c) => c !== code);
        if (primaryCurrency === code) {
          setPrimaryCurrency(filtered[0] || 'PKR');
        }
        return filtered;
      } else {
        return [...prev, code];
      }
    });
  };

  const handleFinish = () => {
    if (onComplete) {
      onComplete({
        vaultName: vaultName.trim() || 'Personal Vault',
        theme: selectedTheme,
        currencies: selectedCurrencies.length > 0 ? selectedCurrencies : ['PKR', 'USD'],
        displayCurrency: selectedCurrencies.includes(primaryCurrency) ? primaryCurrency : selectedCurrencies[0] || 'PKR',
      });
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.ice,
        color: C.heading,
        fontFamily: SANS,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 18px',
        position: 'relative',
        overflowX: 'hidden',
        transition: 'background 0.3s ease, color 0.3s ease',
      }}
    >
      {/* Background soft ambient decoration */}
      <div
        style={{
          position: 'absolute',
          top: -100,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 500,
          height: 300,
          borderRadius: '50%',
          background: selectedTheme === 'dark' ? 'rgba(31,111,82,0.15)' : 'rgba(31,111,82,0.08)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: 440, zIndex: 1, position: 'relative' }}>
        {/* Step Progress Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 4,
                background: s === step ? (selectedTheme === 'dark' ? '#10B981' : '#1F6F52') : s < step ? (selectedTheme === 'dark' ? 'rgba(16,185,129,0.5)' : 'rgba(31,111,82,0.4)') : C.line,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* STEP 1: Welcome & Name of Vault                               */}
        {/* ------------------------------------------------------------- */}
        {step === 1 && (
          <div style={{ width: '100%' }}>
            {/* Animated Welcome Header (Center for 2s, then animates to Top) */}
            <div
              style={{
                textAlign: 'center',
                transition: 'all 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
                marginBottom: animStage === 'top' ? 20 : 0,
                transform: animStage === 'center' ? 'scale(1.08) translateY(12vh)' : 'scale(1) translateY(0)',
              }}
            >
              <div
                style={{
                  width: animStage === 'center' ? 76 : 52,
                  height: animStage === 'center' ? 76 : 52,
                  margin: '0 auto 12px',
                  borderRadius: animStage === 'center' ? 24 : 16,
                  background: 'linear-gradient(135deg, #1F6F52 0%, #0F3D2C 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 12px 30px rgba(31,111,82,0.35)',
                  transition: 'all 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <span style={{ fontFamily: SERIF, fontSize: animStage === 'center' ? 36 : 24, fontWeight: 800, color: '#fff' }}>
                  V
                </span>
              </div>
              <h1
                style={{
                  fontFamily: SERIF,
                  fontSize: animStage === 'center' ? 30 : 23,
                  fontWeight: 700,
                  color: C.heading,
                  margin: 0,
                  letterSpacing: '0.01em',
                  transition: 'all 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                Welcome to Vaultify
              </h1>
              <p
                style={{
                  fontSize: animStage === 'center' ? 14 : 12.5,
                  color: C.muted,
                  margin: '6px 0 0',
                  transition: 'all 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {animStage === 'center'
                  ? 'Initializing your private wealth manager…'
                  : 'Step 1 of 3 · Basic Setup'}
              </p>
            </div>

            {/* Step 1 Setup Card (Fades in when animation moves to top or immediately accessible) */}
            <div
              className="vlf-animate-fade-in"
              style={{
                background: C.surface,
                border: `1.5px solid ${C.line}`,
                borderRadius: 20,
                padding: '22px 20px',
                boxShadow: '0 10px 28px rgba(0,0,0,0.06)',
                opacity: animStage === 'top' ? 1 : 0.2,
                pointerEvents: animStage === 'top' ? 'auto' : 'none',
                transition: 'opacity 0.6s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(31,111,82,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Landmark size={16} color={selectedTheme === 'dark' ? '#10B981' : '#1F6F52'} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.heading }}>Name your Vault</div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>Give your main financial workspace a name</div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  value={vaultName}
                  onChange={(e) => setVaultName(e.target.value)}
                  placeholder="e.g. Personal Vault"
                  style={{
                    width: '100%',
                    border: `1.5px solid ${C.line}`,
                    borderRadius: 12,
                    padding: '13px 14px',
                    fontSize: 15,
                    fontWeight: 600,
                    color: C.heading,
                    background: C.ice,
                    outline: 'none',
                    fontFamily: SANS,
                  }}
                />
              </div>

              {/* Preset suggestions */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.03em' }}>
                  Quick presets:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['Personal Vault', 'My Main Vault', 'Business & Trading', 'Family Wealth'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setVaultName(preset)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 11.5,
                        fontWeight: 600,
                        border: `1px solid ${vaultName === preset ? (selectedTheme === 'dark' ? '#10B981' : '#1F6F52') : C.line}`,
                        background: vaultName === preset ? (selectedTheme === 'dark' ? 'rgba(16,185,129,0.15)' : 'rgba(31,111,82,0.1)') : C.ice,
                        color: vaultName === preset ? (selectedTheme === 'dark' ? '#10B981' : '#1F6F52') : C.muted,
                        cursor: 'pointer',
                        transition: 'all .15s ease',
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => changeStep(2)}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: 12,
                  border: 'none',
                  background: selectedTheme === 'dark' ? '#10B981' : C.navy,
                  color: selectedTheme === 'dark' ? '#0F1412' : '#fff',
                  fontSize: 14.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                }}
              >
                <span>Continue to Step 2</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 2: Welcome [NAME] & Theme Selection                      */}
        {/* ------------------------------------------------------------- */}
        {step === 2 && (
          <div style={{ width: '100%' }}>
            {/* Animated Welcome [NAME] Header */}
            <div
              style={{
                textAlign: 'center',
                transition: 'all 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
                marginBottom: animStage === 'top' ? 20 : 0,
                transform: animStage === 'center' ? 'scale(1.08) translateY(12vh)' : 'scale(1) translateY(0)',
              }}
            >
              <div
                style={{
                  width: animStage === 'center' ? 70 : 48,
                  height: animStage === 'center' ? 70 : 48,
                  margin: '0 auto 10px',
                  borderRadius: animStage === 'center' ? 22 : 14,
                  background: 'linear-gradient(135deg, #1F6F52 0%, #0F3D2C 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 24px rgba(31,111,82,0.3)',
                  transition: 'all 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <Sparkles size={animStage === 'center' ? 32 : 22} color="#fff" />
              </div>
              <h1
                style={{
                  fontFamily: SERIF,
                  fontSize: animStage === 'center' ? 28 : 22,
                  fontWeight: 700,
                  color: C.heading,
                  margin: 0,
                  letterSpacing: '0.01em',
                  transition: 'all 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                Welcome {resolvedName ? resolvedName : 'User'}, to Vaultify!
              </h1>
              <p
                style={{
                  fontSize: animStage === 'center' ? 14 : 12.5,
                  color: C.muted,
                  margin: '6px 0 0',
                  transition: 'all 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {animStage === 'center'
                  ? 'Customizing your workspace appearance…'
                  : 'Step 2 of 3 · Select your Theme'}
              </p>
            </div>

            {/* Step 2 Theme Selector Card */}
            <div
              className="vlf-animate-fade-in"
              style={{
                background: C.surface,
                border: `1.5px solid ${C.line}`,
                borderRadius: 20,
                padding: '22px 20px',
                boxShadow: '0 10px 28px rgba(0,0,0,0.06)',
                opacity: animStage === 'top' ? 1 : 0.2,
                pointerEvents: animStage === 'top' ? 'auto' : 'none',
                transition: 'opacity 0.6s ease',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: C.heading, marginBottom: 12 }}>
                Choose your visual style
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {/* Light Theme Card */}
                <div
                  onClick={() => setSelectedTheme('light')}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    cursor: 'pointer',
                    background: '#FAF7EF',
                    border: `2px solid ${selectedTheme === 'light' ? '#1F6F52' : 'rgba(20,40,32,0.12)'}`,
                    boxShadow: selectedTheme === 'light' ? '0 4px 16px rgba(31,111,82,0.2)' : 'none',
                    transition: 'all .2s ease',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sun size={16} color="#1F6F52" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#14110D' }}>Light</span>
                    </div>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: `2px solid ${selectedTheme === 'light' ? '#1F6F52' : '#7C8983'}`,
                        background: selectedTheme === 'light' ? '#1F6F52' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selectedTheme === 'light' && <Check size={11} color="#fff" strokeWidth={3} />}
                    </div>
                  </div>
                  <div style={{ background: '#FFFFFF', padding: 8, borderRadius: 8, border: '1px solid rgba(20,40,32,0.08)' }}>
                    <div style={{ fontSize: 9, color: '#7C8983', fontWeight: 600 }}>Balance</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#14110D', fontFamily: MONO }}>Rs 125,000</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#7C8983', marginTop: 8, fontWeight: 600 }}>
                    Crisp ivory & emerald
                  </div>
                </div>

                {/* Dark Theme Card */}
                <div
                  onClick={() => setSelectedTheme('dark')}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    cursor: 'pointer',
                    background: '#0F1412',
                    border: `2px solid ${selectedTheme === 'dark' ? '#10B981' : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: selectedTheme === 'dark' ? '0 4px 16px rgba(16,185,129,0.25)' : 'none',
                    transition: 'all .2s ease',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Moon size={16} color="#10B981" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#F3F4F6' }}>Dark</span>
                    </div>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: `2px solid ${selectedTheme === 'dark' ? '#10B981' : '#6B7280'}`,
                        background: selectedTheme === 'dark' ? '#10B981' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selectedTheme === 'dark' && <Check size={11} color="#0F1412" strokeWidth={3} />}
                    </div>
                  </div>
                  <div style={{ background: '#161D1A', padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>Balance</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#FFFFFF', fontFamily: MONO }}>Rs 125,000</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8, fontWeight: 600 }}>
                    Obsidian & mint glow
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => changeStep(1)}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 12,
                    border: `1px solid ${C.line}`,
                    background: 'transparent',
                    color: C.heading,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => changeStep(3)}
                  style={{
                    flex: 1,
                    padding: '13px',
                    borderRadius: 12,
                    border: 'none',
                    background: selectedTheme === 'dark' ? '#10B981' : C.navy,
                    color: selectedTheme === 'dark' ? '#0F1412' : '#fff',
                    fontSize: 14.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  }}
                >
                  <span>Continue to Step 3</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 3: Currencies Selection & Add Options                    */}
        {/* ------------------------------------------------------------- */}
        {step === 3 && (
          <div style={{ width: '100%' }}>
            {/* Step 3 Header */}
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  margin: '0 auto 10px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #1F6F52 0%, #0F3D2C 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 20px rgba(31,111,82,0.3)',
                }}
              >
                <Banknote size={22} color="#fff" />
              </div>
              <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: C.heading, margin: 0 }}>
                Select Currencies
              </h1>
              <p style={{ fontSize: 12.5, color: C.muted, margin: '4px 0 0' }}>
                Step 3 of 3 · Choose which currencies you want to track
              </p>
            </div>

            {/* Currencies Setup Card */}
            <div
              className="vlf-animate-fade-in"
              style={{
                background: C.surface,
                border: `1.5px solid ${C.line}`,
                borderRadius: 20,
                padding: '20px 18px',
                boxShadow: '0 10px 28px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.heading }}>Primary Core Currencies</span>
                <span style={{ fontSize: 11, color: C.muted }}>Tap to enable/disable</span>
              </div>

              {/* Core Currencies Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
                {CURRENCIES.map((code) => {
                  const meta = CURRENCY_META[code] || {};
                  const isSelected = selectedCurrencies.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleCurrency(code)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: `1.5px solid ${isSelected ? (selectedTheme === 'dark' ? '#10B981' : '#1F6F52') : C.line}`,
                        background: isSelected ? (selectedTheme === 'dark' ? 'rgba(16,185,129,0.12)' : 'rgba(31,111,82,0.08)') : C.ice,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all .15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{meta.flag || '🪙'}</span>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: C.heading }}>{code}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>{meta.cleanSymbol || code}</div>
                        </div>
                      </div>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: `1.5px solid ${isSelected ? (selectedTheme === 'dark' ? '#10B981' : '#1F6F52') : C.line}`,
                          background: isSelected ? (selectedTheme === 'dark' ? '#10B981' : '#1F6F52') : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected && <Check size={11} color={selectedTheme === 'dark' ? '#0F1412' : '#fff'} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Additional Global Currencies Section */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.03em' }}>
                  Add More Currencies:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ALL_ADDITIONAL_CURRENCIES.map((c) => {
                    const isSelected = selectedCurrencies.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggleCurrency(c.code)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          fontSize: 11.5,
                          fontWeight: 700,
                          border: `1px solid ${isSelected ? (selectedTheme === 'dark' ? '#10B981' : '#1F6F52') : C.line}`,
                          background: isSelected ? (selectedTheme === 'dark' ? 'rgba(16,185,129,0.18)' : 'rgba(31,111,82,0.12)') : C.ice,
                          color: isSelected ? (selectedTheme === 'dark' ? '#10B981' : '#1F6F52') : C.heading,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          cursor: 'pointer',
                          transition: 'all .15s ease',
                        }}
                      >
                        <span>{c.flag}</span>
                        <span>{c.code}</span>
                        {isSelected ? <Check size={12} strokeWidth={2.5} /> : <Plus size={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Base Display Currency Picker */}
              <div style={{ padding: '12px 14px', background: C.ice, borderRadius: 12, border: `1px solid ${C.line}`, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.heading, marginBottom: 6 }}>
                  Default Display Currency
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedCurrencies.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPrimaryCurrency(c)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        border: `1px solid ${primaryCurrency === c ? (selectedTheme === 'dark' ? '#10B981' : '#1F6F52') : C.line}`,
                        background: primaryCurrency === c ? (selectedTheme === 'dark' ? '#10B981' : '#1F6F52') : C.surface,
                        color: primaryCurrency === c ? '#fff' : C.heading,
                        cursor: 'pointer',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => changeStep(2)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: `1px solid ${C.line}`,
                    background: 'transparent',
                    color: C.heading,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  style={{
                    flex: 1,
                    padding: '13px',
                    borderRadius: 12,
                    border: 'none',
                    background: selectedTheme === 'dark' ? '#10B981' : C.navy,
                    color: selectedTheme === 'dark' ? '#0F1412' : '#fff',
                    fontSize: 14.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  }}
                >
                  <Sparkles size={17} />
                  <span>Finish Setup & Enter Vault</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Restart Setup Option (always visible at bottom center) */}
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button
            type="button"
            onClick={handleRestartSetup}
            style={{
              background: 'none',
              border: 'none',
              color: selectedTheme === 'dark' ? '#9CA3AF' : C.muted,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              transition: 'all .15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = selectedTheme === 'dark' ? '#10B981' : C.heading; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = selectedTheme === 'dark' ? '#9CA3AF' : C.muted; }}
          >
            <RotateCcw size={13} />
            <span>Restart setup from beginning</span>
          </button>
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Entry Sheet                                                        */
/* ------------------------------------------------------------------ */

function EntrySheet({ open, onClose, onSave, onDelete, settings, initial, saving, currencies = CURRENCIES }) {
  const C = useColors();
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(() => {
    const last = settings.lastCurrency || 'PKR';
    return (currencies && currencies.includes(last)) ? last : (currencies?.[0] || 'PKR');
  });
  const [category, setCategory] = useState('');
  const [holdingSource, setHoldingSource] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());
  const amountRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const defaultCurr = (currencies && currencies.includes(settings.lastCurrency)) ? settings.lastCurrency : (currencies?.[0] || 'PKR');
    if (initial) {
      setType(initial.type); setAmount(String(initial.amount));
      setCurrency(currencies.includes(initial.currency) ? initial.currency : defaultCurr);
      setCategory(initial.category || ''); setHoldingSource(initial.holdingSource || '');
      setNote(initial.note || ''); setDate(initial.date);
    } else {
      setType('expense'); setAmount('');
      setCurrency(defaultCurr);
      setCategory(''); setHoldingSource(''); setNote(''); setDate(todayStr());
    }
    setTimeout(() => amountRef.current?.focus(), 150);
  }, [open, initial, currencies]);

  useEffect(() => {
    if (category && !(CATEGORY_MAP[type] || []).includes(category)) setCategory('');
  }, [type]);

  if (!open) return null;
  const activeType = TYPES.find((t) => t.key === type);
  const canSave = Number(parseCleanAmount(amount)) > 0 && !saving;

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
          {currencies.map((c) => (
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
          <input ref={amountRef} type="text" inputMode="decimal" placeholder="0.00" value={amount ? formatWithCommas(amount) : ''} onChange={(e) => setAmount(parseCleanAmount(e.target.value))}
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

        <button onClick={() => onSave({ id: initial?.id, type, amount: Number(parseCleanAmount(amount)), currency, category, holdingSource, note, date })}
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
/* Avatar Crop & Adjust Modal (Zoom In / Out, Fit, Pan, Rotate)      */
/* ------------------------------------------------------------------ */

function AvatarAdjustModal({ open, imageSrc, onClose, onSave }) {
  const C = useColors();
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [bgColor, setBgColor] = useState('#14110D');
  const [isDragging, setIsDragging] = useState(false);
  const [imgDims, setImgDims] = useState({ width: 200, height: 200 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  const BG_PRESETS = [
    { label: 'Dark', color: '#14110D' },
    { label: 'White', color: '#FFFFFF' },
    { label: 'Navy', color: '#0F2C24' },
    { label: 'Warm', color: '#F5F2EC' },
    { label: 'Slate', color: '#2B3545' },
    { label: 'Charcoal', color: '#222222' },
  ];

  useEffect(() => {
    if (open && imageSrc) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setImgDims({ width: img.width || 200, height: img.height || 200 });
      };
      img.src = imageSrc;
      setZoom(1);
      setPanX(0);
      setPanY(0);
      setRotation(0);
      setIsDragging(false);
    }
  }, [open, imageSrc]);

  if (!open || !imageSrc) return null;

  const handlePointerDown = (e) => {
    setIsDragging(true);
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    dragStartRef.current = { x: clientX, y: clientY };
    panStartRef.current = { x: panX, y: panY };
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setPanX(panStartRef.current.x + dx);
    setPanY(panStartRef.current.y + dy);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    setZoom((z) => Math.max(0.2, Math.min(3, +(z + delta).toFixed(2))));
  };

  // Preview sizing: exact cover fill at zoom = 1.0
  const coverScale = Math.max(200 / (imgDims.width || 200), 200 / (imgDims.height || 200));
  const baseW = (imgDims.width || 200) * coverScale;
  const baseH = (imgDims.height || 200) * coverScale;
  const previewW = baseW * zoom;
  const previewH = baseH * zoom;

  const handleFitWhole = () => {
    const fitScale = Math.min(200 / (imgDims.width || 200), 200 / (imgDims.height || 200));
    setZoom(Math.max(0.2, +(fitScale / coverScale).toFixed(2)));
    setPanX(0);
    setPanY(0);
  };

  const handleApply = () => {
    const canvas = document.createElement('canvas');
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.save();

      // Circular clip path for crisp result
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();

      // Background color for fitted/zoomed-out photo
      ctx.fillStyle = bgColor || '#14110D';
      ctx.fillRect(0, 0, size, size);

      // Center and rotate
      ctx.translate(size / 2, size / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Cover scaling math for 400px canvas
      const canvasCoverScale = Math.max(size / img.width, size / img.height);
      const canvasBaseW = img.width * canvasCoverScale;
      const canvasBaseH = img.height * canvasCoverScale;
      const drawW = canvasBaseW * zoom;
      const drawH = canvasBaseH * zoom;

      const ratio = size / 200; // 2
      const finalPanX = panX * ratio;
      const finalPanY = panY * ratio;

      ctx.drawImage(img, -drawW / 2 + finalPanX, -drawH / 2 + finalPanY, drawW, drawH);
      ctx.restore();

      const result = canvas.toDataURL('image/jpeg', 0.94);
      onSave(result);
      onClose();
    };
    img.src = imageSrc;
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,17,13,0.65)', backdropFilter: 'blur(4px)', padding: 16 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface, width: '100%', maxWidth: 440, borderRadius: 22,
          padding: '20px 22px', boxShadow: '0 20px 48px rgba(0,0,0,0.3)', fontFamily: SANS,
          display: 'flex', flexDirection: 'column', gap: 14, border: `1px solid ${C.line}`,
          maxHeight: '92vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.heading, fontFamily: SERIF }}>Adjust Profile Photo</h3>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: C.muted }}>Zoom in/out, shrink to fit, or drag to reposition</p>
          </div>
          <button onClick={onClose} style={{ background: C.ice, border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={15} color={C.heading} />
          </button>
        </div>

        {/* Interactive Circular Viewport */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onWheel={handleWheel}
            style={{
              width: 200, height: 200, borderRadius: '50%', overflow: 'hidden',
              position: 'relative', border: `3px solid ${C.navy}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.22)', background: bgColor,
              cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none',
            }}
          >
            <img
              src={imageSrc}
              alt="Adjustment preview"
              draggable={false}
              style={{
                width: previewW,
                height: previewH,
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) rotate(${rotation}deg)`,
                maxWidth: 'none',
                maxHeight: 'none',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
            {/* Guide circle ring */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.45)', pointerEvents: 'none' }} />
          </div>
          <span style={{ fontSize: 11, color: C.steel, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Move size={12} /> Drag inside circle • Scroll to zoom
          </span>
        </div>

        {/* Quick Size / Zoom Presets */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={handleFitWhole}
            style={{
              padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.line}`,
              background: `${C.navy}10`, color: C.navy, fontSize: 11, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            🔍 Fit Whole Photo
          </button>
          {[
            { label: '100% (Fill)', val: 1.0 },
            { label: '125%', val: 1.25 },
            { label: '150%', val: 1.5 },
            { label: '200%', val: 2.0 },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => { setZoom(item.val); setPanX(0); setPanY(0); }}
              style={{
                padding: '6px 9px', borderRadius: 8,
                border: Math.abs(zoom - item.val) < 0.05 ? `1.5px solid ${C.navy}` : `1px solid ${C.line}`,
                background: Math.abs(zoom - item.val) < 0.05 ? C.navy : C.ice,
                color: Math.abs(zoom - item.val) < 0.05 ? '#fff' : C.navySoft,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Zoom Slider with Wide Range (20% to 300%) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: C.ice, padding: '10px 12px', borderRadius: 14, border: `1px solid ${C.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, color: C.heading }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><ZoomIn size={13} color={C.navy} /> Scale / Size (Zoom In & Out)</span>
            <span style={{ color: C.navy, fontWeight: 800 }}>{Math.round(zoom * 100)}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              title="Zoom out / Make smaller"
              onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)))}
              style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.line}`, background: C.surface, color: C.navy, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}
            >
              −
            </button>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.02"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: C.navy, cursor: 'pointer' }}
            />
            <button
              type="button"
              title="Zoom in / Make bigger"
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
              style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.line}`, background: C.surface, color: C.navy, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}
            >
              +
            </button>
          </div>
        </div>

        {/* Circle Background Color for fitted/small photos */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.ice, padding: '8px 12px', borderRadius: 12, border: `1px solid ${C.line}` }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.heading }}>Photo Frame Background:</span>
          <div style={{ display: 'flex', gap: 5 }}>
            {BG_PRESETS.map((p) => (
              <button
                key={p.color}
                type="button"
                onClick={() => setBgColor(p.color)}
                title={p.label}
                style={{
                  width: 20, height: 20, borderRadius: '50%', background: p.color,
                  border: bgColor === p.color ? `2px solid ${C.navy}` : '1.5px solid rgba(0,0,0,0.15)',
                  boxShadow: bgColor === p.color ? '0 0 0 2px #fff inset' : 'none',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>

        {/* Alignment Presets & Rotate */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => { setPanX(0); setPanY(0); }}
            style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.ice, fontSize: 11, fontWeight: 700, color: C.navySoft, cursor: 'pointer' }}
          >
            🎯 Center
          </button>
          <button
            type="button"
            onClick={() => { setPanX(0); setPanY(25); setZoom((z) => Math.max(z, 1.15)); }}
            style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.ice, fontSize: 11, fontWeight: 700, color: C.navySoft, cursor: 'pointer' }}
          >
            👤 Focus Face
          </button>
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.ice, fontSize: 11, fontWeight: 700, color: C.navySoft, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <RotateCw size={11} /> Rotate 90°
          </button>
          <button
            type="button"
            onClick={() => { setPanX(0); setPanY(0); setZoom(1); setRotation(0); }}
            style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.ice, fontSize: 11, fontWeight: 700, color: C.muted, cursor: 'pointer' }}
          >
            Reset
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1px solid ${C.line}`, background: C.ice, color: C.navySoft, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: C.navy, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(20,17,13,0.18)' }}
          >
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Excel / CSV Data Sheet Importer Helpers & Modal                    */
/* ------------------------------------------------------------------ */

function parseExcelDate(val) {
  if (!val) return todayStr();
  if (val instanceof Date && !isNaN(val)) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number') {
    // Excel date serial number (epoch is 1899-12-30)
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + val * 86400000);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      const y = parts[2];
      if (p1 > 12) {
        return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      } else {
        const testD = new Date(str);
        if (!isNaN(testD)) return testD.toISOString().slice(0, 10);
        return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }
    }
  }
  const parsed = new Date(str);
  if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
  return todayStr();
}

function parseExcelType(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s.includes('inc') || s.includes('salary') || s.includes('revenue') || s.includes('receivable') || s.includes('gain') || s.includes('inflow')) return 'income';
  if (s.includes('sav') || s.includes('deposit') || s.includes('holding in')) return 'saving';
  if (s.includes('inv') || s.includes('crypto') || s.includes('stock') || s.includes('fund') || s.includes('trade')) return 'investment';
  if (s.includes('untrack') || s.includes('unaccount') || s.includes('miss') || s.includes('leak') || s.includes('lost') || s.includes('unknown')) return 'unaccounted';
  return 'expense';
}

function parseExcelCurrency(raw, fallback = 'PKR') {
  const s = String(raw || '').toUpperCase().trim();
  for (const c of CURRENCIES) {
    if (s.includes(c)) return c;
  }
  if (s.includes('TL') || s.includes('LIRA')) return 'TRY';
  if (s.includes('RS') || s.includes('RUPEE') || s.includes('₨')) return 'PKR';
  if (s.includes('DOLLAR') || s.includes('$')) return 'USD';
  if (s.includes('EURO') || s.includes('€')) return 'EUR';
  if (s.includes('POUND') || s.includes('£')) return 'GBP';
  if (s.includes('TETHER') || s.includes('USDT') || s.includes('₮')) return 'USDT';
  return fallback;
}

function parseExcelAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return Math.abs(raw);
  const clean = String(raw).replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.abs(num);
}

function parseWorkbookFile(dataBuffer, fallbackCurrency = 'PKR') {
  const workbook = XLSX.read(dataBuffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) throw new Error('No sheets found in the uploaded workbook.');

  let entryRows = [];
  let reminderRows = [];

  const entriesSheetName = sheetNames.find((n) => /all entries|entries|transactions|statement|sheet1|history/i.test(n)) || sheetNames[0];
  const remindersSheetName = sheetNames.find((n) => /reminder|bill|sheet2|sheet 2/i.test(n));

  if (entriesSheetName && workbook.Sheets[entriesSheetName]) {
    entryRows = XLSX.utils.sheet_to_json(workbook.Sheets[entriesSheetName], { defval: '' });
  }

  if (remindersSheetName && remindersSheetName !== entriesSheetName && workbook.Sheets[remindersSheetName]) {
    reminderRows = XLSX.utils.sheet_to_json(workbook.Sheets[remindersSheetName], { defval: '' });
  }

  const parsedEntries = [];
  for (const r of entryRows) {
    const amountVal = parseExcelAmount(r.Amount || r.amount || r['Due Amount'] || r.Total || r.Value || r['Transaction Amount']);
    if (amountVal <= 0) continue;

    const dateVal = parseExcelDate(r.Date || r.date || r['Transaction Date'] || r.Timestamp || r.Time);
    const typeVal = parseExcelType(r.Type || r.type || r.Category || r.category || r.Description);
    const currencyVal = parseExcelCurrency(r.Currency || r.currency || r.Symbol || r.Unit, fallbackCurrency);
    const categoryVal = String(r.Category || r.category || r['Category Name'] || (typeVal === 'expense' ? 'Other' : '')).trim();
    const holdingSourceVal = String(r['Holding Source'] || r.holdingSource || r.Source || r.Account || r.Wallet || '').trim();
    const noteVal = String(r.Note || r.note || r.Description || r.Memo || r.Details || '').trim();

    parsedEntries.push({
      id: uid(),
      type: typeVal,
      amount: amountVal,
      currency: currencyVal,
      category: categoryVal,
      holdingSource: typeVal === 'expense' ? '' : holdingSourceVal,
      note: noteVal,
      date: dateVal,
      rateAtEntry: null,
    });
  }

  const parsedReminders = [];
  for (const r of reminderRows) {
    const titleVal = String(r.Title || r.title || r.Reminder || r['Bill Name'] || r.Name || '').trim();
    if (!titleVal) continue;
    const amountVal = parseExcelAmount(r['Due Amount'] || r.Amount || r.amount || r.DueAmount);
    const dateVal = parseExcelDate(r['Due Date'] || r.dueDate || r.DueDate || r.Date);
    const currencyVal = parseExcelCurrency(r.Currency || r.currency, fallbackCurrency);
    const freqRaw = String(r.Frequency || r.frequency || 'once').toLowerCase();
    const frequencyVal = ['weekly', 'monthly', 'yearly'].find((f) => freqRaw.includes(f)) || 'once';
    const statusRaw = String(r.Status || r.status || '').toLowerCase();
    const completedVal = statusRaw.includes('comp') || statusRaw === 'paid' || r.completed === true;
    const noteVal = String(r.Note || r.note || '').trim();

    parsedReminders.push({
      id: uid(),
      title: titleVal,
      type: freqRaw.includes('inc') ? 'income' : freqRaw.includes('sav') ? 'saving' : 'expense',
      dueDate: dateVal,
      amount: amountVal,
      currency: currencyVal,
      frequency: frequencyVal,
      completed: completedVal,
      note: noteVal,
      createdAt: new Date().toISOString(),
    });
  }

  return { entries: parsedEntries, reminders: parsedReminders, sheetNames };
}

function ImportSheetModal({
  open,
  onClose,
  userEmail,
  onImport,
  defaultCurrency = 'PKR',
}) {
  const C = useColors();
  const [step, setStep] = useState('auth'); // 'auth' | 'upload' | 'preview' | 'importing' | 'success'
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [importMode, setImportMode] = useState('merge'); // 'merge' | 'replace'
  const [importSummary, setImportSummary] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setStep('auth');
      setPassword('');
      setShowPassword(false);
      setAuthError('');
      setAuthLoading(false);
      setParseLoading(false);
      setParseError('');
      setParsedData(null);
      setFileName('');
      setFileSize('');
      setImportMode('merge');
      setImportSummary(null);
    }
  }, [open]);

  if (!open) return null;

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setAuthError('Please enter your account password.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });
      setAuthLoading(false);
      if (err) {
        setAuthError('Incorrect password. Verification failed.');
        return;
      }
      setStep('upload');
    } catch (err) {
      setAuthLoading(false);
      setAuthError(err?.message || 'Verification error occurred.');
    }
  };

  const handleFileProcess = (file) => {
    if (!file) return;
    setParseError('');
    setParseLoading(true);
    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const result = parseWorkbookFile(buffer, defaultCurrency);
        if (result.entries.length === 0 && result.reminders.length === 0) {
          setParseError('No transaction rows or reminders found in this file. Please verify file format.');
          setParseLoading(false);
          return;
        }
        setParsedData(result);
        setParseLoading(false);
        setStep('preview');
      } catch (err) {
        console.error('File parsing error:', err);
        setParseError(`Failed to parse file: ${err.message || 'Unknown format'}`);
        setParseLoading(false);
      }
    };
    reader.onerror = () => {
      setParseError('Error reading selected file.');
      setParseLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleExecuteImport = async () => {
    if (!parsedData) return;
    setStep('importing');
    try {
      const res = await onImport({
        importedEntries: parsedData.entries,
        importedReminders: parsedData.reminders,
        mode: importMode,
      });
      setImportSummary({
        entriesCount: res?.count ?? parsedData.entries.length,
        remindersCount: res?.reminderCount ?? parsedData.reminders.length,
        mode: importMode,
      });
      setStep('success');
    } catch (err) {
      console.error(err);
      setParseError(`Import failed: ${err.message || 'Database error'}`);
      setStep('preview');
    }
  };

  // Currency breakdown for preview
  const currencyCounts = parsedData?.entries?.reduce((acc, e) => {
    acc[e.currency] = (acc[e.currency] || 0) + 1;
    return acc;
  }, {}) || {};

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,10,10,0.72)', backdropFilter: 'blur(6px)', padding: 16,
      }}
      onClick={step === 'importing' ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface, borderRadius: 22, padding: '24px 22px',
          width: '100%', maxWidth: 450, fontFamily: SANS,
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          border: `1.5px solid ${C.line}`,
          maxHeight: '90vh', overflowY: 'auto',
          transition: 'all .2s ease',
        }}
      >
        {/* ============================================================ */}
        {/* STEP 1: PASSWORD AUTHENTICATION                              */}
        {/* ============================================================ */}
        {step === 'auth' && (
          <div>
            <div style={{
              width: 50, height: 50, borderRadius: '50%', background: `${C.navy}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
              border: `1.5px solid ${C.navy}24`,
            }}>
              <KeyRound size={24} color={C.navy} />
            </div>

            <h3 style={{
              fontFamily: SERIF, fontSize: 19, fontWeight: 800, color: C.heading,
              textAlign: 'center', margin: '0 0 6px',
            }}>
              Password Authorization Required
            </h3>

            <p style={{
              fontSize: 12.5, color: C.muted, textAlign: 'center', margin: '0 0 16px', lineHeight: 1.45,
            }}>
              To securely import transactions and update your Vaultify database, please confirm your account password.
            </p>

            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  required
                  placeholder="Enter account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%', border: `1.5px solid ${C.line}`, borderRadius: 12,
                    padding: '12px 42px 12px 14px', fontSize: 14, background: C.ice,
                    color: C.heading, boxSizing: 'border-box', outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {authError && (
                <div style={{ fontSize: 12, color: '#B23A34', fontWeight: 600, textAlign: 'center' }}>
                  {authError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={authLoading}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${C.line}`,
                    background: C.surface, color: C.heading, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={authLoading}
                  style={{
                    flex: 1.3, padding: '12px', borderRadius: 12, border: 'none',
                    background: C.navy, color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', opacity: authLoading ? 0.7 : 1, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: 7,
                    boxShadow: '0 4px 14px rgba(20,17,13,0.18)',
                  }}
                >
                  {authLoading ? (
                    <>
                      <RefreshCw size={14} style={{ animation: 'vlfSpin 1s linear infinite' }} />
                      <span>Verifying…</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} strokeWidth={2.8} />
                      <span>Authorize & Continue</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: FILE UPLOAD & DROPZONE                               */}
        {/* ============================================================ */}
        {step === 'upload' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, background: `${C.navy}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Upload size={18} color={C.navy} />
                </div>
                <h3 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 800, color: C.heading, margin: 0 }}>
                  Upload Data Sheet
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 16px', lineHeight: 1.45 }}>
              Upload your downloaded Vaultify Excel backup or custom spreadsheet (<code style={{ fontFamily: MONO, fontSize: 11, background: C.ice, padding: '2px 5px', borderRadius: 4 }}>.xlsx</code>, <code style={{ fontFamily: MONO, fontSize: 11, background: C.ice, padding: '2px 5px', borderRadius: 4 }}>.xls</code>, <code style={{ fontFamily: MONO, fontSize: 11, background: C.ice, padding: '2px 5px', borderRadius: 4 }}>.csv</code>).
            </p>

            {/* Drag and drop box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? C.navy : `${C.line}`}`,
                background: isDragging ? `${C.navy}08` : C.ice,
                borderRadius: 16,
                padding: '30px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all .2s ease',
                marginBottom: 16,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileProcess(file);
                }}
              />
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: C.surface,
                boxShadow: '0 3px 12px rgba(20,17,13,0.08)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px',
              }}>
                <FileSpreadsheet size={24} color={C.steel} />
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.heading, marginBottom: 4 }}>
                Click to browse or drag & drop sheet here
              </div>
              <div style={{ fontSize: 11.5, color: C.muted }}>
                Supports Excel (.xlsx, .xls) and CSV files
              </div>
            </div>

            {parseLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', color: C.navy, fontSize: 13, fontWeight: 700 }}>
                <RefreshCw size={16} style={{ animation: 'vlfSpin 1s linear infinite' }} />
                <span>Analyzing and parsing sheet columns…</span>
              </div>
            )}

            {parseError && (
              <div style={{
                background: '#B23A3412', border: '1px solid #B23A3433', borderRadius: 10,
                padding: '10px 12px', fontSize: 12, color: '#B23A34', fontWeight: 600, marginBottom: 14,
              }}>
                {parseError}
              </div>
            )}

            {/* Capabilities Info Box */}
            <div style={{
              background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12,
              padding: '12px 14px', fontSize: 11.5, color: C.navySoft, lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 800, color: C.heading, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>💡</span>
                <span>Automatic Column Mapping:</span>
              </div>
              <div>
                Vaultify automatically recognizes <code style={{ fontFamily: MONO, fontSize: 10.5 }}>Date</code>, <code style={{ fontFamily: MONO, fontSize: 10.5 }}>Type</code>, <code style={{ fontFamily: MONO, fontSize: 10.5 }}>Amount</code>, <code style={{ fontFamily: MONO, fontSize: 10.5 }}>Currency</code>, <code style={{ fontFamily: MONO, fontSize: 10.5 }}>Category</code>, and <code style={{ fontFamily: MONO, fontSize: 10.5 }}>Reminders (Sheet 2)</code>.
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: DATA PREVIEW & MODE SELECTION                        */}
        {/* ============================================================ */}
        {step === 'preview' && parsedData && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: '#1E9E6418',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckCircle2 size={18} color="#1E9E64" />
                </div>
                <h3 style={{ fontFamily: SERIF, fontSize: 17.5, fontWeight: 800, color: C.heading, margin: 0 }}>
                  Ready to Import
                </h3>
              </div>
              <span style={{ fontSize: 11, fontFamily: MONO, color: C.muted, background: C.ice, padding: '3px 8px', borderRadius: 6 }}>
                {fileName} ({fileSize})
              </span>
            </div>

            {/* Statistics pill cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
              <div style={{ background: C.ice, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Transactions Found</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.heading, fontFamily: MONO, marginTop: 2 }}>
                  {parsedData.entries.length}
                </div>
              </div>
              <div style={{ background: C.ice, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Reminders Found</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.heading, fontFamily: MONO, marginTop: 2 }}>
                  {parsedData.reminders.length}
                </div>
              </div>
            </div>

            {/* Currency Breakdown Chips */}
            {Object.keys(currencyCounts).length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>
                  CURRENCIES DETECTED
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(currencyCounts).map(([cur, count]) => (
                    <span
                      key={cur}
                      style={{
                        background: `${C.navy}0D`, border: `1px solid ${C.navy}24`,
                        borderRadius: 8, padding: '3px 8px', fontSize: 11.5,
                        fontWeight: 700, color: C.navy,
                      }}
                    >
                      {cur}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Mode selection radio */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>
                IMPORT STRATEGY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  onClick={() => setImportMode('merge')}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: importMode === 'merge' ? `${C.navy}0D` : C.surface,
                    border: `1.5px solid ${importMode === 'merge' ? C.navy : C.line}`,
                    borderRadius: 12, padding: '10px 12px', cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    style={{ marginTop: 2, accentColor: C.navy }}
                  />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: C.heading }}>
                      Merge & Append (Recommended)
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                      Adds new entries and keeps existing transactions. Skips exact duplicate records.
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setImportMode('replace')}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: importMode === 'replace' ? '#B23A340F' : C.surface,
                    border: `1.5px solid ${importMode === 'replace' ? '#B23A34' : C.line}`,
                    borderRadius: 12, padding: '10px 12px', cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    style={{ marginTop: 2, accentColor: '#B23A34' }}
                  />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: importMode === 'replace' ? '#B23A34' : C.heading }}>
                      Replace & Overwrite Workspace
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                      Wipes current workspace entries and replaces them with this uploaded sheet.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick preview list of first 3 rows */}
            {parsedData.entries.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>
                  SAMPLE PREVIEW (FIRST {Math.min(3, parsedData.entries.length)} ROWS)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {parsedData.entries.slice(0, 3).map((e, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 10px', background: C.ice, borderRadius: 8, fontSize: 11.5,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase',
                          padding: '1px 5px', borderRadius: 4, background: C.surface, color: C.navy,
                        }}>
                          {e.type}
                        </span>
                        <span style={{ color: C.muted }}>{e.date}</span>
                        <span style={{ fontWeight: 600, color: C.heading }}>{e.category || e.note || 'Entry'}</span>
                      </div>
                      <div style={{ fontFamily: MONO, fontWeight: 700, color: C.heading }}>
                        {fmtMoney(e.amount, e.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setStep('upload')}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${C.line}`,
                  background: C.surface, color: C.heading, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                style={{
                  flex: 1.5, padding: '12px', borderRadius: 12, border: 'none',
                  background: importMode === 'replace' ? '#B23A34' : C.navy, color: '#fff',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 7,
                  boxShadow: '0 4px 14px rgba(20,17,13,0.18)',
                }}
              >
                <Upload size={15} />
                <span>Confirm & Import Data</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: IMPORTING SPINNER                                    */}
        {/* ============================================================ */}
        {step === 'importing' && (
          <div style={{ textAlign: 'center', padding: '24px 8px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: `${C.navy}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <RefreshCw size={28} color={C.navy} style={{ animation: 'vlfSpin 1s linear infinite' }} />
            </div>
            <h3 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 800, color: C.heading, margin: '0 0 6px' }}>
              Importing to Vaultify…
            </h3>
            <p style={{ fontSize: 12.5, color: C.muted, margin: 0 }}>
              Syncing transactions and reminders into your secure workspace database.
            </p>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 5: SUCCESS CONFIRMATION                                 */}
        {/* ============================================================ */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', background: '#1E9E6418',
              border: '2px solid #1E9E6444',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
              animation: 'vlfPop .45s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <CheckCircle2 size={34} color="#1E9E64" strokeWidth={2.5} />
            </div>

            <h3 style={{
              fontFamily: SERIF, fontSize: 19, fontWeight: 800, color: '#1E9E64',
              textAlign: 'center', margin: '0 0 6px',
            }}>
              Data Imported Successfully
            </h3>

            <p style={{
              fontSize: 12.5, color: C.muted, textAlign: 'center', margin: '0 0 14px', lineHeight: 1.45,
            }}>
              <strong>{importSummary?.entriesCount || 0} transactions</strong>
              {importSummary?.remindersCount > 0 && ` and ${importSummary.remindersCount} reminders`} have been loaded and synchronized with your workspace.
            </p>

            {/* Disclaimer and status card */}
            <div style={{
              background: C.ice, border: `1px solid ${C.line}`, borderRadius: 12,
              padding: '12px 14px', marginBottom: 16, textAlign: 'left', fontSize: 11.5,
              color: C.navySoft, lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 800, color: C.heading, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>ℹ️</span>
                <span>Database Sync & Availability:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li style={{ marginBottom: 3 }}>All calculations, monthly summaries, and Net Worth values have been updated instantly.</li>
                <li>Your data is securely stored and available across all your sessions.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: C.navy, color: '#fff', fontWeight: 700, fontSize: 13.5,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 7, boxShadow: '0 4px 14px rgba(20,17,13,0.2)',
              }}
            >
              <span>Done & View Vault</span>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Delete Account Modal (Requires Password 2 Times)                   */
/* ------------------------------------------------------------------ */

function DeleteAccountModal({ open, onClose, onConfirmDelete, userEmail }) {
  const C = useColors();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletedSuccess, setDeletedSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmPassword('');
      setShowPw1(false);
      setShowPw2(false);
      setError('');
      setLoading(false);
      setDeletedSuccess(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password || !confirmPassword) {
      setError('Please enter your password in both fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter carefully.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });
      if (authErr) {
        setLoading(false);
        setError('Incorrect password. Verification failed.');
        return;
      }

      setDeletedSuccess(true);
      setLoading(false);

      // Perform deletion after showing the success screen
      setTimeout(async () => {
        try {
          await onConfirmDelete();
        } catch (err) {
          console.error(err);
        }
      }, 1600);
    } catch (err) {
      setLoading(false);
      setError(err?.message || 'Failed to delete account. Please try again.');
    }
  };

  const handleManualProceed = async () => {
    try {
      await onConfirmDelete();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 85,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,10,10,0.75)', backdropFilter: 'blur(6px)', padding: 16,
      }}
      onClick={deletedSuccess ? handleManualProceed : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface, borderRadius: 22, padding: '24px 22px',
          width: '100%', maxWidth: 410, fontFamily: SANS,
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          border: deletedSuccess ? '1.5px solid #1E9E6466' : '1.5px solid #B23A3444',
          transition: 'all .25s ease',
        }}
      >
        {deletedSuccess ? (
          /* Dedicated Account Deleted Successfully Screen */
          <div style={{ textAlign: 'center', padding: '6px 4px 4px' }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', background: '#1E9E6418',
              border: '2px solid #1E9E6444',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
              animation: 'vlfPop .45s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <CheckCircle2 size={34} color="#1E9E64" strokeWidth={2.5} />
            </div>

            <h3 style={{
              fontFamily: SERIF, fontSize: 19, fontWeight: 800, color: '#1E9E64',
              textAlign: 'center', margin: '0 0 6px',
            }}>
              Your Account Has Been Deleted Successfully
            </h3>

            <p style={{
              fontSize: 12.5, color: C.muted, textAlign: 'center', margin: '0 0 12px', lineHeight: 1.45,
            }}>
              All your transaction records, active currencies, workspaces, reminders, and user settings have been completely wiped.
            </p>

            {/* English Disclaimer & Next Steps Box */}
            <div style={{
              background: C.ice,
              border: `1px solid ${C.line}`,
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 16,
              textAlign: 'left',
              fontSize: 11.5,
              color: C.body,
              lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 800, color: C.heading, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span>ℹ️</span>
                <span>Important Disclaimer & Next Steps:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: C.body }}>
                <li style={{ marginBottom: 4 }}>
                  <strong>Zero Data Retention:</strong> All previous transactions, custom assets, and portfolio history are permanently erased and cannot be restored.
                </li>
                <li style={{ marginBottom: 4 }}>
                  <strong>Create a New Account:</strong> Your email address is now released. You can use it anytime to register a clean, brand new account.
                </li>
                <li>
                  <strong>Fresh Start:</strong> Signing up again will take you through a fresh onboarding setup with your preferred base currencies.
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleManualProceed}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                border: 'none',
                background: C.navy,
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(20,17,13,0.2)',
              }}
            >
              <span>Return to Sign In</span>
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: 'rgba(178,58,52,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
            }}>
              <AlertTriangle size={26} color="#B23A34" />
            </div>

            <h3 style={{
              fontFamily: SERIF, fontSize: 19, fontWeight: 800, color: '#B23A34',
              textAlign: 'center', margin: '0 0 6px',
            }}>
              Delete Account Permanently
            </h3>

            <p style={{
              fontSize: 12.5, color: C.muted, textAlign: 'center', margin: '0 0 14px', lineHeight: 1.45,
            }}>
              This action <strong>cannot be undone</strong>. All your workspaces, transaction records, currencies, reminders, and settings will be permanently wiped.
            </p>

            <div style={{
              background: '#B23A340F', border: '1px solid #B23A3433', borderRadius: 10,
              padding: '10px 12px', marginBottom: 16, fontSize: 11.5, color: '#B23A34', fontWeight: 600,
            }}>
              🔒 For maximum security, enter your current account password <strong>twice</strong> to authorize permanent deletion.
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: C.heading, display: 'block', marginBottom: 4 }}>
                  Enter Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw1 ? 'text' : 'password'}
                    required
                    placeholder="Enter account password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%', border: `1px solid ${C.line}`, borderRadius: 10,
                      padding: '10px 38px 10px 12px', fontSize: 13.5, background: C.ice,
                      color: C.heading, boxSizing: 'border-box', outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw1((v) => !v)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex',
                    }}
                  >
                    {showPw1 ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: C.heading, display: 'block', marginBottom: 4 }}>
                  Re-enter Password to Confirm
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw2 ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%', border: `1px solid ${C.line}`, borderRadius: 10,
                      padding: '10px 38px 10px 12px', fontSize: 13.5, background: C.ice,
                      color: C.heading, boxSizing: 'border-box', outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw2((v) => !v)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex',
                    }}
                  >
                    {showPw2 ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ fontSize: 12, color: '#B23A34', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${C.line}`,
                    background: C.surface, color: C.heading, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1.2, padding: '12px', borderRadius: 12, border: 'none',
                    background: '#B23A34', color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', opacity: loading ? 0.7 : 1, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} style={{ animation: 'vlfSpin 1s linear infinite' }} />
                      <span>Deleting…</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Delete Permanently</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profile Sheet (Dedicated Profile & Avatar Tab)                     */
/* ------------------------------------------------------------------ */

function ProfileSheet({
  open,
  onClose,
  profile,
  userEmail,
  onUpdateProfile,
  onOpenSettings,
}) {
  const C = useColors();
  const [name, setName] = useState(profile?.name || 'Personal Vault');
  const [adjustingImageSrc, setAdjustingImageSrc] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setName(profile?.name || 'Personal Vault');
    }
  }, [open, profile]);

  if (!open) return null;

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Please select an image smaller than 8MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      if (base64) {
        setAdjustingImageSrc(base64);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    if (onUpdateProfile) {
      onUpdateProfile({ ...profile, avatar: null });
    }
  };

  const handleSaveName = (e) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (onUpdateProfile) {
      onUpdateProfile({ ...profile, name: clean });
    }
  };

  const initials = (name || 'Vault').charAt(0).toUpperCase();

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'flex-end',
        background: 'rgba(26,23,18,0.5)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface, width: '100%', maxWidth: 480, margin: '0 auto',
          borderRadius: '24px 24px 0 0', maxHeight: '90vh', overflowY: 'auto',
          padding: '18px 18px 32px', fontFamily: SANS,
          boxShadow: '0 -10px 34px rgba(26,23,18,0.28)',
        }}
      >
        <div style={{ width: 40, height: 4, background: C.line, borderRadius: 2, margin: '0 auto 16px' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 21, color: C.heading, margin: 0, fontWeight: 700 }}>
              Profile
            </h2>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: `${C.navy}14`, color: C.navy }}>
              {profile?.name || 'Vault'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: C.ice, border: 'none', borderRadius: '50%',
              width: 32, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={16} color={C.heading} />
          </button>
        </div>

        {/* Profile Picture Card */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '20px 16px', background: C.ice, borderRadius: 18,
          border: `1px solid ${C.line}`, marginBottom: 20,
        }}>
          <div style={{
            position: 'relative', width: 96, height: 96, borderRadius: '50%',
            overflow: 'hidden', background: `linear-gradient(135deg, ${C.navy}, ${C.navySoft})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 32, fontWeight: 800,
            border: `3px solid ${C.silver}`, boxShadow: '0 8px 24px rgba(20,17,13,0.15)',
            marginBottom: 14,
          }}>
            {profile?.avatar ? (
              <img src={profile.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                borderRadius: 12, border: 'none', background: C.navy, color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(20,17,13,0.12)',
              }}
            >
              <Camera size={15} /> Upload Photo
            </button>

            {profile?.avatar && (
              <button
                type="button"
                onClick={() => setAdjustingImageSrc(profile.avatar)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
                  borderRadius: 12, border: `1px solid ${C.line}`, background: C.surface,
                  color: C.navySoft, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <Crop size={14} /> Adjust / Zoom
              </button>
            )}

            {profile?.avatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
                  borderRadius: 12, border: '1px solid #B23A3433', background: C.surface,
                  color: '#B23A34', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
        </div>

        {/* Profile Name */}
        <SectionLabel>Profile / Vault Name</SectionLabel>
        <form onSubmit={handleSaveName} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Personal Vault"
            style={{
              flex: 1, border: `1px solid ${C.line}`, borderRadius: 12,
              padding: '11px 14px', fontSize: 13.5, background: C.surface,
              color: C.navySoft, outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '11px 18px', borderRadius: 12, border: 'none',
              background: C.navy, color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Update
          </button>
        </form>

        {/* Account Email Info */}
        <SectionLabel>Account Security & Email</SectionLabel>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderRadius: 14, background: C.ice,
          border: `1px solid ${C.line}`, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mail size={16} color={C.steel} />
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Registered Email</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.heading }}>{userEmail || 'Authenticated User'}</div>
            </div>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
            background: 'rgba(30,158,100,0.12)', color: '#1E9E64',
          }}>
            Verified
          </span>
        </div>

        {/* English Disclaimer & Profile Capabilities Guide */}
        <div style={{
          background: `${C.navy}08`,
          border: `1px solid ${C.navy}20`,
          borderRadius: 14,
          padding: '13px 15px',
          marginBottom: 20,
          textAlign: 'left',
          fontSize: 12,
          color: C.body,
          lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 800, color: C.navy, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
            <ShieldCheck size={16} color={C.navy} />
            <span>Profile & Account Capabilities (Disclaimer)</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: C.body }}>
            <li style={{ marginBottom: 4 }}>
              <strong>Custom Avatar & Visuals:</strong> Upload any photo, adjust zoom scale, and drag to reposition your circle avatar across the dashboard.
            </li>
            <li style={{ marginBottom: 4 }}>
              <strong>Vault Personalization:</strong> Rename your workspace to distinguish between personal, business, or travel vaults.
            </li>
            <li style={{ marginBottom: 4 }}>
              <strong>Data Privacy & Protection:</strong> All your financial balances, transactions, and exchange records are isolated and encrypted per user ID.
            </li>
            <li>
              <strong>Advanced Settings & Danger Zone:</strong> Use Vault Settings to manage enabled currencies, budget limits, theme, 3-day trash recovery, or permanent account deletion.
            </li>
          </ul>
        </div>

        {/* Link to Settings */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="vlf-hover"
            style={{
              width: '100%', padding: '13px', borderRadius: 14,
              border: `1px solid ${C.line}`, background: C.surface,
              color: C.navy, fontSize: 13.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, cursor: 'pointer',
            }}
          >
            <Settings size={16} />
            <span>Open Vault Settings</span>
          </button>
        )}

        {/* Avatar Crop / Adjust Modal */}
        <AvatarAdjustModal
          open={!!adjustingImageSrc}
          imageSrc={adjustingImageSrc}
          onClose={() => setAdjustingImageSrc(null)}
          onSave={(adjustedBase64) => {
            if (onUpdateProfile) {
              onUpdateProfile({ ...profile, avatar: adjustedBase64 });
            }
          }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Notifications & Alerts Sheet                                       */
/* ------------------------------------------------------------------ */

function NotificationsSheet({
  open,
  onClose,
  entries = [],
  settings = {},
  reminders = [],
  trashEntries = [],
  profile,
  onOpenSettings,
  onOpenReminders,
  onRefreshRates,
  ratesLoading = false,
  userEmail,
}) {
  const C = useColors();
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' | 'preferences'
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem('vaultify_read_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [notifPreferences, setNotifPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('vaultify_notif_prefs');
      return saved ? JSON.parse(saved) : {
        budgetAlerts: true,
        reminderAlerts: true,
        rateUpdates: true,
        trashAlerts: true,
      };
    } catch (e) {
      return { budgetAlerts: true, reminderAlerts: true, rateUpdates: true, trashAlerts: true };
    }
  });

  const savePrefs = (next) => {
    setNotifPreferences(next);
    try {
      localStorage.setItem('vaultify_notif_prefs', JSON.stringify(next));
    } catch (e) {}
  };

  // Compile dynamic system alerts
  const notifications = useMemo(() => {
    const list = [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // 1. Budget limits alert
    if (notifPreferences.budgetAlerts && settings.budgetLimits) {
      const period = settings.budgetPeriod || settings.budgetLimits._period || 'week';
      const periodName = period === 'week' ? 'Weekly' : period === 'month' ? 'Monthly' : 'Total';
      
      const relevant = (entries || []).filter((e) => {
        if (e.type !== 'expense') return false;
        if (!e.date) return false;
        if (period === 'total') return true;
        if (period === 'month') return e.date.startsWith(todayStr.slice(0, 7));
        if (period === 'week') {
          const d = new Date(e.date);
          const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
          return diffDays >= 0 && diffDays <= 7;
        }
        return true;
      });

      const spentByCurr = {};
      relevant.forEach((e) => {
        spentByCurr[e.currency] = (spentByCurr[e.currency] || 0) + Number(e.amount || 0);
      });

      Object.entries(settings.budgetLimits).forEach(([curr, limitVal]) => {
        if (curr === '_period' || !limitVal || isNaN(Number(limitVal))) return;
        const limit = Number(limitVal);
        const spent = spentByCurr[curr] || 0;
        if (spent >= limit) {
          list.push({
            id: `limit_exceeded_${curr}`,
            type: 'danger',
            title: `Budget Exceeded (${curr})`,
            description: `You've spent ${fmtMoney(spent, curr)} (${Math.round((spent / limit) * 100)}% of your ${periodName} ${fmtMoney(limit, curr)} budget).`,
            actionLabel: 'Adjust Limits',
            onAction: () => { onClose(); if (onOpenSettings) onOpenSettings('general'); },
            time: 'Active Alert',
          });
        } else if (spent >= limit * 0.8) {
          list.push({
            id: `limit_near_${curr}`,
            type: 'warning',
            title: `Near Budget Cap (${curr})`,
            description: `You've utilized ${Math.round((spent / limit) * 100)}% of your ${periodName} limit (${fmtMoney(spent, curr)} of ${fmtMoney(limit, curr)}).`,
            actionLabel: 'View Limits',
            onAction: () => { onClose(); if (onOpenSettings) onOpenSettings('general'); },
            time: 'Active Alert',
          });
        }
      });
    }

    // 2. Upcoming / Due Reminders
    if (notifPreferences.reminderAlerts && reminders && reminders.length > 0) {
      reminders.forEach((r) => {
        if (r.paid) return;
        if (!r.dueDate) return;
        const diffMs = new Date(r.dueDate).getTime() - new Date(todayStr).getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 3600 * 24));
        if (diffDays < 0) {
          list.push({
            id: `reminder_overdue_${r.id}`,
            type: 'danger',
            title: `Overdue Bill: ${r.title}`,
            description: `${fmtMoney(r.amount, r.currency)} was due on ${r.dueDate} (${Math.abs(diffDays)} days ago).`,
            actionLabel: 'Pay / Mark Paid',
            onAction: () => { onClose(); if (onOpenReminders) onOpenReminders(); },
            time: 'Overdue',
          });
        } else if (diffDays <= 3) {
          list.push({
            id: `reminder_upcoming_${r.id}`,
            type: 'warning',
            title: `Bill Due ${diffDays === 0 ? 'Today' : `in ${diffDays} day${diffDays > 1 ? 's' : ''}`}: ${r.title}`,
            description: `${fmtMoney(r.amount, r.currency)} due on ${r.dueDate}.`,
            actionLabel: 'View Reminder',
            onAction: () => { onClose(); if (onOpenReminders) onOpenReminders(); },
            time: diffDays === 0 ? 'Due Today' : `In ${diffDays}d`,
          });
        }
      });
    }

    // 3. Live exchange rates
    if (notifPreferences.rateUpdates) {
      const lastFetched = settings.ratesFetchedAt ? timeAgo(settings.ratesFetchedAt) : 'recently';
      const usdRate = settings.rates?.USD ? fmtMoney(settings.rates.USD, 'PKR') : 'Rs 280';
      list.push({
        id: 'rates_status',
        type: 'info',
        title: 'Exchange Rates Active',
        description: `Market rates synced (1 USD = ${usdRate}). Net worth calculations are live.`,
        actionLabel: 'Refresh Rates',
        onAction: () => { if (onRefreshRates) onRefreshRates(); },
        time: lastFetched,
      });
    }

    // 4. Trash status
    if (notifPreferences.trashAlerts && trashEntries && trashEntries.length > 0) {
      list.push({
        id: 'trash_notice',
        type: 'neutral',
        title: `Trash Retention (${trashEntries.length} Items)`,
        description: `You have ${trashEntries.length} deleted items. Entries are restorable for 3 days before auto-purge.`,
        actionLabel: 'Open Trash',
        onAction: () => { onClose(); if (onOpenSettings) onOpenSettings('trash'); },
        time: '3-Day Retention',
      });
    }

    // 5. Workspace status
    list.push({
      id: 'workspace_info',
      type: 'neutral',
      title: `Workspace: ${profile?.name || 'Personal Vault'}`,
      description: `${(profile?.enabledCurrencies || CURRENCIES).length} currencies active in this portfolio view.`,
      actionLabel: 'Manage Workspaces',
      onAction: () => { onClose(); if (onOpenSettings) onOpenSettings('workspace'); },
      time: 'Connected',
    });

    return list;
  }, [entries, settings, reminders, trashEntries, profile, notifPreferences, onClose, onOpenSettings, onOpenReminders, onRefreshRates]);

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  const markAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(allIds);
    try {
      localStorage.setItem('vaultify_read_notifications', JSON.stringify(allIds));
    } catch (e) {}
  };

  const markSingleRead = (id) => {
    if (!readIds.includes(id)) {
      const next = [...readIds, id];
      setReadIds(next);
      try {
        localStorage.setItem('vaultify_read_notifications', JSON.stringify(next));
      } catch (e) {}
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', alignItems: 'flex-end', background: 'rgba(26,23,18,0.5)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, width: '100%', maxWidth: 500, margin: '0 auto', borderRadius: '24px 24px 0 0',
        maxHeight: '90vh', overflowY: 'auto', padding: '18px 18px 32px', fontFamily: SANS,
        boxShadow: '0 -10px 34px rgba(26,23,18,0.28)',
      }}>
        <div style={{ width: 40, height: 4, background: C.line, borderRadius: 2, margin: '0 auto 16px' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: `${C.navy}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.navy,
            }}>
              <Bell size={18} />
            </div>
            <div>
              <h2 style={{ fontFamily: SERIF, fontSize: 20, color: C.heading, margin: 0, fontWeight: 700 }}>
                Notifications & Alerts
              </h2>
            </div>
            {unreadCount > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 8, background: C.navy, color: '#fff' }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: C.ice, border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={16} color={C.heading} />
          </button>
        </div>

        {/* Tab switch: Feed vs Preferences */}
        <div style={{ display: 'flex', gap: 6, background: C.ice, padding: 4, borderRadius: 12, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 9, border: 'none',
              background: activeTab === 'alerts' ? C.surface : 'transparent',
              color: activeTab === 'alerts' ? C.heading : C.muted,
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              boxShadow: activeTab === 'alerts' ? '0 1px 4px rgba(20,17,13,0.08)' : 'none',
            }}
          >
            Alerts & Activity ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 9, border: 'none',
              background: activeTab === 'preferences' ? C.surface : 'transparent',
              color: activeTab === 'preferences' ? C.heading : C.muted,
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              boxShadow: activeTab === 'preferences' ? '0 1px 4px rgba(20,17,13,0.08)' : 'none',
            }}
          >
            Preferences
          </button>
        </div>

        {/* TAB 1: ALERTS FEED */}
        {activeTab === 'alerts' && (
          <div>
            {notifications.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Recent Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    style={{ background: 'none', border: 'none', color: C.steel, fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}
                  >
                    Mark all as read
                  </button>
                )}
              </div>
            )}

            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', background: C.ice, borderRadius: 16, border: `1px dashed ${C.line}` }}>
                <CheckCircle2 size={32} color={C.steel} style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: C.heading }}>All caught up!</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>No pending notifications or budget alerts.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notifications.map((n) => {
                  const isRead = readIds.includes(n.id);
                  const isDanger = n.type === 'danger';
                  const isWarning = n.type === 'warning';
                  const isInfo = n.type === 'info';

                  const badgeBg = isDanger ? '#B23A3414' : isWarning ? '#D9770614' : isInfo ? `${C.steel}14` : `${C.navy}0A`;
                  const badgeColor = isDanger ? '#B23A34' : isWarning ? '#D97706' : isInfo ? C.steel : C.navySoft;
                  const borderColor = isDanger ? '#B23A3444' : isWarning ? '#D9770644' : C.line;

                  return (
                    <div
                      key={n.id}
                      onClick={() => markSingleRead(n.id)}
                      style={{
                        padding: '13px 14px',
                        borderRadius: 14,
                        border: `1.5px solid ${borderColor}`,
                        background: !isRead ? (isDanger ? '#B23A3408' : `${C.navy}05`) : C.surface,
                        transition: 'all .15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {!isRead && (
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isDanger ? '#B23A34' : C.navy, flexShrink: 0 }} />
                          )}
                          <span style={{ fontSize: 13, fontWeight: 800, color: C.heading }}>
                            {n.title}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
                          background: badgeBg, color: badgeColor, flexShrink: 0,
                        }}>
                          {n.time}
                        </span>
                      </div>

                      <p style={{ fontSize: 12, color: C.muted, margin: '0 0 10px', lineHeight: 1.45 }}>
                        {n.description}
                      </p>

                      {n.actionLabel && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markSingleRead(n.id);
                              if (n.onAction) n.onAction();
                            }}
                            style={{
                              padding: '5px 11px', borderRadius: 8,
                              border: `1px solid ${badgeColor}`,
                              background: badgeBg,
                              color: badgeColor,
                              fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            {n.actionLabel} →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NOTIFICATION PREFERENCES */}
        {activeTab === 'preferences' && (
          <div>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 0, marginBottom: 14 }}>
              Customize which alerts and reminders are triggered automatically in Vaultify.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  key: 'budgetAlerts',
                  label: 'Budget & Spending Warnings',
                  desc: 'Notify when expenses cross 80% or exceed your set spending limits.',
                },
                {
                  key: 'reminderAlerts',
                  label: 'Bill & Reminder Due Dates',
                  desc: 'Alert for bills and payments due today or within 3 days.',
                },
                {
                  key: 'rateUpdates',
                  label: 'Exchange Rate Synced Alerts',
                  desc: 'Show status updates when live currency conversion rates are refreshed.',
                },
                {
                  key: 'trashAlerts',
                  label: 'Trash Retention Notices',
                  desc: 'Notify about items pending auto-purge in the 3-day trash window.',
                },
              ].map((item) => {
                const isEnabled = !!notifPreferences[item.key];
                return (
                  <div
                    key={item.key}
                    onClick={() => savePrefs({ ...notifPreferences, [item.key]: !isEnabled })}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px', borderRadius: 14,
                      border: `1.5px solid ${isEnabled ? C.navy : C.line}`,
                      background: isEnabled ? `${C.navy}08` : C.surface,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.heading, marginBottom: 2 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.35 }}>
                        {item.desc}
                      </div>
                    </div>

                    {/* Switch Toggle */}
                    <div style={{
                      width: 42, height: 24, borderRadius: 12,
                      background: isEnabled ? C.navy : C.line,
                      position: 'relative', transition: 'background .2s ease', flexShrink: 0,
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 3,
                        left: isEnabled ? 21 : 3,
                        transition: 'left .2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings Sheet (Refactored with Category Dropdown & Pro Workspace) */
/* ------------------------------------------------------------------ */

function SettingsSheet({
  open,
  onClose,
  settings,
  onSave,
  onSignOut,
  ratesLoading,
  onRefreshRates,
  theme,
  onThemeChange,
  userEmail,
  entries,
  onClearMonth,
  onClearAll,
  onOpenDeleteAccount,
  profile,
  profiles = [],
  onUpdateProfile,
  onCreateProfile,
  onDeleteProfile,
  onSwitchProfile,
  trashEntries = [],
  onRestoreTrash,
  onDeleteTrashPermanent,
  onEmptyTrash,
  initialTab = 'workspace',
  onOpenImport,
}) {
  const C = useColors();
  const [activeTab, setActiveTab] = useState(initialTab || 'workspace');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [limits, setLimits] = useState({});
  const [budgetPeriod, setBudgetPeriod] = useState(settings.budgetPeriod || 'week');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwStatus, setPwStatus] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // Workspace creation state
  const [enabledCurrencies, setEnabledCurrencies] = useState(profile?.enabledCurrencies || CURRENCIES);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceCurrencies, setNewWorkspaceCurrencies] = useState([...CURRENCIES]);
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);

  const WORKSPACE_TEMPLATES = [
    { name: 'Business Vault', icon: '💼', desc: 'Invoices & clients' },
    { name: 'Personal Vault', icon: '🏦', desc: 'Daily accounts' },
    { name: 'Crypto Portfolio', icon: '🪙', desc: 'Digital assets' },
    { name: 'Travel & Trips', icon: '✈️', desc: 'Foreign currency' },
    { name: 'Family & Home', icon: '🏠', desc: 'Household budget' },
    { name: 'Freelance & Gigs', icon: '💻', desc: 'Contract revenues' },
  ];

  useEffect(() => {
    if (open) {
      setLimits({ ...settings.budgetLimits });
      setBudgetPeriod(settings.budgetPeriod || settings.budgetLimits?._period || 'week');
      setNewPw(''); setConfirmPw(''); setPwStatus('');
      setEnabledCurrencies(profile?.enabledCurrencies || CURRENCIES);
      setShowAddWorkspace(false);
      setNewWorkspaceName('');
      setNewWorkspaceCurrencies([...CURRENCIES]);
      setDropdownOpen(false);
      if (initialTab) setActiveTab(initialTab);
    }
  }, [open, settings, profile, initialTab]);

  const months = useMemo(() => {
    const set = new Set((entries || []).map((e) => monthKey(e.date)));
    return Array.from(set).sort().reverse();
  }, [entries]);

  // Filter trash to only entries deleted in the last 3 days
  const validTrashEntries = useMemo(() => {
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return (trashEntries || []).filter((e) => {
      const delTime = e.deletedAtMs || (e.deletedAt ? new Date(e.deletedAt).getTime() : now);
      return now - delTime <= THREE_DAYS_MS;
    }).sort((a, b) => {
      const timeA = a.deletedAtMs || (a.deletedAt ? new Date(a.deletedAt).getTime() : 0);
      const timeB = b.deletedAtMs || (b.deletedAt ? new Date(b.deletedAt).getTime() : 0);
      return timeB - timeA;
    });
  }, [trashEntries]);

  if (!open) return null;

  const handleToggleCurrency = (c) => {
    let next;
    if (enabledCurrencies.includes(c)) {
      if (enabledCurrencies.length <= 1) {
        alert('You must keep at least one currency enabled.');
        return;
      }
      next = enabledCurrencies.filter((x) => x !== c);
    } else {
      next = [...enabledCurrencies, c];
    }
    setEnabledCurrencies(next);
    if (profile && onUpdateProfile) {
      onUpdateProfile({ ...profile, enabledCurrencies: next });
    }
  };

  const handleToggleNewWorkspaceCurrency = (c) => {
    if (newWorkspaceCurrencies.includes(c)) {
      if (newWorkspaceCurrencies.length <= 1) return;
      setNewWorkspaceCurrencies((prev) => prev.filter((x) => x !== c));
    } else {
      setNewWorkspaceCurrencies((prev) => [...prev, c]);
    }
  };

  const handleCreateWorkspaceSubmit = (e) => {
    e.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name) return;
    if (onCreateProfile) {
      onCreateProfile(name, newWorkspaceCurrencies);
    }
    setNewWorkspaceName('');
    setNewWorkspaceCurrencies([...CURRENCIES]);
    setShowAddWorkspace(false);
  };

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

  const tabs = [
    {
      id: 'workspace',
      label: 'Workspaces & Currencies',
      subtitle: 'Manage portfolios, currencies & isolation',
      icon: Sliders,
      badge: `${enabledCurrencies.length} Active`,
    },
    {
      id: 'trash',
      label: 'Trash & Redo History',
      subtitle: 'Restore deleted items (Retained 3 days)',
      icon: Trash2,
      badge: validTrashEntries.length > 0 ? `${validTrashEntries.length} Items` : null,
      badgeColor: '#B23A34',
    },
    {
      id: 'general',
      label: 'General & Limits',
      subtitle: 'Appearance theme, budget limits & live rates',
      icon: Settings,
    },
    {
      id: 'security',
      label: 'Security & Danger Zone',
      subtitle: 'Password, backup sheets & account deletion',
      icon: ShieldCheck,
    },
  ];

  const currentTabObj = tabs.find((t) => t.id === activeTab) || tabs[0];
  const CurrentIcon = currentTabObj.icon;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', background: 'rgba(26,23,18,0.5)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, width: '100%', maxWidth: 500, margin: '0 auto', borderRadius: '24px 24px 0 0',
        maxHeight: '92vh', overflowY: 'auto', padding: '18px 18px 32px', fontFamily: SANS,
        boxShadow: '0 -10px 34px rgba(26,23,18,0.28)',
      }}>
        <div style={{ width: 40, height: 4, background: C.line, borderRadius: 2, margin: '0 auto 16px' }} />
        
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 21, color: C.heading, margin: 0, fontWeight: 700 }}>Settings</h2>
            {profile && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: `${C.navy}14`, color: C.navy }}>
                {profile.name}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: C.ice, border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={16} color={C.heading} />
          </button>
        </div>

        {userEmail && <p style={{ fontSize: 12, color: C.muted, marginTop: -6, marginBottom: 14 }}>Account: {userEmail}</p>}

        {/* ============================================================ */}
        {/* REFACTORED SETTINGS CATEGORY SELECTOR (DROPDOWN)             */}
        {/* ============================================================ */}
        <div style={{ position: 'relative', marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 14,
              border: `1.5px solid ${dropdownOpen ? C.navy : C.line}`,
              background: dropdownOpen ? `${C.navy}08` : C.surface,
              boxShadow: '0 2px 8px rgba(20,17,13,0.04)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all .15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: C.navy, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <CurrentIcon size={18} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: C.heading, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>{currentTabObj.label}</span>
                  {currentTabObj.badge && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
                      background: currentTabObj.badgeColor ? `${currentTabObj.badgeColor}18` : `${C.navy}14`,
                      color: currentTabObj.badgeColor || C.navy,
                    }}>
                      {currentTabObj.badge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentTabObj.subtitle}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.steel }}>Change</span>
              <ChevronDown size={16} color={C.steel} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
            </div>
          </button>

          {/* Dropdown Menu Options */}
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                zIndex: 60,
                background: C.surface,
                border: `1.5px solid ${C.navy}33`,
                borderRadius: 16,
                padding: '6px',
                boxShadow: '0 12px 34px rgba(20,17,13,0.18)',
              }}
            >
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(t.id);
                      setDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: active ? `1.5px solid ${C.navy}` : '1.5px solid transparent',
                      background: active ? `${C.navy}0E` : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginBottom: 3,
                      transition: 'background .15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: active ? C.navy : C.ice,
                        color: active ? '#fff' : C.navySoft,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon size={16} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: active ? 800 : 700, color: active ? C.navy : C.heading, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{t.label}</span>
                          {t.badge && (
                            <span style={{
                              fontSize: 9.5, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                              background: t.badgeColor ? `${t.badgeColor}18` : `${C.navy}14`,
                              color: t.badgeColor || C.navy,
                            }}>
                              {t.badge}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>
                          {t.subtitle}
                        </div>
                      </div>
                    </div>
                    {active && <Check size={16} color={C.steel} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* TAB 1: WORKSPACE & CURRENCIES ON/OFF TOGGLE                  */}
        {/* ============================================================ */}
        {activeTab === 'workspace' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <SectionLabel>Workspaces & Portfolios</SectionLabel>
              <button
                type="button"
                onClick={() => setShowAddWorkspace((v) => !v)}
                style={{
                  background: showAddWorkspace ? `${C.navy}12` : C.navy,
                  border: 'none',
                  color: showAddWorkspace ? C.navy : '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all .15s ease',
                }}
              >
                <FolderPlus size={13} /> {showAddWorkspace ? 'Cancel' : '+ New Workspace'}
              </button>
            </div>
            
            <p style={{ fontSize: 12, color: C.muted, marginTop: -2, marginBottom: 14, lineHeight: 1.45 }}>
              Each workspace maintains its own enabled currencies, isolated accounts, and customized portfolio view.
            </p>

            {/* UPGRADED: Create New Workspace Card Form */}
            {showAddWorkspace && (
              <form onSubmit={handleCreateWorkspaceSubmit} style={{
                background: C.ice,
                border: `1.5px solid ${C.navy}33`,
                borderRadius: 16,
                padding: '16px 14px',
                marginBottom: 18,
                boxShadow: '0 4px 16px rgba(20,17,13,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <Sparkles size={16} color={C.steel} />
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: C.heading }}>
                    Create New Workspace
                  </span>
                </div>

                {/* Preset Template Chips */}
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>
                  Quick Templates (Tap to select):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 12 }}>
                  {WORKSPACE_TEMPLATES.map((tmpl) => {
                    const isSelected = newWorkspaceName.includes(tmpl.name);
                    return (
                      <button
                        key={tmpl.name}
                        type="button"
                        onClick={() => setNewWorkspaceName(tmpl.name)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '7px 9px', borderRadius: 10,
                          border: `1px solid ${isSelected ? C.navy : C.line}`,
                          background: isSelected ? `${C.navy}12` : C.surface,
                          color: isSelected ? C.navy : C.heading,
                          fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{tmpl.icon}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tmpl.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Workspace Name Input */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.heading, marginBottom: 4 }}>
                    Workspace Name:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Business Vault, Travel 2026, Crypto"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    style={{
                      width: '100%', border: `1.5px solid ${C.line}`, borderRadius: 10,
                      padding: '10px 12px', fontSize: 13, background: C.surface, color: C.navySoft,
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Initial Enabled Currencies */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: C.heading }}>
                      Currencies Active in this Workspace:
                    </label>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: C.steel }}>
                      {newWorkspaceCurrencies.length} selected
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {CURRENCIES.map((c) => {
                      const sel = newWorkspaceCurrencies.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleToggleNewWorkspaceCurrency(c)}
                          style={{
                            padding: '5px 9px', borderRadius: 8,
                            border: `1.5px solid ${sel ? C.navy : C.line}`,
                            background: sel ? C.navy : C.surface,
                            color: sel ? '#fff' : C.muted,
                            fontSize: 11, fontWeight: 800, cursor: 'pointer',
                          }}
                        >
                          {sel ? '✓ ' : '+ '}{c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit / Cancel Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddWorkspace(false)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${C.line}`,
                      background: C.surface, color: C.muted, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newWorkspaceName.trim()}
                    style={{
                      flex: 2, padding: '10px', borderRadius: 10, border: 'none',
                      background: C.navy, color: '#fff', fontSize: 12.5, fontWeight: 800,
                      cursor: newWorkspaceName.trim() ? 'pointer' : 'not-allowed',
                      opacity: newWorkspaceName.trim() ? 1 : 0.6,
                      boxShadow: '0 2px 8px rgba(20,17,13,0.15)',
                    }}
                  >
                    Create Workspace
                  </button>
                </div>
              </form>
            )}

            {/* Workspace list cards */}
            {profiles && profiles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
                {profiles.map((p) => {
                  const isActive = p.id === profile?.id;
                  const currs = p.enabledCurrencies || CURRENCIES;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', borderRadius: 14,
                        border: `1.5px solid ${isActive ? C.navy : C.line}`,
                        background: isActive ? `${C.navy}09` : C.surface,
                        boxShadow: isActive ? '0 2px 10px rgba(20,17,13,0.06)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%', overflow: 'hidden',
                          background: `linear-gradient(135deg, ${C.navy}, ${C.navySoft})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 14, fontWeight: 800, flexShrink: 0,
                          border: `1.5px solid ${C.silver}`,
                        }}>
                          {p.avatar ? <img src={p.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name.charAt(0)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.heading, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                            {isActive && (
                              <span style={{ fontSize: 9.5, fontWeight: 800, padding: '1px 6px', borderRadius: 5, background: '#1E9E64', color: '#fff' }}>
                                Active
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                            {currs.map((c) => (
                              <span key={c} style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `${C.navy}10`, color: C.navy }}>
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => onSwitchProfile && onSwitchProfile(p.id)}
                            style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.surface, color: C.navy, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Switch
                          </button>
                        ) : null}
                        {profiles.length > 1 && !isActive && onDeleteProfile && (
                          <button
                            type="button"
                            onClick={() => onDeleteProfile(p.id)}
                            title="Delete workspace"
                            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #B23A3433', background: 'none', color: '#B23A34', cursor: 'pointer' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Divider />

            {/* CURRENCY ON/OFF TOGGLE MANAGER */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <SectionLabel>Workspace Currency Manager</SectionLabel>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${C.navy}12`, color: C.navy }}>
                {enabledCurrencies.length} / {CURRENCIES.length} Enabled
              </span>
            </div>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 0, marginBottom: 14, lineHeight: 1.45 }}>
              Turn currencies ON or OFF for <strong>{profile?.name || 'this workspace'}</strong>. Disabled currencies will be completely hidden from your home dashboard, entry sheets, currency converter, and net worth calculations.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
              {CURRENCIES.map((c) => {
                const meta = CURRENCY_META[c] || {};
                const isEnabled = enabledCurrencies.includes(c);
                return (
                  <div
                    key={c}
                    onClick={() => handleToggleCurrency(c)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '11px 14px', borderRadius: 14,
                      border: `1.5px solid ${isEnabled ? (meta.color || C.navy) : C.line}`,
                      background: isEnabled ? `${C.navy}08` : `${C.ice}aa`,
                      cursor: 'pointer', transition: 'all .15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <CoinIcon currency={c} size={32} />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: isEnabled ? C.heading : C.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span>{meta.name || c}</span>
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>({meta.cleanSymbol})</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: isEnabled ? C.steel : C.muted, fontWeight: 600 }}>
                          {isEnabled ? '● Active in workspace & dashboard' : '○ Hidden / Turned Off'}
                        </div>
                      </div>
                    </div>

                    {/* Interactive Switch Toggle */}
                    <div style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: isEnabled ? C.navy : C.line,
                      position: 'relative', transition: 'background .2s ease', flexShrink: 0,
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 3,
                        left: isEnabled ? 23 : 3,
                        transition: 'left .2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: TRASH SPACE & REDO HISTORY (LAST 3 DAYS)              */}
        {/* ============================================================ */}
        {activeTab === 'trash' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <SectionLabel>Trash Space & Redo (Last 3 Days)</SectionLabel>
              {validTrashEntries.length > 0 && (
                <button
                  type="button"
                  onClick={onEmptyTrash}
                  style={{ background: 'none', border: 'none', color: '#B23A34', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  Empty Trash
                </button>
              )}
            </div>

            <p style={{ fontSize: 12, color: C.muted, marginTop: -4, marginBottom: 14, lineHeight: 1.45 }}>
              Mistakenly deleted an entry? Deleted entries from the <strong>last 3 days</strong> are preserved here. You can redo/restore them back into your active vault or wipe them permanently.
            </p>

            {validTrashEntries.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '36px 18px', background: C.ice, borderRadius: 16,
                border: `1px dashed ${C.line}`, marginBottom: 20,
              }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${C.line}66`, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={20} color={C.muted} />
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.heading, marginBottom: 4 }}>Trash is empty</div>
                <div style={{ fontSize: 12, color: C.muted }}>No deleted entries in the last 3 days.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
                {validTrashEntries.map((e) => {
                  const typeObj = TYPES.find((t) => t.key === e.type) || TYPES[0];
                  const Icon = typeObj.icon;
                  const timeAgoStr = timeAgo(e.deletedAt);
                  return (
                    <div
                      key={e.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', borderRadius: 14,
                        border: `1px solid ${C.line}`, background: C.surface,
                        boxShadow: '0 1px 3px rgba(20,17,13,0.03)',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
                            background: `${typeObj.color}15`, color: typeObj.color,
                          }}>
                            <Icon size={11} /> {typeObj.label}
                          </span>
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
                            {e.date}
                          </span>
                          <span style={{ fontSize: 10, color: '#B23A34', fontWeight: 700, background: '#B23A3412', padding: '1px 5px', borderRadius: 4 }}>
                            Deleted {timeAgoStr}
                          </span>
                        </div>

                        <div style={{ fontSize: 13, fontWeight: 700, color: C.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.category || 'Entry'}{e.note ? ` · ${e.note}` : ''}
                        </div>

                        <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 800, color: typeObj.color, marginTop: 2 }}>
                          {fmtMoney(e.amount, e.currency)}
                        </div>
                      </div>

                      {/* Actions: Redo / Restore + Permanent Delete */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => onRestoreTrash && onRestoreTrash(e.id)}
                          title="Restore entry back into vault"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '7px 11px',
                            borderRadius: 10, border: 'none', background: C.navy, color: '#fff',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          <RotateCcw size={12} /> Redo / Restore
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteTrashPermanent && onDeleteTrashPermanent(e.id)}
                          title="Delete permanently"
                          style={{
                            padding: '7px 9px', borderRadius: 10, border: '1px solid #B23A3433',
                            background: C.ice, color: '#B23A34', cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: GENERAL & LIMITS                                      */}
        {/* ============================================================ */}
        {activeTab === 'general' && (
          <div>
            <SectionLabel>Appearance</SectionLabel>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[{ k: 'light', l: 'Light', Icon: Sun }, { k: 'dark', l: 'Dark', Icon: Moon }].map(({ k, l, Icon }) => (
                <button key={k} onClick={() => onThemeChange(k)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0',
                  borderRadius: 12, border: `1.5px solid ${theme === k ? C.navy : C.line}`, background: theme === k ? `${C.navy}12` : C.surface,
                  color: theme === k ? C.navy : C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>
                  <Icon size={15} /> {l}
                </button>
              ))}
            </div>

            <SectionLabel>Spending & Expense Limits</SectionLabel>
            <p style={{ fontSize: 12, color: C.muted, marginTop: -4, marginBottom: 10 }}>
              Set limits to alert you when expenses cross your budget.
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

            {enabledCurrencies.map((c) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 52, fontSize: 13, fontWeight: 700, color: C.navySoft }}>{c}</div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={`No ${budgetPeriod === 'week' ? 'weekly' : budgetPeriod === 'month' ? 'monthly' : 'total'} limit`}
                  value={limits[c] ? formatWithCommas(limits[c]) : ''}
                  onChange={(e) => setLimits((p) => ({ ...p, [c]: parseCleanAmount(e.target.value) }))}
                  style={{
                    flex: 1, border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 12px',
                    fontSize: 13, outline: 'none', background: C.surface, color: C.navySoft,
                  }}
                />
              </div>
            ))}

            <div style={{ height: 6 }} />
            <SectionLabel right={
              <button onClick={onRefreshRates} disabled={ratesLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: C.steel, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <RefreshCw size={12} style={{ animation: ratesLoading ? 'vlfSpin 1s linear infinite' : 'none' }} /> Refresh
              </button>
            }>Live exchange rates</SectionLabel>
            <p style={{ fontSize: 12, color: C.muted, marginTop: -4, marginBottom: 4 }}>PKR value of 1 unit — used to convert your Net Worth total.</p>
            <p style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>Last updated: {timeAgo(settings.ratesFetchedAt)}</p>
            {enabledCurrencies.filter((c) => c !== 'PKR').map((c) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 52, fontSize: 13, fontWeight: 700, color: C.navySoft }}>{c}</div>
                <div style={{ flex: 1, padding: '9px 12px', fontSize: 13, color: C.navySoft, background: C.ice, borderRadius: 10, fontFamily: MONO }}>
                  {settings.rates[c] ? fmtAmount(settings.rates[c]) : '—'}
                </div>
              </div>
            ))}
            <style>{`@keyframes vlfSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: SECURITY & DANGER ZONE                                */}
        {/* ============================================================ */}
        {activeTab === 'security' && (
          <div>
            <SectionLabel>Change password</SectionLabel>
            <input type="password" placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
              style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', marginBottom: 8, background: C.surface, color: C.navySoft, boxSizing: 'border-box' }} />
            <input type="password" placeholder="Confirm new password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', marginBottom: 8, background: C.surface, color: C.navySoft, boxSizing: 'border-box' }} />
            {pwStatus && <p style={{ fontSize: 12, color: pwStatus === 'Password updated.' ? '#39604A' : '#7A2E2E', marginBottom: 8 }}>{pwStatus}</p>}
            <button onClick={updatePassword} disabled={pwSaving || !newPw} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 12,
              border: `1px solid ${C.line}`, background: C.surface, color: C.navySoft, fontSize: 13, fontWeight: 700, opacity: (!newPw || pwSaving) ? 0.6 : 1, cursor: 'pointer',
            }}>
              <KeyRound size={14} /> {pwSaving ? 'Updating…' : 'Update password'}
            </button>

            <div style={{ height: 16 }} />
            <SectionLabel>Clear data</SectionLabel>
            <p style={{ fontSize: 12, color: C.muted, marginTop: -4, marginBottom: 12 }}>Clear a specific month, or wipe entries. This cannot be undone.</p>
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
                width: '100%', marginTop: 4, padding: '12px', borderRadius: 12, border: '1px solid #B23A34',
                background: '#B23A3412', color: '#B23A34', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                Clear all entries
              </button>
            )}

            <div style={{ height: 16 }} />
            <SectionLabel>Backup & Restore</SectionLabel>
            <p style={{ fontSize: 12, color: C.muted, marginTop: -4, marginBottom: 10 }}>
              Import external spreadsheets or previously exported Excel files into your Vaultify database.
            </p>
            <button
              type="button"
              onClick={() => {
                if (onOpenImport) onOpenImport();
              }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', borderRadius: 12,
                border: `1.5px solid ${C.navy}`, background: `${C.navy}0D`, color: C.navy, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Upload size={15} /> Import Sheet (.xlsx, .csv)
            </button>

            <div style={{ height: 20 }} />
            {/* PERMANENT ACCOUNT DELETION CARD */}
            <div style={{
              border: '1.5px solid #B23A3444', background: '#B23A3408',
              borderRadius: 16, padding: '16px 14px', marginTop: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <AlertTriangle size={18} color="#B23A34" />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#B23A34' }}>
                  Danger Zone: Delete Account
                </span>
              </div>
              <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.45, margin: '0 0 12px' }}>
                Permanently delete your user account, workspaces, all financial entries, currency configurations, and settings. Requires entering your password twice for strict verification.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (onOpenDeleteAccount) onOpenDeleteAccount();
                }}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                  background: '#B23A34', color: '#fff', fontSize: 13, fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  boxShadow: '0 3px 10px rgba(178,58,52,0.25)',
                }}
              >
                <Trash2 size={14} /> Delete Account Permanently
              </button>
            </div>
          </div>
        )}

        <div style={{ height: 20 }} />

        {/* Global Save Button */}
        <button onClick={() => {
          const cleanLimits = {};
          Object.entries(limits).forEach(([k, v]) => {
            if (k !== '_period' && v !== '' && v != null && !isNaN(Number(v))) cleanLimits[k] = Number(v);
          });
          cleanLimits._period = budgetPeriod;
          if (profile && onUpdateProfile) {
            onUpdateProfile({ ...profile, enabledCurrencies });
          }
          if (onSave) {
            onSave({ ...settings, budgetLimits: cleanLimits, budgetPeriod }, enabledCurrencies);
          }
        }} style={{ width: '100%', padding: '15px', borderRadius: 14, border: 'none', background: C.navy, color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 10, cursor: 'pointer', boxShadow: '0 4px 14px rgba(20,17,13,0.15)' }}>
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

function TotalAcrossCurrencies({ entries, settings, display, setDisplay, currencies = CURRENCIES }) {
  const C = useColors();
  const perCurrency = (currencies || CURRENCIES).map((c) => ({ currency: c, ...computeTotals(entries, c) }))
    .filter((x) => x.expense || x.income || x.saving || x.investment || x.unaccounted);
  // Exclude saving from aggregate total sum as requested by user (savings remain in individual balances)
  const totalBase = perCurrency.reduce((sum, x) => sum + toBase((x.income || 0) + (x.investment || 0) - (x.expense || 0) - (x.unaccounted || 0), x.currency, settings.rates), 0);
  const converted = fromBase(totalBase, display, settings.rates);

  // Fallback realistic daily variance if prevRates not recorded yet
  const FALLBACK_TRENDS = {
    USD: 0.24,
    EUR: 0.18,
    GBP: -0.15,
    TRY: -0.42,
    USDT: 0.24,
  };

  const trendCurrencies = (currencies || CURRENCIES).filter((c) => c !== 'PKR');

  return (
    <Card style={{ padding: 18, marginBottom: 22, background: `linear-gradient(160deg, ${C.surface} 0%, ${C.ice} 130%)` }}>
      <SectionLabel>Total across all currencies</SectionLabel>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {currencies.map((c) => (
          <Chip key={c} active={display === c} onClick={() => setDisplay(c)} style={{ padding: '5px 11px', fontSize: 12 }}>{c}</Chip>
        ))}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 23, fontWeight: 600, color: C.heading, marginBottom: 5 }}>
        {fmtMoney(converted, display)}
      </div>

      {/* Subtitle centered */}
      <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', margin: '4px 0 12px', lineHeight: 1.45 }}>
        Income + investments, minus expenses & untracked (pure savings tracked in individual cards) — converted using live rates
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

function UntrackedMoneySection({ entries, activeCurrency, settings, onOpenAddEntry, setActiveCurrency, currencies = CURRENCIES }) {
  const C = useColors();
  const activeCurrenciesList = currencies && currencies.length ? currencies : CURRENCIES;
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
    activeCurrenciesList.forEach((c) => {
      const cEntries = unaccountedEntries.filter((e) => e.currency === c);
      const total = cEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const inPkr = toBase(total, c, settings?.rates);
      map[c] = { total, inPkr, count: cEntries.length };
    });
    return map;
  }, [unaccountedEntries, settings?.rates, activeCurrenciesList]);

  // Total across all currencies converted to PKR
  const totalAllInPkr = useMemo(() => {
    return activeCurrenciesList.reduce((sum, c) => sum + (perCurrencyBreakdown[c]?.inPkr || 0), 0);
  }, [perCurrencyBreakdown, activeCurrenciesList]);

  const totalCurrenciesWithMissing = useMemo(() => {
    return activeCurrenciesList.filter((c) => (perCurrencyBreakdown[c]?.total || 0) > 0).length;
  }, [perCurrencyBreakdown, activeCurrenciesList]);

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
          {activeCurrenciesList.map((c) => {
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
              {activeCurrenciesList.map((c) => (
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
  exchanges = [],
  onOpenExchange,
  currencies = CURRENCIES,
}) {
  const C = useColors();
  const activeCurrenciesList = currencies && currencies.length ? currencies : CURRENCIES;
  const totals = computeTotals(entries, activeCurrency);
  const thisMonth = monthKey(todayStr());
  const monthExpenses = {};
  activeCurrenciesList.forEach((c) => {
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

      <TotalAcrossCurrencies entries={entries} settings={settings} display={totalDisplay} setDisplay={setTotalDisplay} currencies={activeCurrenciesList} />

      <SectionLabel>Currencies</SectionLabel>
      <div className="vlf-currency-row" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 20, paddingTop: 10, paddingBottom: 38 }}>
        {activeCurrenciesList.map((c) => {
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

      {/* Currency Conversions & FX Tracker Widget */}
      {(() => {
        const openLots = (exchanges || []).filter((e) => e.type === 'buy' && (e.remainingUnits > 0 || (e.remainingUnits === undefined && e.status !== 'closed')));
        const totalOpenCost = openLots.reduce((s, l) => {
          const units = l.remainingUnits != null ? l.remainingUnits : l.toAmount;
          const rate = l.rateAtDeal || (l.fromAmount / l.toAmount) || 1;
          return s + (units * rate);
        }, 0);
        const totalOpenMarketVal = openLots.reduce((s, l) => {
          const units = l.remainingUnits != null ? l.remainingUnits : l.toAmount;
          const live = settings?.rates?.[l.toCurrency] || 1;
          return s + (units * live);
        }, 0);
        const totalUnrealizedPnl = totalOpenMarketVal - totalOpenCost;
        const totalUnrealizedPct = totalOpenCost > 0 ? (totalUnrealizedPnl / totalOpenCost) * 100 : 0;
        const closedTrades = (exchanges || []).filter((e) => e.type === 'sell');
        const totalRealizedPnl = closedTrades.reduce((s, t) => s + (t.realizedPnlPkr || 0), 0);

        return (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowRightLeft size={14} color="#2563EB" />
                <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  FX Conversions & P&L ({openLots.length} Active)
                </span>
              </div>
              <button
                onClick={onOpenExchange}
                className="vlf-hover"
                style={{
                  background: 'none', border: 'none', color: '#2563EB', fontSize: 11.5,
                  fontWeight: 700, cursor: 'pointer', padding: 0,
                }}
              >
                + Convert / FX Tracker
              </button>
            </div>

            <div style={{
              background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16,
              padding: '12px 14px', boxShadow: '0 1px 3px rgba(20,17,13,0.03)',
            }}>
              {openLots.length === 0 && closedTrades.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: C.heading }}>No conversions logged yet</div>
                    <div style={{ fontSize: 11, color: C.muted }}>Track conversions (e.g. PKR to EUR/TRY) & sales profit/loss.</div>
                  </div>
                  <button
                    onClick={onOpenExchange}
                    style={{
                      padding: '6px 12px', borderRadius: 9, background: '#2563EB', color: '#fff',
                      border: 'none', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Convert Now
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: openLots.length > 0 ? 10 : 0 }}>
                    <div style={{ background: C.ice, padding: '8px 10px', borderRadius: 10 }}>
                      <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, textTransform: 'uppercase' }}>Holdings Value</div>
                      <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 800, color: C.heading }}>
                        Rs {fmtAmount(totalOpenMarketVal)}
                      </div>
                      <div style={{ fontSize: 9.5, color: C.muted }}>Cost: Rs {fmtAmount(totalOpenCost)}</div>
                    </div>

                    <div style={{
                      background: totalUnrealizedPnl >= 0 ? 'rgba(30,158,100,0.08)' : 'rgba(178,58,52,0.08)',
                      padding: '8px 10px', borderRadius: 10,
                    }}>
                      <div style={{ fontSize: 9.5, color: totalUnrealizedPnl >= 0 ? '#1E9E64' : '#B23A34', fontWeight: 700, textTransform: 'uppercase' }}>
                        Unrealized P&L
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 800, color: totalUnrealizedPnl >= 0 ? '#1E9E64' : '#B23A34' }}>
                        {totalUnrealizedPnl >= 0 ? '+' : ''}Rs {fmtAmount(totalUnrealizedPnl)} ({totalUnrealizedPnl >= 0 ? '+' : ''}{totalUnrealizedPct.toFixed(1)}%)
                      </div>
                      <div style={{ fontSize: 9.5, color: totalRealizedPnl >= 0 ? '#1E9E64' : '#B23A34' }}>
                        Realized: {totalRealizedPnl >= 0 ? '+' : ''}Rs {fmtAmount(totalRealizedPnl)}
                      </div>
                    </div>
                  </div>

                  {openLots.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                      {openLots.slice(0, 3).map((lot) => {
                        const units = lot.remainingUnits != null ? lot.remainingUnits : lot.toAmount;
                        const buyRate = lot.rateAtDeal || (lot.fromAmount / lot.toAmount);
                        const liveRate = settings?.rates?.[lot.toCurrency] || 1;
                        const pnl = (liveRate - buyRate) * units;
                        return (
                          <div
                            key={lot.id}
                            onClick={onOpenExchange}
                            style={{
                              flex: '1 0 140px', background: C.ice, padding: '7px 9px', borderRadius: 8,
                              border: `1px solid ${C.line}`, cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: C.heading }}>
                                {fmtAmount(units)} {lot.toCurrency}
                              </span>
                              <span style={{ fontSize: 9.5, fontWeight: 700, color: pnl >= 0 ? '#1E9E64' : '#B23A34' }}>
                                {pnl >= 0 ? '+' : ''}Rs {fmtAmount(pnl)}
                              </span>
                            </div>
                            <div style={{ fontSize: 9, color: C.muted }}>
                              @ Rs {fmtAmount(buyRate)} ➔ Today {fmtAmount(liveRate)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
        const otherCurrenciesWithLimits = activeCurrenciesList.filter((c) => c !== activeCurrency && Number(settings.budgetLimits?.[c]) > 0);

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
        {activeCurrenciesList.map((c) => {
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

function HistoryScreen({
  entries,
  onEdit,
  settings,
  initialCurrency,
  onCurrencyChange,
  currencies = CURRENCIES,
  profiles = [],
  activeProfile,
  onOpenWorkspaceTransfer,
  onOpenCrossTransferAudit,
}) {
  const C = useColors();
  const activeCurrenciesList = currencies && currencies.length ? currencies : CURRENCIES;
  const [filterCurrency, setFilterCurrency] = useState(initialCurrency || 'All');
  const [filterType, setFilterType] = useState('All');
  const [filterWorkspaceId, setFilterWorkspaceId] = useState('all');
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
      .filter((e) => filterWorkspaceId === 'all' || (e.workspaceId || 'default') === filterWorkspaceId)
      .filter((e) => filterCurrency === 'All' || e.currency === filterCurrency)
      .filter((e) => filterType === 'All' || e.type === filterType)
      .filter((e) => range === 'week' ? e.date >= startOfWeekStr : range === 'month' ? e.date >= startOfMonthStr : true)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [entries, filterWorkspaceId, filterCurrency, filterType, range]);

  // Calculations for the 5 top square blocks (Income, Expense, Saving, Investment, Pata Nahi)
  const totalsByType = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfWeekStr = startOfWeek.toISOString().slice(0, 10);
    const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const baseEntries = entries
      .filter((e) => filterWorkspaceId === 'all' || (e.workspaceId || 'default') === filterWorkspaceId)
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

    activeCurrenciesList.forEach((c) => {
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
  }, [entries, range, settings?.rates, activeCurrenciesList]);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 23, color: C.heading, margin: 0, fontWeight: 600 }}>History</h2>
        {onOpenWorkspaceTransfer && (
          <button
            type="button"
            onClick={onOpenWorkspaceTransfer}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 10,
              background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.3)',
              color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Shuffle size={13} /> Inter-Workspace Transfer
          </button>
        )}
      </div>

      {/* Workspace Filter Pills (if multiple workspaces exist) */}
      {profiles && profiles.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto',
          paddingBottom: 8, marginBottom: 12,
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
            Vault:
          </span>
          <Chip
            active={filterWorkspaceId === 'all'}
            onClick={() => setFilterWorkspaceId('all')}
            style={{ fontSize: 11.5, padding: '4px 10px', flexShrink: 0 }}
          >
            All Workspaces
          </Chip>
          {profiles.map((p) => (
            <Chip
              key={p.id}
              active={filterWorkspaceId === p.id}
              onClick={() => setFilterWorkspaceId(p.id)}
              style={{ fontSize: 11.5, padding: '4px 10px', flexShrink: 0 }}
            >
              {p.name} {p.id === activeProfile?.id ? '★' : ''}
            </Chip>
          ))}
        </div>
      )}

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
        {activeCurrenciesList.map((c) => {
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
            {activeCurrenciesList.map((c) => {
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
            {activeCurrenciesList.map((c) => {
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

                {e.crossTransfer && (
                  <div
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpenCrossTransferAudit && onOpenCrossTransferAudit(e);
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 7px', borderRadius: 6,
                      background: e.crossTransfer.role === 'source' ? 'rgba(178,58,52,0.1)' : 'rgba(5,150,105,0.1)',
                      border: `1px solid ${e.crossTransfer.role === 'source' ? 'rgba(178,58,52,0.25)' : 'rgba(5,150,105,0.25)'}`,
                      color: e.crossTransfer.role === 'source' ? '#B23A34' : '#059669',
                      fontSize: 10, fontWeight: 700, marginTop: 4, cursor: 'pointer',
                    }}
                    title="Click to view full Inter-Workspace audit details"
                  >
                    <Shuffle size={10} />
                    <span>
                      {e.crossTransfer.role === 'source'
                        ? `⇄ Debited to ${profiles.find(p => p.id === e.crossTransfer.targetWorkspaceId)?.name || 'Target'}`
                        : `⇄ Credited from ${profiles.find(p => p.id === e.crossTransfer.sourceWorkspaceId)?.name || 'Source'}`}
                    </span>
                  </div>
                )}
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

function NetWorthScreen({ entries, settings, onNavigateToHistory, currencies = CURRENCIES }) {
  const C = useColors();
  const [display, setDisplay] = useState(settings.displayCurrency || 'PKR');
  const [groupBySource, setGroupBySource] = useState(false);

  // Per-currency breakdown including net balance (holdings/savings/investments/income - expenses - untracked)
  // and breakdown of holdings vs net
  const perCurrency = useMemo(() => {
    return (currencies || CURRENCIES).map((c) => {
      const t = computeTotals(entries, c);
      const grossHoldings = (t.saving || 0) + (t.investment || 0);
      const totalIncome = t.income || 0;
      const totalExpenses = t.expense || 0;
      const totalSavings = t.saving || 0;
      const totalInvestments = t.investment || 0;
      const totalUntracked = t.unaccounted || 0;
      // Net worth in this individual currency = (Income + Saving + Investment) - Expense - Untracked
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
        totalSavings,
        totalInvestments,
        totalUntracked,
        count,
        hasActivity: (t.income || t.expense || t.saving || t.investment || t.unaccounted) > 0,
      };
    }).filter((x) => x.hasActivity || x.count > 0);
  }, [entries, settings.rates, currencies]);

  // Total net worth across all currencies converted to base PKR (EXCLUDING savings as requested by user)
  const totalNetInBasePkr = useMemo(() => {
    return (currencies || CURRENCIES).reduce((sum, c) => {
      const t = computeTotals(entries, c);
      // Exclude saving from aggregate total net worth sum
      const netWithoutSaving = (t.income || 0) + (t.investment || 0) - (t.expense || 0) - (t.unaccounted || 0);
      return sum + toBase(netWithoutSaving, c, settings.rates);
    }, 0);
  }, [entries, settings.rates, currencies]);

  const convertedTotalNet = fromBase(totalNetInBasePkr, display, settings.rates);

  // Total gross income across all currencies converted to base PKR
  const totalIncomeBase = useMemo(() => {
    return (currencies || CURRENCIES).reduce((sum, c) => {
      const t = computeTotals(entries, c);
      return sum + toBase(t.income || 0, c, settings.rates);
    }, 0);
  }, [entries, settings.rates, currencies]);
  const convertedIncome = fromBase(totalIncomeBase, display, settings.rates);

  // Total savings and investments converted
  const totalSavingsBase = useMemo(() => {
    return (currencies || CURRENCIES).reduce((sum, c) => {
      const t = computeTotals(entries, c);
      return sum + toBase(t.saving || 0, c, settings.rates);
    }, 0);
  }, [entries, settings.rates, currencies]);
  const convertedSavings = fromBase(totalSavingsBase, display, settings.rates);

  const totalInvestmentsBase = useMemo(() => {
    return (currencies || CURRENCIES).reduce((sum, c) => {
      const t = computeTotals(entries, c);
      return sum + toBase(t.investment || 0, c, settings.rates);
    }, 0);
  }, [entries, settings.rates, currencies]);
  const convertedInvestments = fromBase(totalInvestmentsBase, display, settings.rates);

  // Gross before spend (Income + Investments, pure savings held aside)
  const totalGrossBeforeSpendBase = totalIncomeBase + totalInvestmentsBase;
  const convertedGrossBeforeSpend = fromBase(totalGrossBeforeSpendBase, display, settings.rates);

  // Expenses & untracked converted
  const totalExpensesBase = useMemo(() => {
    return (currencies || CURRENCIES).reduce((sum, c) => {
      const t = computeTotals(entries, c);
      return sum + toBase(t.expense || 0, c, settings.rates);
    }, 0);
  }, [entries, settings.rates, currencies]);
  const convertedExpenses = fromBase(totalExpensesBase, display, settings.rates);

  const totalUntrackedBase = useMemo(() => {
    return (currencies || CURRENCIES).reduce((sum, c) => {
      const t = computeTotals(entries, c);
      return sum + toBase(t.unaccounted || 0, c, settings.rates);
    }, 0);
  }, [entries, settings.rates, currencies]);
  const convertedUntracked = fromBase(totalUntrackedBase, display, settings.rates);

  const totalOutflowBase = totalExpensesBase + totalUntrackedBase;
  const convertedOutflow = fromBase(totalOutflowBase, display, settings.rates);

  // Net After spend (Total Net Worth excluding savings)
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
    (currencies || CURRENCIES).forEach((c) => {
      const t = computeTotals(entries, c);
      map.income[c] = t.income || 0;
      map.saving[c] = t.saving || 0;
      map.investment[c] = t.investment || 0;
      map.expense[c] = t.expense || 0;
      map.unaccounted[c] = t.unaccounted || 0;
      map.outflow[c] = (t.expense || 0) + (t.unaccounted || 0);
    });
    return map;
  }, [entries, currencies]);

  const renderCurrencyLines = (typeKey, color) => {
    const activeCurrs = (currencies || CURRENCIES).filter((c) => (perCurrencyByType[typeKey]?.[c] || 0) > 0);
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
        {(currencies || CURRENCIES).map((c) => <Chip key={c} active={display === c} onClick={() => setDisplay(c)}>{c}</Chip>)}
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
          Income + Investments − Expenses & Untracked (pure savings kept in individual cards)
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

function ReportScreen({ entries, reminders = [], requestPassword, onOpenImport }) {
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <button onClick={() => requestPassword(exportMonth)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.navy, color: '#fff', border: 'none', borderRadius: 14, padding: '13px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          <FileSpreadsheet size={17} /> Export {monthLabel(currentKey)} + Reminders (Sheet 2)
        </button>
        <button onClick={() => requestPassword(exportAll)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.surface, color: C.navy, border: `1.5px solid ${C.navy}`, borderRadius: 14, padding: '13px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          <Download size={17} /> Export Full History + Reminders (Sheet 2)
        </button>
      </div>

      <SectionLabel>Import & Restore</SectionLabel>
      <div style={{
        background: C.ice, border: `1.5px solid ${C.line}`, borderRadius: 16, padding: '16px 16px',
        marginBottom: 16, fontSize: 12.5, color: C.navySoft, lineHeight: 1.5,
      }}>
        <div style={{ fontWeight: 800, color: C.heading, fontSize: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Upload size={17} color={C.navy} />
          <span>Upload & Restore Data Sheet</span>
        </div>
        <p style={{ margin: '0 0 14px', color: C.muted, fontSize: 12 }}>
          Upload your downloaded Excel report or CSV file to import all financial transactions and reminders directly into Vaultify with password verification.
        </p>
        <button
          onClick={onOpenImport}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: C.navy, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 16px',
            fontSize: 13.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(20,17,13,0.15)',
          }}
        >
          <Upload size={16} /> Import Data Sheet (.xlsx, .csv)
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inter-Workspace Transfer Modal (Multi-Step with Password Auth)     */
/* ------------------------------------------------------------------ */

function InterWorkspaceTransferModal({
  open,
  onClose,
  onExecuteTransfer,
  profiles = [],
  activeProfile,
  onCreateProfile,
  currencies = CURRENCIES,
  settings,
  userEmail,
  initialData,
}) {
  const C = useColors();
  const [step, setStep] = useState('form'); // 'form' | 'confirm' | 'auth' | 'success'
  const [fromProfileId, setFromProfileId] = useState(activeProfile?.id || profiles[0]?.id || 'default');
  const [toProfileId, setToProfileId] = useState('');
  const [fromAmount, setFromAmount] = useState('');
  const [fromCurrency, setFromCurrency] = useState('PKR');
  const [toCurrency, setToCurrency] = useState('PKR');
  const [transferType, setTransferType] = useState('income'); // 'income' (Profit/Draw to Target), 'saving', 'investment'
  const [category, setCategory] = useState('Salary Draw / Profit Allocation');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Initialize or reset when opened
  useEffect(() => {
    if (!open) return;
    setStep('form');
    setAuthError('');
    setPassword('');
    const srcId = initialData?.fromProfileId || activeProfile?.id || profiles[0]?.id || 'default';
    setFromProfileId(srcId);
    
    // Default destination is the first other profile available
    const otherProfile = profiles.find((p) => p.id !== srcId);
    setToProfileId(otherProfile?.id || '');

    setFromAmount(initialData?.fromAmount ? String(initialData.fromAmount) : '');
    setFromCurrency(initialData?.fromCurrency || settings?.lastCurrency || 'PKR');
    setToCurrency(settings?.lastCurrency || 'PKR');
    setTransferType(initialData?.transferType || 'income');
    setCategory(initialData?.category || 'Salary Draw / Profit Allocation');
    setNote(initialData?.note || '');
    setDate(initialData?.date || todayStr());
  }, [open, initialData, activeProfile, profiles, settings]);

  if (!open) return null;

  const fromProfile = profiles.find((p) => p.id === fromProfileId) || profiles[0] || { name: 'Source Vault' };
  const toProfile = profiles.find((p) => p.id === toProfileId) || profiles.find((p) => p.id !== fromProfileId) || { name: 'Target Vault' };

  // Calculate target converted amount using exchange rates
  const rates = settings?.rates || DEFAULT_RATES;
  const numFrom = Number(parseCleanAmount(fromAmount)) || 0;
  const fromRateInPkr = rates[fromCurrency] || 1;
  const toRateInPkr = rates[toCurrency] || 1;
  const calculatedToAmount = toRateInPkr > 0 ? (numFrom * fromRateInPkr) / toRateInPkr : numFrom;

  const hasMultipleProfiles = profiles && profiles.length > 1;

  const handleReview = () => {
    if (!numFrom || numFrom <= 0) return;
    if (!toProfileId || toProfileId === fromProfileId) return;
    setStep('confirm');
  };

  const handleProceedToAuth = () => {
    setAuthError('');
    setPassword('');
    setStep('auth');
  };

  const handleAuthorizeAndExecute = async (e) => {
    if (e) e.preventDefault();
    if (!password) {
      setAuthError('Please enter your password to confirm.');
      return;
    }
    setIsAuthenticating(true);
    setAuthError('');

    try {
      if (userEmail) {
        const { error } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: password.trim(),
        });
        if (error) {
          setIsAuthenticating(false);
          setAuthError('Incorrect password. Please verify and try again.');
          return;
        }
      }

      // Execute cross-workspace transfer
      const success = await onExecuteTransfer({
        fromProfileId,
        toProfileId,
        fromCurrency,
        toCurrency,
        fromAmount: numFrom,
        toAmount: Number(calculatedToAmount.toFixed(2)),
        transferType,
        category,
        note,
        date,
      });

      setIsAuthenticating(false);
      if (success) {
        setStep('success');
        setTimeout(() => {
          onClose();
        }, 1100);
      } else {
        setAuthError('Transfer failed. Please check your connection.');
      }
    } catch (err) {
      setIsAuthenticating(false);
      setAuthError(err.message || 'Authorization failed. Please try again.');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', boxSizing: 'border-box',
    }}>
      <div style={{
        background: C.surface,
        border: `1.5px solid ${C.line}`,
        borderRadius: 20,
        width: '100%',
        maxWidth: 480,
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 20px 48px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: `1px solid ${C.line}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(5,150,105,0.18), rgba(30,64,175,0.18))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shuffle size={18} color="#059669" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.heading }}>
                Inter-Workspace Transfer
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>
                {step === 'form' ? 'Move & allocate entries across workspaces' :
                 step === 'confirm' ? 'Security Confirmation' :
                 step === 'auth' ? 'Password Verification' : 'Transfer Complete'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body content based on step */}
        <div style={{ padding: '20px' }}>
          {!hasMultipleProfiles && step === 'form' ? (
            <div style={{ textAlign: 'center', padding: '20px 8px' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16, background: `${C.navy}14`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <FolderPlus size={24} color={C.navy} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.heading, marginBottom: 8 }}>
                Multiple Workspaces Required
              </div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 20 }}>
                You currently have 1 workspace. Create a second workspace (e.g. <strong>"Professional"</strong> or <strong>"Business"</strong>) to enable cross-vault transfers, salary draws, and profit allocations.
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCreateProfile && onCreateProfile();
                }}
                style={{
                  padding: '12px 20px', borderRadius: 12, border: 'none',
                  background: C.navy, color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                <Plus size={16} /> Create New Workspace
              </button>
            </div>
          ) : step === 'form' ? (
            <div>
              {/* Source & Destination Vault Selectors */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10,
                alignItems: 'center', marginBottom: 18,
              }}>
                {/* Source Vault */}
                <div style={{
                  padding: 12, borderRadius: 14, background: C.ice,
                  border: `1px solid ${C.line}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#B23A34', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em' }}>
                    From (Debit)
                  </div>
                  <select
                    value={fromProfileId}
                    onChange={(e) => {
                      setFromProfileId(e.target.value);
                      if (e.target.value === toProfileId) {
                        const other = profiles.find((p) => p.id !== e.target.value);
                        if (other) setToProfileId(other.id);
                      }
                    }}
                    style={{
                      width: '100%', border: 'none', background: 'transparent',
                      fontSize: 13, fontWeight: 700, color: C.heading, outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Arrow Icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: C.surface,
                  border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ArrowRight size={14} color={C.navy} />
                </div>

                {/* Destination Vault */}
                <div style={{
                  padding: 12, borderRadius: 14, background: C.ice,
                  border: `1px solid ${C.line}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em' }}>
                    To (Credit)
                  </div>
                  <select
                    value={toProfileId}
                    onChange={(e) => setToProfileId(e.target.value)}
                    style={{
                      width: '100%', border: 'none', background: 'transparent',
                      fontSize: 13, fontWeight: 700, color: C.heading, outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {profiles.filter((p) => p.id !== fromProfileId).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Transfer Direction / Intent */}
              <div style={{ marginBottom: 16 }}>
                <SectionLabel>Transfer Allocation Type</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { key: 'income', label: 'Income Draw', desc: 'Adds as Income in target', icon: Wallet, color: '#1E9E64' },
                    { key: 'saving', label: 'Save Reserve', desc: 'Adds to Savings in target', icon: PiggyBank, color: '#2E6F6F' },
                    { key: 'investment', label: 'Invest Capital', desc: 'Adds to Investment in target', icon: TrendingUp, color: '#6B5FA8' },
                  ].map((t) => {
                    const active = transferType === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTransferType(t.key)}
                        style={{
                          padding: '10px 8px', borderRadius: 12,
                          background: active ? `${t.color}15` : C.ice,
                          border: `1.5px solid ${active ? t.color : C.line}`,
                          cursor: 'pointer', textAlign: 'center', transition: 'all .15s ease',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: active ? t.color : C.heading, marginBottom: 2 }}>
                          {t.label}
                        </div>
                        <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 500 }}>
                          {t.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount & Currency */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <SectionLabel style={{ margin: 0 }}>Transfer Amount & Currency</SectionLabel>
                  {fromCurrency !== toCurrency && (
                    <div style={{ fontSize: 11, color: C.navy, fontWeight: 700 }}>
                      1 {fromCurrency} ≈ {fmtAmount(fromRateInPkr / toRateInPkr)} {toCurrency}
                    </div>
                  )}
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: C.ice, borderRadius: 14, padding: '10px 14px',
                  border: `1.5px solid ${C.line}`,
                }}>
                  <select
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value)}
                    style={{
                      border: 'none', background: 'transparent', fontSize: 16,
                      fontWeight: 800, color: C.navy, outline: 'none', cursor: 'pointer',
                    }}
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={fromAmount ? formatWithCommas(fromAmount) : ''}
                    onChange={(e) => setFromAmount(parseCleanAmount(e.target.value))}
                    style={{
                      flex: 1, border: 'none', background: 'transparent', outline: 'none',
                      fontFamily: MONO, fontSize: 22, fontWeight: 700, color: C.heading,
                    }}
                  />
                </div>

                {/* Target Currency Selector & Converted Preview */}
                <div style={{
                  marginTop: 10, padding: '10px 12px', borderRadius: 12,
                  background: `${C.navy}08`, border: `1px dashed ${C.navy}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Target receives in:</span>
                    <select
                      value={toCurrency}
                      onChange={(e) => setToCurrency(e.target.value)}
                      style={{
                        border: `1px solid ${C.line}`, background: C.surface,
                        borderRadius: 6, padding: '2px 6px', fontSize: 12, fontWeight: 700,
                        color: C.heading, outline: 'none', cursor: 'pointer',
                      }}
                    >
                      {currencies.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: '#059669' }}>
                      ≈ {fmtMoney(calculatedToAmount, toCurrency)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Purpose / Category Suggestions */}
              <div style={{ marginBottom: 16 }}>
                <SectionLabel>Category / Reason</SectionLabel>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {[
                    'Salary Draw / Profit Allocation',
                    'Personal Savings Transfer',
                    'Business Capital Funding',
                    'Vault Rebalancing',
                    'Emergency Transfer',
                  ].map((cat) => (
                    <Chip
                      key={cat}
                      active={category === cat}
                      onClick={() => setCategory(cat)}
                      style={{ fontSize: 11.5, padding: '5px 10px' }}
                    >
                      {cat}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div style={{ marginBottom: 16 }}>
                <SectionLabel>Note (Optional)</SectionLabel>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Monthly salary from client project to personal..."
                  style={{
                    width: '100%', border: `1px solid ${C.line}`, borderRadius: 12,
                    padding: '10px 14px', fontSize: 13.5, outline: 'none',
                    color: C.heading, background: C.surface, boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Date */}
              <div style={{ marginBottom: 20 }}>
                <SectionLabel>Transaction Date</SectionLabel>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    width: '100%', border: `1px solid ${C.line}`, borderRadius: 12,
                    padding: '10px 14px', fontSize: 13.5, outline: 'none',
                    color: C.heading, background: C.surface, boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleReview}
                disabled={!numFrom || numFrom <= 0 || !toProfileId || toProfileId === fromProfileId}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                  background: numFrom > 0 && toProfileId ? C.navy : C.silver,
                  color: '#fff', fontSize: 15, fontWeight: 700, cursor: numFrom > 0 ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                Review & Confirm Transfer <ChevronRight size={16} />
              </button>
            </div>
          ) : step === 'confirm' ? (
            /* STEP 2: Prominent Confirmation Dialog */
            <div>
              {/* WARNING BOX */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(217,119,6,0.14), rgba(178,58,52,0.12))',
                border: '1.5px solid rgba(217,119,6,0.4)',
                borderRadius: 16,
                padding: '16px 18px',
                marginBottom: 20,
                textAlign: 'center',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(217,119,6,0.2)', border: '1px solid rgba(217,119,6,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 10px',
                }}>
                  <AlertTriangle size={24} color="#D97706" />
                </div>
                <div style={{
                  fontFamily: SERIF, fontSize: 16, fontWeight: 800,
                  color: '#B23A34', letterSpacing: '0.02em', marginBottom: 6,
                  textTransform: 'uppercase',
                }}>
                  DO YOU REALLY WANT TO MAKE THIS TRANSACTION?
                </div>
                <div style={{ fontSize: 12.5, color: C.heading, fontWeight: 600, lineHeight: 1.5 }}>
                  This will synchronize both workspaces by debiting from <strong>{fromProfile.name}</strong> and crediting <strong>{toProfile.name}</strong>.
                </div>
              </div>

              {/* Visual Transaction Summary */}
              <div style={{
                background: C.ice, border: `1px solid ${C.line}`,
                borderRadius: 16, padding: '16px', marginBottom: 20,
              }}>
                {/* Source Debit Item */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingBottom: 12, borderBottom: `1px solid ${C.line}`,
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#B23A34', textTransform: 'uppercase' }}>
                      Debited from
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.heading }}>
                      {fromProfile.name}
                    </div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800, color: '#B23A34' }}>
                    - {fmtMoney(numFrom, fromCurrency)}
                  </div>
                </div>

                {/* Target Credit Item */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                      Credited to ({transferType === 'saving' ? 'Savings' : transferType === 'investment' ? 'Investment' : 'Income'})
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.heading }}>
                      {toProfile.name}
                    </div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800, color: '#059669' }}>
                    + {fmtMoney(calculatedToAmount, toCurrency)}
                  </div>
                </div>
              </div>

              {/* Transaction Metadata */}
              <div style={{
                fontSize: 12, color: C.muted, background: `${C.navy}06`,
                borderRadius: 12, padding: '12px 14px', marginBottom: 20,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div><strong>Category:</strong> {category}</div>
                {note && <div><strong>Note:</strong> {note}</div>}
                <div><strong>Date:</strong> {date}</div>
                <div><strong>Live Conversion Rate:</strong> 1 {fromCurrency} = {fmtAmount(fromRateInPkr / toRateInPkr)} {toCurrency}</div>
              </div>

              {/* Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  style={{
                    padding: '13px', borderRadius: 14, border: `1px solid ${C.line}`,
                    background: C.surface, color: C.heading, fontSize: 14, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ← Edit Details
                </button>
                <button
                  type="button"
                  onClick={handleProceedToAuth}
                  style={{
                    padding: '13px', borderRadius: 14, border: 'none',
                    background: C.navy, color: '#fff', fontSize: 14, fontWeight: 800,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <Lock size={15} /> Yes, Authorize →
                </button>
              </div>
            </div>
          ) : step === 'auth' ? (
            /* STEP 3: Password Required Authentication */
            <form onSubmit={handleAuthorizeAndExecute}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16, background: `${C.navy}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px', border: `1.5px solid ${C.navy}33`,
                }}>
                  <KeyRound size={26} color={C.navy} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.heading, marginBottom: 6 }}>
                  Password Required
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.4 }}>
                  Enter your account password to authorize this cross-workspace transaction between <strong>{fromProfile.name}</strong> and <strong>{toProfile.name}</strong>.
                </div>
              </div>

              {authError && (
                <div style={{
                  background: 'rgba(178,58,52,0.12)', border: '1px solid rgba(178,58,52,0.3)',
                  borderRadius: 12, padding: '10px 14px', color: '#B23A34',
                  fontSize: 12.5, fontWeight: 600, marginBottom: 16, textAlign: 'center',
                }}>
                  {authError}
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <SectionLabel>Account Password</SectionLabel>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: C.surface, border: `1.5px solid ${C.navy}44`,
                  borderRadius: 12, padding: '10px 14px',
                }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    style={{
                      flex: 1, border: 'none', background: 'transparent',
                      outline: 'none', fontSize: 14, color: C.heading,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 2 }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  disabled={isAuthenticating}
                  style={{
                    padding: '13px', borderRadius: 14, border: `1px solid ${C.line}`,
                    background: C.surface, color: C.heading, fontSize: 14, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating || !password}
                  style={{
                    padding: '13px', borderRadius: 14, border: 'none',
                    background: password ? '#059669' : C.silver, color: '#fff', fontSize: 14, fontWeight: 800,
                    cursor: password ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {isAuthenticating ? 'Verifying…' : 'Authorize & Execute'}
                </button>
              </div>
            </form>
          ) : (
            /* STEP 4: Success State */
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%', background: '#05966920',
                border: '2px solid #059669', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <CheckCircle2 size={36} color="#059669" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.heading, marginBottom: 8 }}>
                Transaction Authorized & Completed!
              </div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                {fmtMoney(numFrom, fromCurrency)} transferred to {toProfile.name} as {fmtMoney(calculatedToAmount, toCurrency)}.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Transfer Audit Modal (Detailed Cross-Workspace Audit Trail)        */
/* ------------------------------------------------------------------ */

function TransferAuditModal({ open, onClose, entry, profiles = [] }) {
  const C = useColors();
  if (!open || !entry) return null;

  const xfer = entry.crossTransfer || {};
  const srcName = xfer.sourceWorkspaceName || profiles.find(p => p.id === xfer.sourceWorkspaceId)?.name || 'Source Vault';
  const dstName = xfer.targetWorkspaceName || profiles.find(p => p.id === xfer.targetWorkspaceId)?.name || 'Destination Vault';
  const role = xfer.role || (entry.type === 'expense' ? 'source' : 'target');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 65,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', boxSizing: 'border-box',
    }}>
      <div style={{
        background: C.surface, border: `1.5px solid ${C.line}`,
        borderRadius: 20, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 48px rgba(0,0,0,0.35)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${C.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: 'rgba(5,150,105,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shuffle size={16} color="#059669" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.heading }}>
                Transfer Audit Record
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                Inter-Workspace Linked Transaction
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Status Badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.3)',
            borderRadius: 10, padding: '8px 12px', marginBottom: 16,
            color: '#059669', fontSize: 12, fontWeight: 700,
          }}>
            <ShieldCheck size={16} />
            <span>Authorized & Verified via Account Password</span>
          </div>

          {/* Route Map */}
          <div style={{
            background: C.ice, border: `1px solid ${C.line}`,
            borderRadius: 14, padding: '14px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#B23A34', textTransform: 'uppercase' }}>Source Vault</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.heading }}>{srcName}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Target Vault</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.heading }}>{dstName}</div>
              </div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '6px 0', color: C.muted, fontSize: 12, fontWeight: 600,
            }}>
              <span>{role === 'source' ? 'Outgoing Transfer' : 'Incoming Allocation'}</span>
              <ArrowRight size={14} color={C.navy} />
            </div>
          </div>

          {/* Details table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.line}` }}>
              <span style={{ color: C.muted }}>Transaction Amount:</span>
              <strong style={{ fontFamily: MONO, color: C.heading }}>{fmtMoney(entry.amount, entry.currency)}</strong>
            </div>
            {xfer.counterpartAmount && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.line}` }}>
                <span style={{ color: C.muted }}>Counterpart Value:</span>
                <strong style={{ fontFamily: MONO, color: C.heading }}>{fmtMoney(xfer.counterpartAmount, xfer.counterpartCurrency)}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.line}` }}>
              <span style={{ color: C.muted }}>Category / Purpose:</span>
              <span style={{ fontWeight: 700, color: C.heading }}>{entry.category || 'Inter-Workspace Transfer'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.line}` }}>
              <span style={{ color: C.muted }}>Date:</span>
              <span style={{ fontWeight: 600, color: C.heading }}>{entry.date}</span>
            </div>
            {xfer.id && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: C.muted }}>Transfer Reference ID:</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{xfer.id}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%', padding: '12px', borderRadius: 12, border: 'none',
              background: C.navy, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add FAB menu — toggled by the + button, choose Add entry / Reminder / Calc */
/* ------------------------------------------------------------------ */

function FabMenu({ open, onClose, onAddEntry, onAddReminder, onAddUntracked, onCalculator, onExchange, onTransferWorkspace }) {
  const C = useColors();
  if (!open) return null;
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 38 }} onClick={onClose} />
      <div className="vlf-add-menu" style={{
        display: 'flex', flexDirection: 'column', gap: 6, background: C.surface, border: `1px solid ${C.line}`,
        borderRadius: 16, padding: 8, boxShadow: '0 14px 34px rgba(0,0,0,0.35)', minWidth: 235,
      }}>
        <button onClick={() => { onClose(); onAddEntry(); }} className="vlf-hover" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 11, border: 'none',
          background: 'none', color: C.heading, fontSize: 14, fontWeight: 700, textAlign: 'left', cursor: 'pointer',
        }}>
          <Plus size={16} color={C.navy} /> Add entry
        </button>
        <button onClick={() => { onClose(); onTransferWorkspace && onTransferWorkspace(); }} className="vlf-hover" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 11, border: 'none',
          background: 'none', color: C.heading, fontSize: 14, fontWeight: 700, textAlign: 'left', cursor: 'pointer',
        }}>
          <Shuffle size={16} color="#059669" /> Inter-Workspace Transfer
        </button>
        <button onClick={() => { onClose(); onExchange && onExchange(); }} className="vlf-hover" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 11, border: 'none',
          background: 'none', color: C.heading, fontSize: 14, fontWeight: 700, textAlign: 'left', cursor: 'pointer',
        }}>
          <ArrowRightLeft size={16} color="#2563EB" /> Currency Conversion / FX
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
/* Exchange Sheet — Currency Conversion, Trade & Realized P&L Tracker */
/* ------------------------------------------------------------------ */

function ExchangeSheet({
  open,
  onClose,
  onSaveExchange,
  onDeleteExchange,
  onCompleteSale,
  exchanges = [],
  settings,
  entries = [],
  currencies = CURRENCIES,
}) {
  const C = useColors();
  const activeCurrenciesList = currencies && currencies.length ? currencies : CURRENCIES;
  const [tab, setTab] = useState('convert'); // 'convert' | 'sell' | 'history'

  // Convert (Buy Foreign Currency) form state
  const [buyDate, setBuyDate] = useState(todayStr());
  const [fromCurr, setFromCurr] = useState('PKR');
  const [fromAmount, setFromAmount] = useState('');
  const [toCurr, setToCurr] = useState('EUR');
  const [toAmount, setToAmount] = useState('');
  const [holdingSource, setHoldingSource] = useState('Cash in Hand');
  const [dealerNote, setDealerNote] = useState('');
  const [syncVault, setSyncVault] = useState(true);
  const [buyTouched, setBuyTouched] = useState(false);

  // Sell & Realize P&L form state
  const [sellDate, setSellDate] = useState(todayStr());
  const [selectedLotId, setSelectedLotId] = useState('');
  const [sellUnits, setSellUnits] = useState('');
  const [receiveCurr, setReceiveCurr] = useState('PKR');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [saleNote, setSaleNote] = useState('');
  const [syncSaleVault, setSyncSaleVault] = useState(true);
  const [sellTouched, setSellTouched] = useState(false);

  const openLots = useMemo(() => {
    return (exchanges || [])
      .filter((e) => e.type === 'buy' && (e.remainingUnits > 0 || (e.remainingUnits === undefined && e.status !== 'closed')))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [exchanges]);

  const closedTrades = useMemo(() => {
    return (exchanges || [])
      .filter((e) => e.type === 'sell')
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [exchanges]);

  // Selected lot object for Sell flow
  const activeLot = useMemo(() => {
    return openLots.find((l) => l.id === selectedLotId) || openLots[0] || null;
  }, [openLots, selectedLotId]);

  useEffect(() => {
    if (!open) return;
    setBuyDate(todayStr());
    setFromCurr('PKR');
    setFromAmount('');
    setToCurr('EUR');
    setToAmount('');
    setHoldingSource('Cash in Hand');
    setDealerNote('');
    setSyncVault(true);
    setBuyTouched(false);

    setSellDate(todayStr());
    setReceiveCurr('PKR');
    setReceiveAmount('');
    setSaleNote('');
    setSyncSaleVault(true);
    setSellTouched(false);

    if (openLots.length > 0) {
      const first = openLots[0];
      setSelectedLotId(first.id);
      const units = first.remainingUnits != null ? first.remainingUnits : first.toAmount;
      setSellUnits(String(units));
    } else {
      setSelectedLotId('');
      setSellUnits('');
    }
  }, [open, openLots]);

  if (!open) return null;

  // Rate calculations for Buy / Convert
  const numFromAmount = Number(parseCleanAmount(fromAmount)) || 0;
  const numToAmount = Number(parseCleanAmount(toAmount)) || 0;
  const canSaveBuy = numFromAmount > 0 && numToAmount > 0 && fromCurr !== toCurr;

  // Universal official cross rate calculation for all currency pairs
  const fromRatePkr = fromCurr === 'PKR' ? 1 : (settings?.rates?.[fromCurr] || 1);
  const toRatePkr = toCurr === 'PKR' ? 1 : (settings?.rates?.[toCurr] || 1);
  // Official cross rate: 1 toCurr in terms of fromCurr
  const officialNetCrossRate = fromRatePkr > 0 ? (toRatePkr / fromRatePkr) : 1;
  // Inverse: 1 fromCurr in terms of toCurr
  const officialInverseRate = officialNetCrossRate > 0 ? (1 / officialNetCrossRate) : 1;

  // What fromAmount yields at net official market rate
  const officialNetYield = numFromAmount > 0 && officialNetCrossRate > 0
    ? (numFromAmount / officialNetCrossRate)
    : 0;

  // Actual deal rate: 1 toCurr cost how much fromCurr
  const dealRate = (numFromAmount > 0 && numToAmount > 0)
    ? (numFromAmount / numToAmount)
    : 0;

  // Money changer spread vs official net rate across ALL currency pairs
  const spreadPct = (officialNetCrossRate > 0 && dealRate > 0)
    ? (((dealRate - officialNetCrossRate) / officialNetCrossRate) * 100)
    : 0;

  const unitDiff = (numToAmount > 0 && officialNetYield > 0)
    ? (numToAmount - officialNetYield)
    : 0;

  const spreadCostFromCurr = (numToAmount > 0 && officialNetCrossRate > 0)
    ? (numFromAmount - (numToAmount * officialNetCrossRate))
    : 0;

  // Calculations for Sell / Realize P&L
  const numSellUnits = Number(parseCleanAmount(sellUnits)) || 0;
  const numReceiveAmount = Number(parseCleanAmount(receiveAmount)) || 0;
  const lotBuyRate = activeLot ? (activeLot.rateAtDeal || (activeLot.fromAmount / activeLot.toAmount)) : 0;
  const costOfSoldUnits = numSellUnits * lotBuyRate;
  const realizedPnl = numReceiveAmount > 0 ? numReceiveAmount - costOfSoldUnits : 0;
  const realizedPnlPct = costOfSoldUnits > 0 ? (realizedPnl / costOfSoldUnits) * 100 : 0;
  const exitDealRate = numSellUnits > 0 ? numReceiveAmount / numSellUnits : 0;
  const rateGainPerUnit = exitDealRate - lotBuyRate;

  // Exit official rate for Sell tab
  const sellLotCurr = activeLot?.toCurrency || 'EUR';
  const sellLotRatePkr = sellLotCurr === 'PKR' ? 1 : (settings?.rates?.[sellLotCurr] || 1);
  const receiveRatePkr = receiveCurr === 'PKR' ? 1 : (settings?.rates?.[receiveCurr] || 1);
  const sellOfficialCrossRate = receiveRatePkr > 0 ? (sellLotRatePkr / receiveRatePkr) : 1; // 1 sellLotCurr = X receiveCurr
  const sellOfficialNetProceeds = numSellUnits > 0 ? (numSellUnits * sellOfficialCrossRate) : 0;
  const sellSpreadPct = (sellOfficialCrossRate > 0 && exitDealRate > 0)
    ? (((exitDealRate - sellOfficialCrossRate) / sellOfficialCrossRate) * 100)
    : 0;

  const canSaveSell = numSellUnits > 0 && numReceiveAmount > 0 && (activeLot || openLots.length === 0);

  // Portfolio Totals
  const totalOpenCost = openLots.reduce((s, l) => {
    const units = l.remainingUnits != null ? l.remainingUnits : l.toAmount;
    const rate = l.rateAtDeal || (l.fromAmount / l.toAmount) || 1;
    return s + (units * rate);
  }, 0);

  const totalOpenMarketVal = openLots.reduce((s, l) => {
    const units = l.remainingUnits != null ? l.remainingUnits : l.toAmount;
    const live = settings?.rates?.[l.toCurrency] || 1;
    return s + (units * live);
  }, 0);

  const totalUnrealizedPnl = totalOpenMarketVal - totalOpenCost;
  const totalUnrealizedPct = totalOpenCost > 0 ? (totalUnrealizedPnl / totalOpenCost) * 100 : 0;
  const totalRealizedPnl = closedTrades.reduce((s, t) => s + (t.realizedPnlPkr || 0), 0);

  const QUICK_SUGGESTIONS = [50, 100, 500, 1000, 1500];

  const handleSwapCurrencies = () => {
    const tempCurr = fromCurr;
    setFromCurr(toCurr);
    setToCurr(tempCurr);
    if (fromAmount || toAmount) {
      const tempAmt = fromAmount;
      setFromAmount(toAmount);
      setToAmount(tempAmt);
    }
  };

  // Quick date helper
  const setQuickDate = (daysFromNow, target = 'buy') => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    const str = d.toISOString().slice(0, 10);
    if (target === 'buy') setBuyDate(str);
    else setSellDate(str);
  };

  const handleSaveBuy = () => {
    setBuyTouched(true);
    if (!canSaveBuy) return;

    const record = {
      id: uid(),
      type: 'buy',
      date: buyDate,
      fromCurrency: fromCurr,
      fromAmount: numFromAmount,
      toCurrency: toCurr,
      toAmount: numToAmount,
      rateAtDeal: dealRate,
      marketRateOnDay: officialNetCrossRate,
      spreadPct: Number(spreadPct.toFixed(2)),
      holdingSource,
      note: dealerNote.trim(),
      remainingUnits: numToAmount,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    onSaveExchange(record, syncVault);
    onClose();
  };

  const handleSaveSell = () => {
    setSellTouched(true);
    if (!canSaveSell) return;

    const sellRecord = {
      id: uid(),
      type: 'sell',
      lotIdRef: activeLot?.id || null,
      date: sellDate,
      fromCurrency: activeLot?.toCurrency || 'EUR',
      fromAmount: numSellUnits,
      toCurrency: receiveCurr,
      toAmount: numReceiveAmount,
      costBasisPerUnit: lotBuyRate,
      rateAtDeal: exitDealRate,
      marketRateOnDay: settings?.rates?.[activeLot?.toCurrency || 'EUR'] || 1,
      realizedPnlPkr: realizedPnl,
      realizedPnlPct: Number(realizedPnlPct.toFixed(2)),
      holdingSource: activeLot?.holdingSource || 'Cash in Hand',
      note: saleNote.trim(),
      status: 'closed',
      createdAt: new Date().toISOString(),
    };

    onCompleteSale(sellRecord, activeLot?.id, numSellUnits, syncSaleVault);
    onClose();
  };

  const handleSelectLotForSell = (lot) => {
    setSelectedLotId(lot.id);
    const units = lot.remainingUnits != null ? lot.remainingUnits : lot.toAmount;
    setSellUnits(String(units));
    setTab('sell');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', background: 'rgba(26,23,18,0.5)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, width: '100%', maxWidth: 520, margin: '0 auto', borderRadius: '24px 24px 0 0',
        maxHeight: '92vh', overflowY: 'auto', padding: '18px 18px 28px', fontFamily: SANS,
        boxShadow: '0 -10px 34px rgba(26,23,18,0.28)',
      }}>
        {/* Top Handle */}
        <div style={{ width: 40, height: 4, background: C.line, borderRadius: 2, margin: '0 auto 16px' }} />

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'rgba(37,99,235,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowRightLeft size={19} color="#2563EB" />
            </div>
            <div>
              <h2 style={{ fontFamily: SERIF, fontSize: 19, color: C.heading, margin: 0, fontWeight: 700 }}>
                Currency Conversion & FX
              </h2>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>
                Track foreign currency purchases, rates & profit/loss
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: C.ice, border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={16} color={C.heading} />
          </button>
        </div>

        {/* 3 Main Action Tabs */}
        <div style={{
          display: 'flex', background: C.ice, padding: 3, borderRadius: 12, marginBottom: 16, border: `1px solid ${C.line}`,
        }}>
          {[
            { k: 'convert', l: 'Convert / Buy', icon: Plus },
            { k: 'sell', l: 'Sell & Realize P&L', icon: TrendingUp },
            { k: 'history', l: `Portfolio (${openLots.length})`, icon: FileSpreadsheet },
          ].map((t) => {
            const active = tab === t.k;
            const Icon = t.icon;
            return (
              <button
                key={t.k}
                type="button"
                onClick={() => setTab(t.k)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none',
                  background: active ? C.surface : 'transparent',
                  color: active ? C.heading : C.muted,
                  boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 4, cursor: 'pointer', transition: 'all .15s ease',
                }}
              >
                <Icon size={13} color={active ? '#2563EB' : 'currentColor'} />
                <span>{t.l}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: BUY / CONVERT FOREIGN CURRENCY ------------------------ */}
        {tab === 'convert' && (
          <div>
            {/* TOP SECTION: YOU GIVE / PAY */}
            <div style={{
              background: C.ice, borderRadius: 14, padding: '13px 14px',
              border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: 10,
              textAlign: 'center',
            }}>
              {/* Header with Title & Selected Currency - Center Aligned */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  You Give / Pay
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: C.heading, marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{CURRENCY_META[fromCurr]?.name || fromCurr}</span>
                  <span style={{ fontSize: 16 }}>{CURRENCY_META[fromCurr]?.flag || ''}</span>
                </div>
              </div>

              {/* Currency Selection Chips - Centered */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                {activeCurrenciesList.map((c) => (
                  <Chip
                    key={c}
                    active={fromCurr === c}
                    onClick={() => setFromCurr(c)}
                    style={{ padding: '4px 9px', fontSize: 11 }}
                  >
                    {c}
                  </Chip>
                ))}
              </div>

              {/* Quick Amount Suggestion Chips - Centered */}
              <div>
                <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>
                  Quick Suggestions
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {QUICK_SUGGESTIONS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setFromAmount(String(amt))}
                      style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: Number(fromAmount) === amt ? `${C.navy}18` : C.surface,
                        border: `1px solid ${Number(fromAmount) === amt ? C.navy : C.line}`,
                        color: Number(fromAmount) === amt ? C.navy : C.muted,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtAmount(amt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input Box */}
              <div>
                <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>
                  Amount Paid ({fromCurr}) *
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: C.surface, borderRadius: 12,
                  padding: '10px 14px', border: `1.5px solid ${buyTouched && !numFromAmount ? '#B23A34' : C.line}`,
                }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 100,000"
                    value={fromAmount ? formatWithCommas(fromAmount) : ''}
                    onChange={(e) => setFromAmount(parseCleanAmount(e.target.value))}
                    style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: MONO, fontSize: 16, fontWeight: 700, color: C.heading, textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 15, fontWeight: 800, color: C.heading, whiteSpace: 'nowrap' }}>
                    {CURRENCY_META[fromCurr]?.symbol || fromCurr}
                  </span>
                </div>
              </div>
            </div>

            {/* CENTER VERTICAL SWAP BUTTON (⇅) */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', margin: '4px 0',
            }}>
              <div style={{ position: 'absolute', left: 16, right: 16, height: 1.5, background: C.line }} />
              <button
                type="button"
                onClick={handleSwapCurrencies}
                title="Swap From & To currencies"
                style={{
                  position: 'relative', zIndex: 2, width: 36, height: 36, borderRadius: '50%',
                  background: C.surface, border: `1.5px solid rgba(37,99,235,0.35)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.borderColor = '#2563EB'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = 'rgba(37,99,235,0.35)'; }}
              >
                <ArrowUpDown size={17} color="#2563EB" />
              </button>
            </div>

            {/* BOTTOM SECTION: YOU RECEIVE / BUY */}
            <div style={{
              background: 'rgba(37,99,235,0.03)', borderRadius: 14, padding: '13px 14px',
              border: `1px solid rgba(37,99,235,0.2)`, display: 'flex', flexDirection: 'column', gap: 10,
              marginBottom: 14, textAlign: 'center',
            }}>
              {/* Header with Title & Selected Currency - Center Aligned */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  You Receive / Buy
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: '#2563EB', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{CURRENCY_META[toCurr]?.name || toCurr}</span>
                  <span style={{ fontSize: 16 }}>{CURRENCY_META[toCurr]?.flag || ''}</span>
                </div>
              </div>

              {/* Currency Selection Chips - Centered */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                {activeCurrenciesList.map((c) => (
                  <Chip
                    key={c}
                    active={toCurr === c}
                    onClick={() => setToCurr(c)}
                    style={{ padding: '4px 9px', fontSize: 11 }}
                  >
                    {c}
                  </Chip>
                ))}
              </div>

              {/* Quick Unit Suggestion Chips - Centered */}
              <div>
                <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>
                  Quick Suggestions
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {QUICK_SUGGESTIONS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setToAmount(String(amt))}
                      style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: Number(toAmount) === amt ? 'rgba(37,99,235,0.18)' : C.surface,
                        border: `1px solid ${Number(toAmount) === amt ? '#2563EB' : C.line}`,
                        color: Number(toAmount) === amt ? '#2563EB' : C.muted,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtAmount(amt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Units Received Input Box */}
              <div>
                <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>
                  Units Received ({toCurr}) *
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: C.surface, borderRadius: 12,
                  padding: '10px 14px', border: `1.5px solid ${buyTouched && !numToAmount ? '#B23A34' : C.line}`,
                }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 300"
                    value={toAmount ? formatWithCommas(toAmount) : ''}
                    onChange={(e) => setToAmount(parseCleanAmount(e.target.value))}
                    style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: MONO, fontSize: 16, fontWeight: 700, color: C.heading, textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#2563EB', whiteSpace: 'nowrap' }}>
                    {CURRENCY_META[toCurr]?.symbol || toCurr}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Net Official Rate & Money Changer Spread Display */}
            <div style={{
              background: 'rgba(37,99,235,0.05)', borderRadius: 14, padding: '12px 14px', marginBottom: 14,
              border: '1.5px solid rgba(37,99,235,0.2)',
            }}>
              {/* Current Net Official Rate */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
                  Current Net Market Rate
                </div>
                <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 800, color: C.heading }}>
                  1 {toCurr} = {fmtAmount(officialNetCrossRate)} {fromCurr}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10.5, color: C.muted, marginBottom: numFromAmount > 0 ? 8 : 0 }}>
                <span>1 {fromCurr} = {officialInverseRate < 0.01 ? officialInverseRate.toFixed(6) : officialInverseRate.toFixed(4)} {toCurr}</span>
                {fromCurr !== 'PKR' && (
                  <span>(1 {fromCurr} = Rs {fmtAmount(fromRatePkr)})</span>
                )}
              </div>

              {/* What fromAmount yields at net official rate */}
              {numFromAmount > 0 && (
                <div style={{
                  background: C.surface, borderRadius: 10, padding: '8px 10px', border: `1px solid ${C.line}`,
                  marginBottom: (numToAmount > 0) ? 8 : 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 700, textTransform: 'uppercase' }}>
                      Net Official Equivalent
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: '#2563EB', marginTop: 1 }}>
                      {fmtAmount(numFromAmount)} {fromCurr} = {fmtAmount(Number(officialNetYield.toFixed(2)))} {toCurr}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToAmount(Number(officialNetYield.toFixed(2)).toString())}
                    style={{
                      padding: '4px 8px', borderRadius: 8, background: 'rgba(37,99,235,0.12)',
                      border: '1px solid rgba(37,99,235,0.3)', color: '#2563EB', fontSize: 10.5,
                      fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    ⚡ Use Net Rate
                  </button>
                </div>
              )}

              {/* When both amounts are entered: Deal rate vs Spread across ALL currencies */}
              {numFromAmount > 0 && numToAmount > 0 && (
                <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 8, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Your Deal Rate:</span>
                    <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 800, color: C.heading }}>
                      1 {toCurr} = {fmtAmount(dealRate)} {fromCurr}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Money Changer Spread:</span>
                    <span style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: spreadPct > 0.05 ? '#B23A34' : spreadPct < -0.05 ? '#1E9E64' : C.heading,
                    }}>
                      {spreadPct > 0.05
                        ? `+${spreadPct.toFixed(2)}% Markup / Premium`
                        : spreadPct < -0.05
                        ? `${spreadPct.toFixed(2)}% Below Market`
                        : 'Exact Market Rate (0%)'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10.5, color: C.muted }}>
                    <span>Yield Difference:</span>
                    <span style={{ fontFamily: MONO, fontWeight: 700, color: unitDiff >= 0 ? '#1E9E64' : '#B23A34' }}>
                      {unitDiff >= 0 ? '+' : ''}{fmtAmount(Number(unitDiff.toFixed(2)))} {toCurr} ({spreadCostFromCurr >= 0 ? '+' : ''}{fmtAmount(Number(spreadCostFromCurr.toFixed(2)))} {fromCurr})
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Date Selection */}
            <SectionLabel>Conversion Date</SectionLabel>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {[
                { l: 'Today', d: 0 },
                { l: 'Yesterday', d: -1 },
                { l: '3 Days Ago', d: -3 },
                { l: '1 Week Ago', d: -7 },
              ].map((q) => (
                <button
                  key={q.l}
                  type="button"
                  onClick={() => setQuickDate(q.d, 'buy')}
                  style={{
                    padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: C.ice, border: `1px solid ${C.line}`, color: C.heading, cursor: 'pointer',
                  }}
                >
                  {q.l}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={buyDate}
              onChange={(e) => setBuyDate(e.target.value)}
              style={{
                width: '100%', border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px',
                fontSize: 13.5, marginBottom: 12, outline: 'none', color: C.heading, background: C.surface,
                boxSizing: 'border-box', fontFamily: SANS,
              }}
            />

            {/* Holding Source */}
            <SectionLabel>Holding Account / Stored In</SectionLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {HOLDING_SOURCES.map((s) => (
                <Chip key={s} active={holdingSource === s} onClick={() => setHoldingSource(s)} style={{ padding: '4px 9px', fontSize: 11 }}>
                  {s}
                </Chip>
              ))}
            </div>

            {/* Dealer & Notes */}
            <SectionLabel>Dealer / Money Changer / Notes (optional)</SectionLabel>
            <input
              type="text"
              value={dealerNote}
              onChange={(e) => setDealerNote(e.target.value)}
              placeholder="e.g. Airport Exchange, Mall Money Changer, Travel Trip…"
              style={{
                width: '100%', border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px',
                fontSize: 13, marginBottom: 14, outline: 'none', color: C.heading, background: C.surface,
                boxSizing: 'border-box', fontFamily: SANS,
              }}
            />

            {/* Sync with Vault Checkbox */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 9, background: C.ice, padding: '10px 12px',
              borderRadius: 12, border: `1px solid ${C.line}`, marginBottom: 16, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={syncVault}
                onChange={(e) => setSyncVault(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563EB' }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.heading, lineHeight: 1.3 }}>
                <strong>Sync with Vault Balance:</strong> Automatically record -{fromAmount || '0'} {fromCurr} and +{toAmount || '0'} {toCurr} in your accounts.
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSaveBuy}
              disabled={!canSaveBuy}
              style={{
                width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                background: canSaveBuy ? '#2563EB' : C.silver, color: '#fff', fontSize: 14.5,
                fontWeight: 700, cursor: canSaveBuy ? 'pointer' : 'default',
              }}
            >
              Save Conversion & Add to Holdings
            </button>
          </div>
        )}

        {/* TAB 2: SELL & REALIZE PROFIT / LOSS ------------------------- */}
        {tab === 'sell' && (
          <div>
            {openLots.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '30px 16px', background: C.ice, borderRadius: 16,
                border: `1px dashed ${C.line}`, marginBottom: 16,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.heading, marginBottom: 4 }}>
                  No Active Foreign Currency Holdings
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
                  Log a foreign currency purchase under "Convert / Buy" first to track sales and realized profit/loss.
                </div>
                <button
                  type="button"
                  onClick={() => setTab('convert')}
                  style={{
                    padding: '8px 16px', borderRadius: 10, background: '#2563EB', color: '#fff',
                    border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  + Add Currency Conversion
                </button>
              </div>
            ) : (
              <>
                {/* Select Holding Lot to Sell From */}
                <SectionLabel>Select Currency Holding Lot to Sell</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {openLots.map((lot) => {
                    const isSelected = activeLot?.id === lot.id;
                    const units = lot.remainingUnits != null ? lot.remainingUnits : lot.toAmount;
                    const buyRate = lot.rateAtDeal || (lot.fromAmount / lot.toAmount);
                    return (
                      <div
                        key={lot.id}
                        onClick={() => {
                          setSelectedLotId(lot.id);
                          setSellUnits(String(units));
                        }}
                        style={{
                          padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                          border: `1.5px solid ${isSelected ? '#2563EB' : C.line}`,
                          background: isSelected ? 'rgba(37,99,235,0.06)' : C.surface,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          transition: 'all .15s ease',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: C.heading }}>
                            {fmtAmount(units)} {lot.toCurrency}
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginLeft: 6 }}>
                              (Bought @ Rs {fmtAmount(buyRate)}/{lot.toCurrency})
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: C.muted }}>
                            Date: {lot.date} {lot.note ? `· ${lot.note}` : ''}
                          </div>
                        </div>

                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          border: `2px solid ${isSelected ? '#2563EB' : C.silver}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isSelected ? '#2563EB' : 'transparent',
                        }}>
                          {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sell Units & Received Proceeds with Suggestions */}
                <div style={{ marginBottom: 12 }}>
                  {/* Units to Sell */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <SectionLabel style={{ margin: 0 }}>Units to Sell ({activeLot?.toCurrency || 'EUR'}) *</SectionLabel>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {QUICK_SUGGESTIONS.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setSellUnits(String(amt))}
                            style={{
                              padding: '2px 7px', borderRadius: 6, fontSize: 10.5, fontWeight: 700,
                              background: Number(sellUnits) === amt ? 'rgba(178,58,52,0.14)' : C.ice,
                              border: `1px solid ${Number(sellUnits) === amt ? '#B23A34' : C.line}`,
                              color: Number(sellUnits) === amt ? '#B23A34' : C.muted,
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            {fmtAmount(amt)}
                          </button>
                        ))}
                        {activeLot && (
                          <button
                            type="button"
                            onClick={() => {
                              const avail = activeLot.remainingUnits != null ? activeLot.remainingUnits : activeLot.toAmount;
                              setSellUnits(String(avail));
                            }}
                            style={{
                              padding: '2px 7px', borderRadius: 6, fontSize: 10.5, fontWeight: 800,
                              background: 'rgba(37,99,235,0.12)', border: '1px solid #2563EB',
                              color: '#2563EB', cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            Max
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, background: C.ice, borderRadius: 12,
                      padding: '10px 12px', border: `1.5px solid ${sellTouched && !numSellUnits ? '#B23A34' : C.line}`,
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#B23A34' }}>
                        {CURRENCY_META[activeLot?.toCurrency || 'EUR']?.symbol || ''}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 300"
                        value={sellUnits ? formatWithCommas(sellUnits) : ''}
                        onChange={(e) => setSellUnits(parseCleanAmount(e.target.value))}
                        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: MONO, fontSize: 16, fontWeight: 700, color: C.heading }}
                      />
                    </div>
                  </div>

                  {/* Total Received */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <SectionLabel style={{ margin: 0 }}>Total Received ({receiveCurr}) *</SectionLabel>
                      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
                        {QUICK_SUGGESTIONS.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setReceiveAmount(String(amt))}
                            style={{
                              padding: '2px 7px', borderRadius: 6, fontSize: 10.5, fontWeight: 700,
                              background: Number(receiveAmount) === amt ? 'rgba(30,158,100,0.14)' : C.ice,
                              border: `1px solid ${Number(receiveAmount) === amt ? '#1E9E64' : C.line}`,
                              color: Number(receiveAmount) === amt ? '#1E9E64' : C.muted,
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            {fmtAmount(amt)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, background: C.ice, borderRadius: 12,
                      padding: '10px 12px', border: `1.5px solid ${sellTouched && !numReceiveAmount ? '#B23A34' : C.line}`,
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1E9E64' }}>
                        {CURRENCY_META[receiveCurr]?.symbol || receiveCurr}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 105,000"
                        value={receiveAmount ? formatWithCommas(receiveAmount) : ''}
                        onChange={(e) => setReceiveAmount(parseCleanAmount(e.target.value))}
                        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: MONO, fontSize: 16, fontWeight: 700, color: C.heading }}
                      />
                    </div>
                  </div>
                </div>

                {/* Net Market Exit Rate & Auto-fill Info */}
                <div style={{
                  background: 'rgba(37,99,235,0.05)', borderRadius: 12, padding: '10px 12px', marginBottom: 12,
                  border: '1px solid rgba(37,99,235,0.2)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      Current Net Market Exit:
                      <span style={{ fontFamily: MONO, fontWeight: 700, color: C.heading, marginLeft: 4 }}>
                        1 {sellLotCurr} = {fmtAmount(sellOfficialCrossRate)} {receiveCurr}
                      </span>
                    </div>
                    {numSellUnits > 0 && (
                      <button
                        type="button"
                        onClick={() => setReceiveAmount(Number(sellOfficialNetProceeds.toFixed(2)).toString())}
                        style={{
                          padding: '3px 8px', borderRadius: 7, background: 'rgba(37,99,235,0.12)',
                          border: '1px solid rgba(37,99,235,0.3)', color: '#2563EB', fontSize: 10.5,
                          fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        ⚡ Use Net ({fmtAmount(Number(sellOfficialNetProceeds.toFixed(0)))})
                      </button>
                    )}
                  </div>
                </div>

                {/* Realized Profit & Loss Breakdown Card */}
                {numSellUnits > 0 && numReceiveAmount > 0 && (
                  <div style={{
                    background: realizedPnl >= 0 ? 'rgba(30,158,100,0.08)' : 'rgba(178,58,52,0.08)',
                    borderRadius: 14, padding: '14px', marginBottom: 14,
                    border: `1.5px solid ${realizedPnl >= 0 ? 'rgba(30,158,100,0.3)' : 'rgba(178,58,52,0.3)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: realizedPnl >= 0 ? '#1E9E64' : '#B23A34', textTransform: 'uppercase' }}>
                        {realizedPnl >= 0 ? '🎉 Realized Profit (Nafa)' : '⚠️ Realized Loss (Nuqsan)'}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: realizedPnl >= 0 ? '#1E9E64' : '#B23A34' }}>
                        {realizedPnl >= 0 ? '+' : ''}{fmtMoney(realizedPnl, receiveCurr)} ({realizedPnl >= 0 ? '+' : ''}{realizedPnlPct.toFixed(2)}%)
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: C.navySoft }}>
                      <div>
                        Original Cost: <strong>Rs {fmtAmount(costOfSoldUnits)}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        Sold At: <strong>Rs {fmtAmount(exitDealRate)}/{activeLot?.toCurrency}</strong>
                      </div>
                      <div>
                        Bought At: <strong>Rs {fmtAmount(lotBuyRate)}/{activeLot?.toCurrency}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        Rate Spread: <strong style={{ color: rateGainPerUnit >= 0 ? '#1E9E64' : '#B23A34' }}>
                          {rateGainPerUnit >= 0 ? '+' : ''}Rs {rateGainPerUnit.toFixed(2)} per unit
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sale Date */}
                <SectionLabel>Sale / Exchange Date</SectionLabel>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', paddingBottom: 2 }}>
                  {[
                    { l: 'Today', d: 0 },
                    { l: 'Yesterday', d: -1 },
                    { l: '3 Days Ago', d: -3 },
                  ].map((q) => (
                    <button
                      key={q.l}
                      type="button"
                      onClick={() => setQuickDate(q.d, 'sell')}
                      style={{
                        padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: C.ice, border: `1px solid ${C.line}`, color: C.heading, cursor: 'pointer',
                      }}
                    >
                      {q.l}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={sellDate}
                  onChange={(e) => setSellDate(e.target.value)}
                  style={{
                    width: '100%', border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px',
                    fontSize: 13.5, marginBottom: 12, outline: 'none', color: C.heading, background: C.surface,
                    boxSizing: 'border-box', fontFamily: SANS,
                  }}
                />

                {/* Notes */}
                <SectionLabel>Sale Notes (optional)</SectionLabel>
                <input
                  type="text"
                  value={saleNote}
                  onChange={(e) => setSaleNote(e.target.value)}
                  placeholder="e.g. Sold to Money Changer, converted back after trip…"
                  style={{
                    width: '100%', border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px',
                    fontSize: 13, marginBottom: 14, outline: 'none', color: C.heading, background: C.surface,
                    boxSizing: 'border-box', fontFamily: SANS,
                  }}
                />

                {/* Sync with Vault Checkbox */}
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 9, background: C.ice, padding: '10px 12px',
                  borderRadius: 12, border: `1px solid ${C.line}`, marginBottom: 16, cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={syncSaleVault}
                    onChange={(e) => setSyncSaleVault(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#1E9E64' }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.heading, lineHeight: 1.3 }}>
                    <strong>Sync with Vault:</strong> Deduct {sellUnits || '0'} {activeLot?.toCurrency || 'EUR'} and credit +{receiveAmount || '0'} {receiveCurr} into your account.
                  </span>
                </label>

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleSaveSell}
                  disabled={!canSaveSell}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                    background: canSaveSell ? (realizedPnl >= 0 ? '#1E9E64' : '#B23A34') : C.silver,
                    color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: canSaveSell ? 'pointer' : 'default',
                  }}
                >
                  Log Sale & Realize P&L ({realizedPnl >= 0 ? '+' : ''}{fmtMoney(realizedPnl, receiveCurr)})
                </button>
              </>
            )}
          </div>
        )}

        {/* TAB 3: PORTFOLIO & P&L HISTORY ------------------------------ */}
        {tab === 'history' && (
          <div>
            {/* Top Portfolio Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <div style={{
                background: C.ice, padding: '10px 12px', borderRadius: 12, border: `1px solid ${C.line}`,
              }}>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase' }}>
                  Active Holdings Cost
                </div>
                <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: C.heading, marginTop: 2 }}>
                  Rs {fmtAmount(totalOpenCost)}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                  Live Value: Rs {fmtAmount(totalOpenMarketVal)}
                </div>
              </div>

              <div style={{
                background: totalUnrealizedPnl >= 0 ? 'rgba(30,158,100,0.08)' : 'rgba(178,58,52,0.08)',
                padding: '10px 12px', borderRadius: 12, border: `1px solid ${totalUnrealizedPnl >= 0 ? 'rgba(30,158,100,0.25)' : 'rgba(178,58,52,0.25)'}`,
              }}>
                <div style={{ fontSize: 10, color: totalUnrealizedPnl >= 0 ? '#1E9E64' : '#B23A34', fontWeight: 700, textTransform: 'uppercase' }}>
                  Unrealized Live P&L
                </div>
                <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: totalUnrealizedPnl >= 0 ? '#1E9E64' : '#B23A34', marginTop: 2 }}>
                  {totalUnrealizedPnl >= 0 ? '+' : ''}Rs {fmtAmount(totalUnrealizedPnl)}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: totalUnrealizedPnl >= 0 ? '#1E9E64' : '#B23A34', marginTop: 2 }}>
                  {totalUnrealizedPnl >= 0 ? '+' : ''}{totalUnrealizedPct.toFixed(2)}% vs today
                </div>
              </div>
            </div>

            {/* Total Realized Closed P&L Banner */}
            {closedTrades.length > 0 && (
              <div style={{
                background: totalRealizedPnl >= 0 ? 'rgba(30,158,100,0.1)' : 'rgba(178,58,52,0.1)',
                borderRadius: 12, padding: '10px 14px', marginBottom: 16,
                border: `1px solid ${totalRealizedPnl >= 0 ? '#1E9E6433' : '#B23A3433'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: totalRealizedPnl >= 0 ? '#1E9E64' : '#B23A34', textTransform: 'uppercase' }}>
                    Total Realized Net Profit / Loss
                  </div>
                  <div style={{ fontSize: 10.5, color: C.muted }}>
                    From {closedTrades.length} completed conversion trade{closedTrades.length > 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800, color: totalRealizedPnl >= 0 ? '#1E9E64' : '#B23A34' }}>
                  {totalRealizedPnl >= 0 ? '+' : ''}Rs {fmtAmount(totalRealizedPnl)}
                </div>
              </div>
            )}

            {/* Active Open Holdings Section */}
            <SectionLabel>Active Foreign Currency Lots ({openLots.length})</SectionLabel>
            {openLots.length === 0 ? (
              <div style={{ fontSize: 12, color: C.muted, padding: '12px 0', textAlign: 'center' }}>
                No open currency lots.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {openLots.map((lot) => {
                  const units = lot.remainingUnits != null ? lot.remainingUnits : lot.toAmount;
                  const buyRate = lot.rateAtDeal || (lot.fromAmount / lot.toAmount);
                  const costPkr = units * buyRate;
                  const liveRate = settings?.rates?.[lot.toCurrency] || 1;
                  const liveValPkr = units * liveRate;
                  const unPnl = liveValPkr - costPkr;
                  const unPct = costPkr > 0 ? (unPnl / costPkr) * 100 : 0;

                  return (
                    <div
                      key={lot.id}
                      style={{
                        background: C.surface, borderRadius: 14, padding: '12px 14px',
                        border: `1px solid ${C.line}`, boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 16 }}>{CURRENCY_META[lot.toCurrency]?.flag || '🌐'}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: C.heading }}>
                            {fmtAmount(units)} {lot.toCurrency}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                          background: unPnl >= 0 ? 'rgba(30,158,100,0.12)' : 'rgba(178,58,52,0.12)',
                          color: unPnl >= 0 ? '#1E9E64' : '#B23A34',
                        }}>
                          {unPnl >= 0 ? '+' : ''}Rs {fmtAmount(unPnl)} ({unPnl >= 0 ? '+' : ''}{unPct.toFixed(1)}%)
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: C.muted, marginBottom: 8 }}>
                        <div>Cost: Rs {fmtAmount(costPkr)} (@ Rs {fmtAmount(buyRate)}/{lot.toCurrency})</div>
                        <div style={{ textAlign: 'right' }}>Today: Rs {fmtAmount(liveRate)}/{lot.toCurrency}</div>
                        <div>Date: {lot.date}</div>
                        <div style={{ textAlign: 'right' }}>{lot.holdingSource}</div>
                      </div>

                      {lot.note && (
                        <div style={{ fontSize: 11, color: C.navySoft, marginBottom: 8, fontStyle: 'italic' }}>
                          Note: {lot.note}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleSelectLotForSell(lot)}
                          className="vlf-hover"
                          style={{
                            flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none',
                            background: '#2563EB', color: '#fff', fontSize: 11.5, fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          }}
                        >
                          <TrendingUp size={13} /> Sell & Realize P&L
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteExchange(lot.id)}
                          className="vlf-hover"
                          style={{
                            padding: '7px 10px', borderRadius: 8, border: '1px solid #7A2E2E33',
                            background: C.surface, color: '#7A2E2E', fontSize: 11.5, fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Closed Realized Sales Section */}
            {closedTrades.length > 0 && (
              <>
                <SectionLabel>Closed Trades & Realized P&L History ({closedTrades.length})</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {closedTrades.map((tr) => (
                    <div
                      key={tr.id}
                      style={{
                        background: C.surface, borderRadius: 12, padding: '11px 13px',
                        border: `1px solid ${C.line}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.heading }}>
                          Sold {fmtAmount(tr.fromAmount)} {tr.fromCurrency} ➔ {fmtMoney(tr.toAmount, tr.toCurrency)}
                        </div>
                        <span style={{
                          fontFamily: MONO, fontSize: 12, fontWeight: 800,
                          color: (tr.realizedPnlPkr || 0) >= 0 ? '#1E9E64' : '#B23A34',
                        }}>
                          {(tr.realizedPnlPkr || 0) >= 0 ? '+' : ''}{fmtMoney(tr.realizedPnlPkr || 0, tr.toCurrency)}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10.5, color: C.muted }}>
                        <div>Sold on: {tr.date}</div>
                        <div style={{ textAlign: 'right' }}>
                          P&L: <strong>{(tr.realizedPnlPct || 0) >= 0 ? '+' : ''}{(tr.realizedPnlPct || 0).toFixed(2)}%</strong>
                        </div>
                        <div>
                          Bought @ Rs {fmtAmount(tr.costBasisPerUnit || 0)}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          Sold @ Rs {fmtAmount(tr.rateAtDeal || 0)}
                        </div>
                      </div>

                      {tr.note && (
                        <div style={{ fontSize: 10.5, color: C.navySoft, marginTop: 4 }}>
                          {tr.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
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

function CalculatorScreen({ settings, onSaveEntry, onOpenAddEntry, saving, ratesLoading, onRefreshRates, currencies = CURRENCIES }) {
  const C = useColors();
  const activeCurrenciesList = currencies && currencies.length ? currencies : CURRENCIES;
  const [mode, setMode] = useState('basic');
  const [currency, setCurrency] = useState(settings.lastCurrency || 'PKR');
  const [input, setInput] = useState('');
  const [historyExpr, setHistoryExpr] = useState('');
  const [result, setResult] = useState(null);
  const [justCalculated, setJustCalculated] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [calcCopied, setCalcCopied] = useState(false);
  const [calcPasted, setCalcPasted] = useState(false);

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

  const handleCopyCalc = useCallback(() => {
    const valToCopy = result !== null ? String(result) : (safeEval(input) !== null ? String(safeEval(input)) : (input || '0'));
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(valToCopy);
      setCalcCopied(true);
      setTimeout(() => setCalcCopied(false), 1500);
    }
  }, [result, input]);

  const handlePasteCalc = useCallback(async (clipboardText = null) => {
    try {
      let text = clipboardText;
      if (text == null && navigator?.clipboard?.readText) {
        text = await navigator.clipboard.readText();
      }
      if (!text) return;
      // Clean up text: remove commas, convert unicode operators
      let clean = text.replace(/,/g, '').trim();
      clean = clean.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
      // Keep only arithmetic characters
      clean = clean.replace(/[^0-9+\-*/.() ]/g, '');
      if (clean) {
        const uiClean = clean.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
        setInput(uiClean);
        setHistoryExpr('');
        const ev = safeEval(clean);
        if (ev !== null) {
          setResult(Number(ev.toFixed(6)));
        } else {
          setResult(null);
        }
        setJustCalculated(false);
        setCalcPasted(true);
        setTimeout(() => setCalcPasted(false), 1500);
      }
    } catch (e) {
      console.warn('Paste failed', e);
    }
  }, []);

  // Keyboard and Paste support (desktop & mobile) - only for basic/currency modes
  useEffect(() => {
    if (mode === 'convert') return;
    const KEY_MAP = { '+': '+', '-': '−', '*': '×', '/': '÷' };
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        handleCopyCalc();
        return;
      }
      if (/^[0-9]$/.test(e.key)) { press(e.key); return; }
      if (e.key === '.') { press('.'); return; }
      if (KEY_MAP[e.key]) { e.preventDefault(); press(KEY_MAP[e.key]); return; }
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); press('='); return; }
      if (e.key === 'Backspace') { e.preventDefault(); press('⌫'); return; }
      if (e.key === 'Escape' || e.key.toLowerCase() === 'c') { press('C'); return; }
    };

    const pasteHandler = (e) => {
      const pasted = e.clipboardData?.getData('text');
      if (pasted) {
        e.preventDefault();
        handlePasteCalc(pasted);
      }
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('paste', pasteHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('paste', pasteHandler);
    };
  }, [press, mode, handleCopyCalc, handlePasteCalc]);

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

          {/* Quick Preset Amount Chips & Paste/Clear Actions */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 14, alignItems: 'center' }}>
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
              onClick={async () => {
                if (navigator?.clipboard?.readText) {
                  try {
                    const text = await navigator.clipboard.readText();
                    const clean = parseCleanAmount(text);
                    if (clean) setConvertInput(clean);
                  } catch (e) {
                    console.warn('Paste failed', e);
                  }
                }
              }}
              className="vlf-hover"
              title="Paste amount from clipboard"
              style={{
                padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                border: `1px solid ${C.line}`, background: `${C.navy}10`, color: C.navy,
                cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <ClipboardPaste size={12} /> Paste
            </button>
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
            {activeCurrenciesList.map((c) => {
              const isBase = activeConvertCurrency === c;
              const convertedNum = isBase ? numericConvertValue : fromBase(baseConvertPkr, c, settings.rates);
              const displayVal = isBase ? (convertInput ? formatWithCommas(convertInput) : '') : (convertInput === '' ? '' : fmtAmount(convertedNum));
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
                          const sanitized = parseCleanAmount(e.target.value);
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
                {activeCurrenciesList.map((c) => (
                  <div key={c} className="vlf-currency-item" onClick={() => setCurrency(c)}>
                    <div className="vlf-currency-icon-wrap" style={{ borderColor: currency === c ? C.navy : 'transparent' }}>
                      <CoinIcon currency={c} size={32} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Calculator Top Utility Bar: Quick Copy / Paste & Status */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 8, padding: '0 4px',
          }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
              {calcCopied ? (
                <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                  <Check size={13} /> Copied to clipboard!
                </span>
              ) : calcPasted ? (
                <span style={{ color: C.navy, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                  <Check size={13} /> Pasted from clipboard!
                </span>
              ) : (
                <span>Use shortcuts (Ctrl+C / Ctrl+V) or buttons</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={handleCopyCalc}
                title="Copy current expression or result"
                className="vlf-hover"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 9px', borderRadius: 8,
                  border: `1px solid ${calcCopied ? '#059669' : C.line}`,
                  background: calcCopied ? 'rgba(5,150,105,0.1)' : C.surface,
                  color: calcCopied ? '#059669' : C.muted,
                  fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {calcCopied ? <CheckCheck size={12} /> : <Copy size={12} />}
                {calcCopied ? 'Copied' : 'Copy'}
              </button>

              <button
                type="button"
                onClick={() => handlePasteCalc()}
                title="Paste numbers or formula into calculator"
                className="vlf-hover"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 9px', borderRadius: 8,
                  border: `1px solid ${calcPasted ? C.navy : C.line}`,
                  background: calcPasted ? `${C.navy}14` : C.surface,
                  color: calcPasted ? C.navy : C.muted,
                  fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <ClipboardPaste size={12} />
                {calcPasted ? 'Pasted' : 'Paste'}
              </button>
            </div>
          </div>

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
              {/* Top Entry / History Formula (formatted with commas) */}
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
                  ? formatExpressionWithCommas(historyExpr)
                  : (input ? formatExpressionWithCommas(input) : (result !== null ? fmtCalcAmount(result) : '\u00A0'))}
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
                  : (input ? (safeEval(input) !== null ? fmtCalcAmount(safeEval(input)) : formatExpressionWithCommas(input)) : '0')}
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
/* Profile Menu & Workspace Switcher Header Dropdown                  */
/* ------------------------------------------------------------------ */

function ProfileMenu({
  profile,
  profiles = [],
  unreadNotificationsCount = 0,
  onOpenProfile,
  onOpenSettings,
  onOpenNotifications,
  onSwitchProfile,
  onSignOut,
}) {
  const C = useColors();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);
  const initials = (profile?.name || 'Vault').charAt(0).toUpperCase();

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(false);
  };

  return (
    <div
      ref={menuRef}
      style={{ position: 'relative' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={() => {
          setIsHovered(false);
          setOpen((v) => !v);
        }}
        className="vlf-hover"
        aria-label={profile?.name || 'Profile'}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: C.surface,
          border: `1.5px solid ${open ? C.navy : C.line}`,
          borderRadius: '50%',
          width: 36,
          height: 36,
          padding: 0,
          cursor: 'pointer',
          boxShadow: open ? '0 0 0 3px rgba(20,17,13,0.1)' : '0 1px 3px rgba(20,17,13,0.06)',
          transition: 'all .15s ease',
        }}
      >
        {/* Profile Avatar circle */}
        <div style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${C.navy}, ${C.navySoft})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 12.5,
          fontWeight: 800,
          flexShrink: 0,
        }}>
          {profile?.avatar ? (
            <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {unreadNotificationsCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -3,
            right: -3,
            fontSize: 9,
            fontWeight: 800,
            padding: '1px 5px',
            borderRadius: 6,
            background: C.navy,
            color: '#fff',
            border: `1.5px solid ${C.surface}`,
          }}>
            {unreadNotificationsCount}
          </span>
        )}
      </button>

      {/* Smooth Hover Tooltip (showing name below the avatar with smooth fade and subtle slide) */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: '50%',
          transform: isHovered && !open
            ? 'translateX(-50%) translateY(0px)'
            : 'translateX(-50%) translateY(-4px)',
          opacity: isHovered && !open ? 1 : 0,
          visibility: isHovered && !open ? 'visible' : 'hidden',
          transition: 'opacity 0.22s ease, transform 0.22s ease, visibility 0.22s ease',
          background: C.navy,
          color: '#fff',
          padding: '5px 11px',
          borderRadius: 8,
          fontSize: 11.5,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 70,
          boxShadow: '0 6px 16px rgba(0,0,0,0.22)',
        }}
      >
        {profile?.name || 'Personal Vault'}
        {/* Tooltip top arrow */}
        <div
          style={{
            position: 'absolute',
            top: -4,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderBottom: `4px solid ${C.navy}`,
          }}
        />
      </div>

      {/* Dropdown Menu */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 240,
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: 16,
            boxShadow: '0 10px 28px rgba(20,17,13,0.18)',
            padding: '8px',
            zIndex: 60,
            fontFamily: SANS,
          }}
        >
          {/* Header with profile info — Clickable directly to open Profile */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (onOpenProfile) onOpenProfile();
            }}
            className="vlf-hover"
            style={{
              width: '100%',
              padding: '10px 10px',
              border: `1.5px solid ${C.navy}22`,
              borderRadius: 12,
              background: `${C.navy}08`,
              marginBottom: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 9,
              textAlign: 'left',
              transition: 'all .15s ease',
            }}
            title="Click to view and edit profile"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                overflow: 'hidden',
                background: `linear-gradient(135deg, ${C.navy}, ${C.navySoft})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
                border: `1.5px solid ${C.silver}`,
                flexShrink: 0,
              }}>
                {profile?.avatar ? (
                  <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.name || 'Personal Vault'}
                </div>
                <div style={{ fontSize: 10.5, color: C.navy, fontWeight: 700 }}>
                  Tap to edit profile →
                </div>
              </div>
            </div>
            <ChevronRight size={15} color={C.navy} />
          </button>

          {/* Notifications Link (Replacing Trash) */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (onOpenNotifications) onOpenNotifications();
            }}
            className="vlf-hover"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 10px',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: C.heading,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
              marginBottom: 2,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Bell size={16} color={C.steel} />
              <span>Notifications & Alerts</span>
            </div>
            {unreadNotificationsCount > 0 && (
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: C.navy, color: '#fff' }}>
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Settings Option Button */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (onOpenSettings) onOpenSettings('workspace');
            }}
            className="vlf-hover"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '9px 10px',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: C.heading,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
              marginBottom: 4,
            }}
          >
            <Settings size={16} color={C.steel} />
            <span>Settings</span>
          </button>

          {/* Switch Workspaces Section if multiple */}
          {profiles && profiles.length > 1 && (
            <div style={{ marginBottom: 6, padding: '4px 0', borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase', padding: '4px 10px', letterSpacing: '0.05em' }}>
                Switch Workspace
              </div>
              {profiles.map((p) => {
                const isActive = p.id === profile?.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (onSwitchProfile) onSwitchProfile(p.id);
                      setOpen(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: isActive ? `${C.navy}10` : 'transparent',
                      color: isActive ? C.navy : C.heading,
                      fontSize: 12,
                      fontWeight: isActive ? 800 : 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    {isActive && <Check size={13} color={C.steel} />}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ height: 1, background: C.line, margin: '5px 0' }} />

          {/* Sign Out */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (onSignOut) onSignOut();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#B23A34',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar — transparent, shrinks on scroll, houses profile menu      */
/* ------------------------------------------------------------------ */

function TopBar({
  screen,
  setScreen,
  onOpenProfile,
  onOpenSettings,
  onOpenNotifications,
  onSignOut,
  onAddEntry,
  profile,
  profiles = [],
  unreadNotificationsCount = 0,
  onSwitchProfile,
}) {
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
          <ProfileMenu
            profile={profile}
            profiles={profiles}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenProfile={onOpenProfile}
            onOpenSettings={onOpenSettings}
            onOpenNotifications={onOpenNotifications}
            onSwitchProfile={onSwitchProfile}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [splashActive, setSplashActive] = useState(true);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [onboardingName, setOnboardingName] = useState('');
  const [session, setSession] = useState(undefined);
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [profiles, setProfiles] = useState(DEFAULT_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState('default');
  const [trashEntries, setTrashEntries] = useState([]);
  const [settingsTab, setSettingsTab] = useState('workspace');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [reminderSheetOpen, setReminderSheetOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [exchanges, setExchanges] = useState([]);
  const [exchangeSheetOpen, setExchangeSheetOpen] = useState(false);
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
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferInitialData, setTransferInitialData] = useState(null);
  const [auditModalEntry, setAuditModalEntry] = useState(null);

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

      // Load saved workspaces / profiles & trash
      let loadedProfiles = DEFAULT_PROFILES;
      let loadedActiveId = 'default';
      let loadedTrash = [];
      try {
        const localProfiles = localStorage.getItem(`vaultify_profiles_${uidVal}`);
        if (localProfiles) {
          loadedProfiles = JSON.parse(localProfiles);
        } else if (settingsRow?.budget_limits?.profiles) {
          loadedProfiles = settingsRow.budget_limits.profiles;
        }

        const localActive = localStorage.getItem(`vaultify_active_profile_${uidVal}`);
        if (localActive) {
          loadedActiveId = localActive;
        } else if (settingsRow?.budget_limits?.active_profile_id) {
          loadedActiveId = settingsRow.budget_limits.active_profile_id;
        }

        const localTrash = localStorage.getItem(`vaultify_trash_${uidVal}`);
        if (localTrash) {
          loadedTrash = JSON.parse(localTrash);
        } else if (settingsRow?.budget_limits?.trash) {
          loadedTrash = settingsRow.budget_limits.trash;
        }
      } catch (err) {
        console.error('Error loading profiles & trash:', err);
      }

      // Auto-purge trash entries older than 3 days
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const validTrash = (loadedTrash || []).filter((e) => {
        const delTime = e.deletedAtMs || (e.deletedAt ? new Date(e.deletedAt).getTime() : now);
        return now - delTime <= THREE_DAYS_MS;
      });

      setProfiles(loadedProfiles);
      setActiveProfileId(loadedActiveId);
      setTrashEntries(validTrash);

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

      // Load saved currency conversions & FX trades
      try {
        const localExchanges = localStorage.getItem(`vaultify_exchanges_${uidVal}`);
        if (localExchanges) {
          setExchanges(JSON.parse(localExchanges));
        } else if (settingsRow?.budget_limits?.exchanges) {
          setExchanges(settingsRow.budget_limits.exchanges);
        }
      } catch (err) {
        console.error('Error loading exchanges:', err);
      }

      // Check if user should see onboarding wizard:
      // - Startup wizard is ONLY for new signups who haven't completed setup.
      // - Regular sign-in with existing account goes straight to dashboard.
      // - If refreshed during onboarding before finishing, it stays in onboarding and restarts from step 1.
      const isNewSignupPending =
        sessionStorage.getItem('vlf_just_signed_up') === '1' ||
        localStorage.getItem(`vlf_pending_signup_${uidVal}`) === '1';

      const isExplicitlyOnboarded =
        settingsRow?.budget_limits?.onboarding_completed === true ||
        localStorage.getItem(`vlf_onboarded_${uidVal}`) === '1';

      const isNormalSignIn = sessionStorage.getItem('vlf_login_action') === 'signin' && !isNewSignupPending;
      const hasExistingData = entryRows && entryRows.length > 0;

      if (isNewSignupPending || (!isExplicitlyOnboarded && !isNormalSignIn && !hasExistingData)) {
        setOnboardingActive(true);
        const nameFromMeta =
          localStorage.getItem(`vlf_pending_onboarding_${uidVal}`) ||
          localStorage.getItem('vlf_pending_onboarding_name') ||
          session?.user?.user_metadata?.full_name ||
          '';
        if (nameFromMeta) {
          setOnboardingName(nameFromMeta);
        }
      } else {
        setOnboardingActive(false);
        try {
          localStorage.setItem(`vlf_onboarded_${uidVal}`, '1');
          localStorage.removeItem(`vlf_pending_signup_${uidVal}`);
        } catch (e) {}
      }

      setDataLoaded(true);

      const isStale = !current.ratesFetchedAt || Date.now() - new Date(current.ratesFetchedAt).getTime() > 6 * 60 * 60 * 1000;
      if (isStale) {
        const updated = await refreshRates(uidVal, current);
        setSettings(updated);
      }
    })();
  }, [session, refreshRates]);

  // Derived Active Profile & Enabled Currencies
  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.id === activeProfileId) || profiles[0] || DEFAULT_PROFILES[0];
  }, [profiles, activeProfileId]);

  const activeCurrencies = useMemo(() => {
    return (activeProfile?.enabledCurrencies && activeProfile.enabledCurrencies.length > 0)
      ? activeProfile.enabledCurrencies
      : CURRENCIES;
  }, [activeProfile]);

  const unreadNotificationsCount = useMemo(() => {
    let count = 0;
    const today = todayStr();
    (reminders || []).forEach((r) => {
      if (r.active && r.date <= today) count++;
    });
    if (trashEntries && trashEntries.length > 0) count++;
    return count;
  }, [reminders, trashEntries]);

  // Fallback active currency if disabled
  useEffect(() => {
    if (activeCurrencies && activeCurrencies.length > 0) {
      if (!activeCurrencies.includes(activeCurrency)) {
        setActiveCurrency(activeCurrencies[0]);
      }
      if (!activeCurrencies.includes(totalDisplay)) {
        setTotalDisplay(activeCurrencies[0]);
      }
      if (historyCurrency !== 'All' && !activeCurrencies.includes(historyCurrency)) {
        setHistoryCurrency('All');
      }
    }
  }, [activeCurrencies, activeCurrency, totalDisplay, historyCurrency]);

  const persistProfiles = useCallback(async (nextProfiles, nextActiveId) => {
    setProfiles(nextProfiles);
    const actId = nextActiveId || activeProfileId;
    if (nextActiveId) setActiveProfileId(nextActiveId);
    if (session?.user?.id) {
      const uidVal = session.user.id;
      try {
        localStorage.setItem(`vaultify_profiles_${uidVal}`, JSON.stringify(nextProfiles));
        localStorage.setItem(`vaultify_active_profile_${uidVal}`, actId);
      } catch (err) {
        console.error('Error saving profiles to localStorage:', err);
      }
      try {
        const currentLimits = settings.budgetLimits || {};
        await supabase.from('settings').upsert({
          user_id: uidVal,
          budget_limits: {
            ...currentLimits,
            profiles: nextProfiles,
            active_profile_id: actId,
            trash: trashEntries,
            reminders: reminders,
            exchanges: exchanges,
          },
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error saving profiles to Supabase:', err);
      }
    }
  }, [session, activeProfileId, settings, trashEntries, reminders, exchanges]);

  const persistTrash = useCallback(async (nextTrash) => {
    setTrashEntries(nextTrash);
    if (session?.user?.id) {
      const uidVal = session.user.id;
      try {
        localStorage.setItem(`vaultify_trash_${uidVal}`, JSON.stringify(nextTrash));
      } catch (err) {
        console.error('Error saving trash to localStorage:', err);
      }
      try {
        const currentLimits = settings.budgetLimits || {};
        await supabase.from('settings').upsert({
          user_id: uidVal,
          budget_limits: { ...currentLimits, trash: nextTrash, profiles, active_profile_id: activeProfileId },
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error saving trash to Supabase:', err);
      }
    }
  }, [session, settings, profiles, activeProfileId]);

  const handleUpdateProfile = (updatedProfile) => {
    const next = profiles.map((p) => (p.id === updatedProfile.id ? updatedProfile : p));
    persistProfiles(next, activeProfileId);
    setShowStamp(true);
    setTimeout(() => setShowStamp(false), 900);
  };

  const handleCreateProfile = (name, customCurrencies) => {
    const newP = {
      id: uid(),
      name: name.trim(),
      avatar: null,
      enabledCurrencies: (customCurrencies && customCurrencies.length > 0) ? customCurrencies : ['PKR', 'TRY', 'USD', 'EUR', 'GBP', 'USDT'],
    };
    const next = [...profiles, newP];
    persistProfiles(next, newP.id);
    setShowStamp(true);
    setTimeout(() => setShowStamp(false), 900);
  };

  const handleDeleteProfile = (profileId) => {
    if (profiles.length <= 1) return;
    const next = profiles.filter((p) => p.id !== profileId);
    const nextActive = activeProfileId === profileId ? next[0].id : activeProfileId;
    persistProfiles(next, nextActive);
  };

  const handleSwitchProfile = (profileId) => {
    setActiveProfileId(profileId);
    if (session?.user?.id) {
      try {
        localStorage.setItem(`vaultify_active_profile_${session.user.id}`, profileId);
      } catch (e) {}
    }
  };

  const persistSettings = useCallback(async (next, updatedCurrencies) => {
    setSettings(next);
    if (!session?.user?.id) return;
    const uidVal = session.user.id;

    let currentProfiles = profiles;
    if (updatedCurrencies && activeProfile) {
      currentProfiles = profiles.map((p) => (p.id === activeProfile.id ? { ...p, enabledCurrencies: updatedCurrencies } : p));
      setProfiles(currentProfiles);
      try {
        localStorage.setItem(`vaultify_profiles_${uidVal}`, JSON.stringify(currentProfiles));
      } catch (e) {}
    }

    const limitsToPersist = {
      ...(settings.budgetLimits || {}),
      ...(next.budgetLimits || {}),
      profiles: currentProfiles,
      active_profile_id: activeProfileId,
      trash: trashEntries,
      reminders: reminders,
      exchanges: exchanges,
    };
    if (next.budgetPeriod) limitsToPersist._period = next.budgetPeriod;

    await supabase.from('settings').upsert({
      user_id: uidVal,
      budget_limits: limitsToPersist,
      rates: next.rates,
      rates_fetched_at: next.ratesFetchedAt,
      display_currency: next.displayCurrency,
      last_currency: next.lastCurrency,
      theme: next.theme || 'light',
      prev_rates: next.prevRates,
      prev_rates_date: next.prevRatesDate,
      updated_at: new Date().toISOString(),
    });
  }, [session, settings, profiles, activeProfile, activeProfileId, trashEntries, reminders, exchanges]);

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

  const persistExchanges = useCallback((nextList) => {
    setExchanges(nextList);
    if (session?.user?.id) {
      try {
        localStorage.setItem(`vaultify_exchanges_${session.user.id}`, JSON.stringify(nextList));
      } catch (err) {
        console.error('Error storing exchanges:', err);
      }
    }
  }, [session]);

  const handleSaveExchange = async (record, syncVault) => {
    const nextList = [record, ...exchanges];
    persistExchanges(nextList);
    setShowStamp(true);
    setTimeout(() => setShowStamp(false), 900);

    if (syncVault && session?.user?.id) {
      const uidVal = session.user.id;
      const debitEntry = {
        id: uid(),
        type: 'expense',
        amount: Number(record.fromAmount),
        currency: record.fromCurrency,
        category: 'Currency Exchange',
        holdingSource: record.holdingSource || 'Cash in Hand',
        note: `[FX Conversion Out] Sold ${fmtMoney(record.fromAmount, record.fromCurrency)} for ${fmtMoney(record.toAmount, record.toCurrency)} @ Rs ${fmtAmount(record.rateAtDeal)}/${record.toCurrency}${record.note ? ` · ${record.note}` : ''}`,
        date: record.date || todayStr(),
      };
      const creditEntry = {
        id: uid(),
        type: 'saving',
        amount: Number(record.toAmount),
        currency: record.toCurrency,
        category: 'Currency Exchange',
        holdingSource: record.holdingSource || 'Cash in Hand',
        note: `[FX Holding In] Bought ${fmtMoney(record.toAmount, record.toCurrency)} with ${fmtMoney(record.fromAmount, record.fromCurrency)} @ Rs ${fmtAmount(record.rateAtDeal)}/${record.toCurrency}${record.note ? ` · ${record.note}` : ''}`,
        date: record.date || todayStr(),
      };

      try {
        await supabase.from('entries').insert([
          { ...entryToDb(debitEntry), user_id: uidVal },
          { ...entryToDb(creditEntry), user_id: uidVal },
        ]);
        setEntries((prev) => [debitEntry, creditEntry, ...prev]);
      } catch (err) {
        console.error('Error syncing exchange entries:', err);
      }
    }
  };

  const handleCompleteSale = async (sellRecord, lotId, sellUnits, syncVault) => {
    let nextList = exchanges.map((e) => {
      if (e.id === lotId) {
        const currentUnits = e.remainingUnits != null ? e.remainingUnits : e.toAmount;
        const remaining = Math.max(0, currentUnits - sellUnits);
        return {
          ...e,
          remainingUnits: remaining,
          status: remaining <= 0 ? 'closed' : 'open',
        };
      }
      return e;
    });

    nextList = [sellRecord, ...nextList];
    persistExchanges(nextList);
    setShowStamp(true);
    setTimeout(() => setShowStamp(false), 900);

    if (syncVault && session?.user?.id) {
      const uidVal = session.user.id;
      const debitEntry = {
        id: uid(),
        type: 'expense',
        amount: Number(sellRecord.fromAmount),
        currency: sellRecord.fromCurrency,
        category: 'Currency Exchange',
        holdingSource: sellRecord.holdingSource || 'Cash in Hand',
        note: `[FX Sale Out] Sold ${fmtMoney(sellRecord.fromAmount, sellRecord.fromCurrency)} for ${fmtMoney(sellRecord.toAmount, sellRecord.toCurrency)}${sellRecord.note ? ` · ${sellRecord.note}` : ''}`,
        date: sellRecord.date || todayStr(),
      };
      const isProfit = (sellRecord.realizedPnlPkr || 0) >= 0;
      const creditEntry = {
        id: uid(),
        type: 'income',
        amount: Number(sellRecord.toAmount),
        currency: sellRecord.toCurrency,
        category: isProfit ? 'Forex Return / Capital Gain' : 'Currency Exchange',
        holdingSource: sellRecord.holdingSource || 'Cash in Hand',
        note: `[FX Realized Proceeds] Sold ${fmtMoney(sellRecord.fromAmount, sellRecord.fromCurrency)} @ Rs ${fmtAmount(sellRecord.rateAtDeal)}/${sellRecord.fromCurrency} (P&L: ${isProfit ? '+' : ''}${fmtMoney(sellRecord.realizedPnlPkr || 0, sellRecord.toCurrency)})${sellRecord.note ? ` · ${sellRecord.note}` : ''}`,
        date: sellRecord.date || todayStr(),
      };

      try {
        await supabase.from('entries').insert([
          { ...entryToDb(debitEntry), user_id: uidVal },
          { ...entryToDb(creditEntry), user_id: uidVal },
        ]);
        setEntries((prev) => [debitEntry, creditEntry, ...prev]);
      } catch (err) {
        console.error('Error syncing sale entries:', err);
      }
    }
  };

  const handleDeleteExchange = (exchangeId) => {
    const next = exchanges.filter((e) => e.id !== exchangeId);
    persistExchanges(next);
  };

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
      workspaceId: entryInput.workspaceId || activeProfileId || 'default',
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

  const handleExecuteInterWorkspaceTransfer = async ({
    fromProfileId,
    toProfileId,
    fromCurrency,
    toCurrency,
    fromAmount,
    toAmount,
    transferType,
    category,
    note,
    date,
  }) => {
    if (!session?.user?.id) return false;
    const uidVal = session.user.id;
    const xferId = uid();

    const fromProf = profiles.find((p) => p.id === fromProfileId) || { name: 'Source Vault' };
    const toProf = profiles.find((p) => p.id === toProfileId) || { name: 'Target Vault' };

    const debitEntry = {
      id: uid(),
      type: 'expense',
      amount: Number(fromAmount),
      currency: fromCurrency,
      category: category || 'Inter-Workspace Transfer',
      holdingSource: 'Cash in Hand',
      note: `[Inter-Workspace Debit] Sent to ${toProf.name}${note ? ` · ${note}` : ''}`,
      date: date || todayStr(),
      workspaceId: fromProfileId,
      rateAtEntry: fromCurrency !== 'PKR' ? (settings.rates[fromCurrency] ?? null) : null,
      crossTransfer: {
        id: xferId,
        sourceWorkspaceId: fromProfileId,
        sourceWorkspaceName: fromProf.name,
        targetWorkspaceId: toProfileId,
        targetWorkspaceName: toProf.name,
        role: 'source',
        counterpartAmount: Number(toAmount),
        counterpartCurrency: toCurrency,
      },
    };

    const creditEntry = {
      id: uid(),
      type: transferType || 'income',
      amount: Number(toAmount),
      currency: toCurrency,
      category: category || 'Inter-Workspace Allocation',
      holdingSource: 'Cash in Hand',
      note: `[Inter-Workspace Credit] Received from ${fromProf.name}${note ? ` · ${note}` : ''}`,
      date: date || todayStr(),
      workspaceId: toProfileId,
      rateAtEntry: toCurrency !== 'PKR' ? (settings.rates[toCurrency] ?? null) : null,
      crossTransfer: {
        id: xferId,
        sourceWorkspaceId: fromProfileId,
        sourceWorkspaceName: fromProf.name,
        targetWorkspaceId: toProfileId,
        targetWorkspaceName: toProf.name,
        role: 'target',
        counterpartAmount: Number(fromAmount),
        counterpartCurrency: fromCurrency,
      },
    };

    try {
      await supabase.from('entries').insert([
        { ...entryToDb(debitEntry), user_id: uidVal },
        { ...entryToDb(creditEntry), user_id: uidVal },
      ]);
      setEntries((prev) => [debitEntry, creditEntry, ...prev]);
      setShowStamp(true);
      setTimeout(() => setShowStamp(false), 900);
      return true;
    } catch (err) {
      console.error('Error executing inter-workspace transfer:', err);
      return false;
    }
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
    const target = entries.find((e) => e.id === id);
    if (target) {
      const trashItem = {
        ...target,
        deletedAt: new Date().toISOString(),
        deletedAtMs: Date.now(),
      };
      const nextTrash = [trashItem, ...trashEntries];
      persistTrash(nextTrash);
    }
    await supabase.from('entries').delete().eq('id', id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setSheetOpen(false);
    setEditingEntry(null);
  };

  const handleRestoreTrash = async (id) => {
    const target = trashEntries.find((e) => e.id === id);
    if (!target || !session) return;
    const { deletedAt, deletedAtMs, ...cleanEntry } = target;
    const uidVal = session.user.id;
    try {
      const dbPayload = entryToDb(cleanEntry);
      dbPayload.user_id = uidVal;
      await supabase.from('entries').insert(dbPayload);
      setEntries((prev) => [cleanEntry, ...prev]);
      const nextTrash = trashEntries.filter((e) => e.id !== id);
      persistTrash(nextTrash);
      setShowStamp(true);
      setTimeout(() => setShowStamp(false), 900);
    } catch (err) {
      console.error('Error restoring entry from trash:', err);
    }
  };

  const handleDeleteTrashPermanent = (id) => {
    const nextTrash = trashEntries.filter((e) => e.id !== id);
    persistTrash(nextTrash);
  };

  const handleEmptyTrash = () => {
    persistTrash([]);
  };

  const theme = settings.theme || 'light';
  const C = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;

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

  const handleImportData = useCallback(async ({ importedEntries, importedReminders, mode }) => {
    if (!session?.user?.id) return;
    const uidVal = session.user.id;
    setSaving(true);
    try {
      let finalEntries = [];
      if (mode === 'replace') {
        await supabase.from('entries').delete().eq('user_id', uidVal);
        finalEntries = importedEntries;
      } else {
        const existingKeys = new Set(
          entries.map((e) => `${e.date}_${e.amount}_${e.currency}_${e.type}_${(e.note || '').trim()}`)
        );
        const newEntries = importedEntries.filter(
          (e) => !existingKeys.has(`${e.date}_${e.amount}_${e.currency}_${e.type}_${(e.note || '').trim()}`)
        );
        finalEntries = [...newEntries, ...entries];
      }

      // Batch insert into database in chunks of 50
      const toInsert = mode === 'replace'
        ? importedEntries
        : importedEntries.filter((e) => !entries.some((ex) => ex.date === e.date && ex.amount === e.amount && ex.currency === e.currency && ex.type === e.type && (ex.note || '').trim() === (e.note || '').trim()));

      for (let i = 0; i < toInsert.length; i += 50) {
        const chunk = toInsert.slice(i, i + 50);
        const dbRows = chunk.map((e) => ({ ...entryToDb(e), user_id: uidVal }));
        if (dbRows.length > 0) {
          const { error } = await supabase.from('entries').insert(dbRows);
          if (error) {
            for (const row of dbRows) {
              await supabase.from('entries').insert(row);
            }
          }
        }
      }

      setEntries(finalEntries);

      // Process reminders if present
      if (importedReminders && importedReminders.length > 0) {
        let finalReminders = [];
        if (mode === 'replace') {
          finalReminders = importedReminders;
        } else {
          const existingTitles = new Set(reminders.map((r) => `${r.title.toLowerCase()}_${r.dueDate || ''}`));
          const newRem = importedReminders.filter((r) => !existingTitles.has(`${r.title.toLowerCase()}_${r.dueDate || ''}`));
          finalReminders = [...newRem, ...reminders];
        }
        persistReminders(finalReminders);
      }

      setShowStamp(true);
      setTimeout(() => setShowStamp(false), 900);
      return {
        success: true,
        count: toInsert.length,
        reminderCount: importedReminders?.length || 0,
      };
    } catch (err) {
      console.error('Import execution error:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [session, entries, reminders, persistReminders]);

  const handlePermanentDeleteAccount = async () => {
    if (!session?.user?.id) return;
    const uidVal = session.user.id;
    try {
      // 1. Delete all entries in database
      await supabase.from('entries').delete().eq('user_id', uidVal);
      // 2. Delete settings in database
      await supabase.from('settings').delete().eq('user_id', uidVal);
      // 3. Clear all local storage related to this user
      try {
        const keysToRemove = [
          `vaultify_profiles_${uidVal}`,
          `vaultify_active_profile_${uidVal}`,
          `vaultify_trash_${uidVal}`,
          `vaultify_reminders_${uidVal}`,
          `vaultify_exchanges_${uidVal}`,
          `vlf_onboarded_${uidVal}`,
          `vlf_pending_onboarding_${uidVal}`,
          `vlf_pending_signup_${uidVal}`,
          `vlf_onboarding_step_${uidVal}`,
        ];
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem('vlf_pending_onboarding_name');
        localStorage.removeItem('vlf_onboarding_step_temp');
        sessionStorage.setItem('vlf_account_deleted_banner', '1');
      } catch (e) {}

      // 4. Sign out completely
      await supabase.auth.signOut();
      setDeleteAccountOpen(false);
      setSettingsOpen(false);
      setProfileOpen(false);
    } catch (err) {
      console.error('Failed to permanently delete account data:', err);
      throw err;
    }
  };

  if (session === undefined) {
    return (
      <>
        {splashActive && <SplashScreen onComplete={() => setSplashActive(false)} />}
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: LIGHT_COLORS.ice, fontFamily: SERIF, color: LIGHT_COLORS.navy, fontSize: 20 }}>Vaultify</div>
      </>
    );
  }

  if (!session) {
    return (
      <>
        {splashActive && <SplashScreen onComplete={() => setSplashActive(false)} />}
        <AuthScreen
          onSignupSuccess={(name) => {
            setOnboardingName(name || '');
            setOnboardingActive(true);
          }}
        />
      </>
    );
  }

  if (!dataLoaded) {
    return (
      <>
        {splashActive && <SplashScreen onComplete={() => setSplashActive(false)} />}
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.ice, fontFamily: SERIF, color: C.heading, fontSize: 20 }}>Loading your vault…</div>
      </>
    );
  }

  if (onboardingActive) {
    return (
      <>
        {splashActive && <SplashScreen onComplete={() => setSplashActive(false)} />}
        <OnboardingWizard
          user={session?.user}
          initialName={onboardingName || session?.user?.user_metadata?.full_name || ''}
          currentTheme={theme}
          onComplete={async ({ vaultName, theme: chosenTheme, currencies, displayCurrency }) => {
            const uidVal = session.user.id;
            const updatedProfile = {
              ...activeProfile,
              name: vaultName,
              enabledCurrencies: currencies,
            };
            const nextProfiles = profiles.map((p) => (p.id === activeProfile.id ? updatedProfile : p));
            await persistProfiles(nextProfiles, activeProfile.id);

            const nextSettings = {
              ...settings,
              theme: chosenTheme,
              displayCurrency,
              lastCurrency: displayCurrency,
              budgetLimits: {
                ...(settings.budgetLimits || {}),
                onboarding_completed: true,
              },
            };
            await persistSettings(nextSettings);
            setActiveCurrency(displayCurrency);
            setTotalDisplay(displayCurrency);

            try {
              localStorage.setItem(`vlf_onboarded_${uidVal}`, '1');
              localStorage.removeItem(`vlf_pending_signup_${uidVal}`);
              sessionStorage.removeItem('vlf_just_signed_up');
              sessionStorage.removeItem('vlf_login_action');
              localStorage.removeItem(`vlf_pending_onboarding_${uidVal}`);
              localStorage.removeItem('vlf_pending_onboarding_name');
              localStorage.removeItem(`vlf_onboarding_step_${uidVal}`);
              localStorage.removeItem('vlf_onboarding_step_temp');
            } catch (e) {}

            setOnboardingActive(false);
            setShowStamp(true);
            setTimeout(() => setShowStamp(false), 1400);
          }}
        />
      </>
    );
  }

  return (
    <ThemeContext.Provider value={C}>
      {splashActive && <SplashScreen onComplete={() => setSplashActive(false)} />}
      <div style={{ background: C.ice, minHeight: '100vh', fontFamily: SANS }} data-theme={theme}>
        <div className="vlf-shell">
          <TopBar
            screen={screen}
            setScreen={setScreen}
            profile={activeProfile}
            profiles={profiles}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenSettings={(tab = 'workspace') => {
              setSettingsTab(tab);
              setSettingsOpen(true);
            }}
            onOpenNotifications={() => setNotificationsOpen(true)}
            onSwitchProfile={handleSwitchProfile}
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
            onTransferWorkspace={() => { setTransferInitialData(null); setTransferModalOpen(true); }}
            onExchange={() => setExchangeSheetOpen(true)}
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
                currencies={activeCurrencies}
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
                exchanges={exchanges}
                onOpenExchange={() => setExchangeSheetOpen(true)}
                onDeleteExchange={handleDeleteExchange}
              />
            )}
            {screen === 'history' && (
              <HistoryScreen
                entries={entries}
                settings={settings}
                currencies={activeCurrencies}
                initialCurrency={historyCurrency}
                onCurrencyChange={setHistoryCurrency}
                profiles={profiles}
                activeProfile={activeProfile}
                onOpenWorkspaceTransfer={() => { setTransferInitialData(null); setTransferModalOpen(true); }}
                onOpenCrossTransferAudit={(entry) => setAuditModalEntry(entry)}
                onEdit={(e) => requestPassword(() => { setEditingEntry(e); setSheetOpen(true); })}
              />
            )}
            {screen === 'networth' && (
              <NetWorthScreen
                entries={entries}
                settings={settings}
                currencies={activeCurrencies}
                onNavigateToHistory={(curr) => {
                  setHistoryCurrency(curr || 'All');
                  setScreen('history');
                }}
              />
            )}
            {screen === 'report' && (
              <ReportScreen
                entries={entries}
                reminders={reminders}
                requestPassword={requestPassword}
                onOpenImport={() => setImportOpen(true)}
              />
            )}
            {screen === 'calculator' && (
              <CalculatorScreen
                settings={settings}
                currencies={activeCurrencies}
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

          <EntrySheet
            open={sheetOpen}
            onClose={() => { setSheetOpen(false); setEditingEntry(null); }}
            onSave={handleSaveEntry}
            onDelete={(id) => requestPassword(() => handleDeleteEntry(id))}
            settings={settings}
            currencies={activeCurrencies}
            initial={editingEntry}
            saving={saving}
          />
          <ReminderSheet
            open={reminderSheetOpen}
            onClose={() => { setReminderSheetOpen(false); setEditingReminder(null); }}
            onSave={handleSaveReminder}
            onDelete={handleDeleteReminder}
            onPayAndAdd={handlePayAndLogReminder}
            settings={settings}
            initial={editingReminder}
          />
          <ExchangeSheet
            open={exchangeSheetOpen}
            onClose={() => setExchangeSheetOpen(false)}
            onSaveExchange={handleSaveExchange}
            onCompleteSale={handleCompleteSale}
            onDeleteExchange={handleDeleteExchange}
            exchanges={exchanges}
            settings={settings}
            entries={entries}
            currencies={activeCurrencies}
          />
          <SettingsSheet
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            settings={settings}
            onSave={(next, nextCurrencies) => {
              if (nextCurrencies && activeProfile) {
                handleUpdateProfile({ ...activeProfile, enabledCurrencies: nextCurrencies });
              }
              persistSettings(next, nextCurrencies);
              setSettingsOpen(false);
            }}
            onSignOut={async () => { await supabase.auth.signOut(); }}
            ratesLoading={ratesLoading}
            onRefreshRates={async () => { const updated = await refreshRates(session.user.id, settings); setSettings(updated); }}
            theme={theme}
            onThemeChange={handleThemeChange}
            userEmail={session.user.email}
            entries={entries}
            onClearMonth={(key) => requestPassword(() => handleClearMonth(key))}
            onClearAll={() => requestPassword(handleClearAll)}
            onOpenDeleteAccount={() => setDeleteAccountOpen(true)}
            profile={activeProfile}
            profiles={profiles}
            onUpdateProfile={handleUpdateProfile}
            onCreateProfile={handleCreateProfile}
            onDeleteProfile={handleDeleteProfile}
            onSwitchProfile={handleSwitchProfile}
            trashEntries={trashEntries}
            onRestoreTrash={handleRestoreTrash}
            onDeleteTrashPermanent={handleDeleteTrashPermanent}
            onEmptyTrash={handleEmptyTrash}
            initialTab={settingsTab}
            onOpenImport={() => setImportOpen(true)}
          />
          <ImportSheetModal
            open={importOpen}
            onClose={() => setImportOpen(false)}
            userEmail={session.user.email}
            onImport={handleImportData}
            defaultCurrency={settings.lastCurrency || 'PKR'}
          />
          <ProfileSheet
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            profile={activeProfile}
            userEmail={session.user.email}
            onUpdateProfile={handleUpdateProfile}
            onOpenSettings={() => {
              setProfileOpen(false);
              setSettingsTab('workspace');
              setSettingsOpen(true);
            }}
          />
          <NotificationsSheet
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
            entries={entries}
            settings={settings}
            reminders={reminders}
            trashEntries={trashEntries}
            profile={activeProfile}
            userEmail={session.user.email}
            ratesLoading={ratesLoading}
            onRefreshRates={async () => {
              const updated = await refreshRates(session.user.id, settings);
              setSettings(updated);
            }}
            onOpenSettings={(tab = 'workspace') => {
              setNotificationsOpen(false);
              setSettingsTab(tab);
              setSettingsOpen(true);
            }}
            onOpenReminders={() => {
              setNotificationsOpen(false);
              setReminderSheetOpen(true);
            }}
          />
          <DeleteAccountModal
            open={deleteAccountOpen}
            onClose={() => setDeleteAccountOpen(false)}
            onConfirmDelete={handlePermanentDeleteAccount}
            userEmail={session.user.email}
          />
          <PasswordGate open={!!pwGate} onClose={() => setPwGate(null)} userEmail={session.user.email}
            onConfirm={() => { const fn = pwGate; setPwGate(null); if (fn) fn(); }} />
          <InterWorkspaceTransferModal
            open={transferModalOpen}
            onClose={() => { setTransferModalOpen(false); setTransferInitialData(null); }}
            onExecuteTransfer={handleExecuteInterWorkspaceTransfer}
            profiles={profiles}
            activeProfile={activeProfile}
            onCreateProfile={() => {
              setSettingsTab('workspace');
              setSettingsOpen(true);
            }}
            currencies={activeCurrencies}
            settings={settings}
            userEmail={session.user.email}
            initialData={transferInitialData}
          />
          <TransferAuditModal
            open={!!auditModalEntry}
            onClose={() => setAuditModalEntry(null)}
            entry={auditModalEntry}
            profiles={profiles}
          />
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