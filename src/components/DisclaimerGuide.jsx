import React from 'react';
import {
  ShieldCheck, Banknote, Landmark, ArrowRightLeft, Bell, HelpCircle,
  FileSpreadsheet, Lock, Sparkles, Layers, Sliders, CheckCircle2, TrendingUp
} from 'lucide-react';

export function DisclaimerGuide({ colors, compact = false }) {
  const C = colors;

  const features = [
    {
      title: '1. Multi-Currency Wealth & Net Worth Tracking',
      icon: Banknote,
      color: '#1F6F52',
      what: 'Track finances across Pakistani Rupee (PKR), Turkish Lira (TRY), US Dollar (USD), Euro (EUR), British Pound (GBP), and Tether (USDT).',
      how: 'Every transaction is saved in its original currency and pegged with live conversion rates so your total Net Worth updates in real-time.',
      benefit: 'No manual exchange rate calculations; clear unified financial standing across borders.',
    },
    {
      title: '2. Isolated Workspaces & Profiles',
      icon: Layers,
      color: '#2563EB',
      what: 'Create separate, dedicated vaults (e.g. Personal Vault, Freelance Business, Crypto & Investments, Family).',
      how: 'Each workspace has its own enabled currencies, custom profile photo/avatar, and isolated ledger views.',
      benefit: 'Keep business transactions and personal finances organized without mixing balances.',
    },
    {
      title: '3. Budget Limits & Intelligent Spending Alerts',
      icon: Sliders,
      color: '#B23A34',
      what: 'Set weekly, monthly, or all-time spending thresholds per currency.',
      how: 'When entering an expense that exceeds your threshold, a warning dialog alerts you to review or override safely.',
      benefit: 'Prevents impulse overspending before it impacts your savings.',
    },
    {
      title: '4. Due Reminders, Bills & Auto-Deductions',
      icon: Bell,
      color: '#D97706',
      what: 'Schedule upcoming utilities, rent, credit card dues, and recurring income.',
      how: 'Mark reminders as paid with 1-click — Vaultify automatically logs the transaction into your active ledger.',
      benefit: 'Never miss a due date or forget recurring liabilities.',
    },
    {
      title: '5. FX Currency Exchange & Conversion Ledger',
      icon: ArrowRightLeft,
      color: '#059669',
      what: 'Log currency conversions and buying/selling foreign currency or crypto.',
      how: 'Debit the sold currency and credit the acquired currency with exact rates, fees, and profit/loss tracking.',
      benefit: 'Accurate holding source tracking across cash, local bank accounts, and crypto wallets.',
    },
    {
      title: '6. Untracked Cash Discrepancy Resolution',
      icon: HelpCircle,
      color: '#8B5CF6',
      what: 'Account for forgotten daily leaks, cash discrepancies, and unaccounted outflows.',
      how: 'Log untracked amounts under dedicated tags so your ledger reflects reality without breaking balance continuity.',
      benefit: 'Eliminates mysterious cash gaps in your wallet and reconciles balances.',
    },
    {
      title: '7. Full Excel Backup, Export & Password-Protected Import',
      icon: FileSpreadsheet,
      color: '#0D9488',
      what: 'Generate multi-sheet Excel reports (.xlsx) and restore full backups with 1-click.',
      how: 'Export includes All Entries, Reminders, and Currency Summaries. Importing verifies your password first and lets you Merge or Replace all data.',
      benefit: 'Your data is truly yours. Full offline backups, portability, and instant vault restoration anytime.',
    },
    {
      title: '8. Private Security & Re-Authentication Gates',
      icon: Lock,
      color: '#475569',
      what: 'High-security password confirmation before sensitive actions.',
      how: 'Deleting entries, clearing data, exporting sheets, or importing backups requires confirming your account password.',
      benefit: 'Protects against accidental deletions or unauthorized changes if your screen is left unlocked.',
    },
  ];

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      {/* Intro Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navySoft} 100%)`,
        borderRadius: 18, padding: compact ? '16px 18px' : '20px 22px',
        color: '#fff', marginBottom: 18, boxShadow: '0 8px 24px rgba(20,17,13,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700 }}>
              Vaultify Architecture & Features Guide
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.8 }}>
              Multi-Currency Wealth System · Privacy First · Offline Portable
            </div>
          </div>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.5, opacity: 0.9, margin: 0 }}>
          Vaultify provides institutional-grade personal wealth tracking. Here is a comprehensive overview of the core capabilities, how each workflow operates, and the benefits for managing your financial assets.
        </p>
      </div>

      {/* Feature Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {features.map((f, idx) => {
          const Icon = f.icon;
          return (
            <div
              key={idx}
              style={{
                background: C.surface, border: `1px solid ${C.line}`,
                borderRadius: 16, padding: compact ? 14 : 16,
                boxShadow: '0 2px 6px rgba(20,17,13,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: `${f.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={16} color={f.color} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.heading }}>
                  {f.title}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: C.navySoft, paddingLeft: 42 }}>
                <div>
                  <strong style={{ color: C.heading }}>What it does: </strong>
                  <span>{f.what}</span>
                </div>
                <div>
                  <strong style={{ color: C.heading }}>How it works: </strong>
                  <span style={{ color: C.muted }}>{f.how}</span>
                </div>
                <div style={{
                  background: C.ice, padding: '6px 10px', borderRadius: 8,
                  border: `1px solid ${C.line}`, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11.5,
                }}>
                  <CheckCircle2 size={13} color={f.color} style={{ flexShrink: 0 }} />
                  <span><strong>Benefit:</strong> {f.benefit}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Official Disclaimer Footer */}
      <div style={{
        background: C.ice, border: `1px solid ${C.line}`, borderRadius: 14,
        padding: '14px 16px', fontSize: 11.5, color: C.muted, lineHeight: 1.5,
      }}>
        <div style={{ fontWeight: 800, color: C.heading, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} color={C.steel} /> Important Note & Privacy Assurance
        </div>
        Vaultify does not connect directly to banking APIs or store sensitive financial credentials. All values and conversion benchmarks are calculated mathematically based on your recorded transactions and public mid-market currency rates. Your data remains completely private and exportable at any time.
      </div>
    </div>
  );
}
