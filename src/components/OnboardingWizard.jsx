import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Sun, Moon, ArrowRight, Check, Sparkles, Sliders, Banknote,
  CheckCircle2, FileSpreadsheet, Lock, HelpCircle
} from 'lucide-react';
import { DisclaimerGuide } from './DisclaimerGuide';

export function OnboardingWizard({
  open,
  userName = 'User',
  onFinish,
  onSkip,
  initialVaultName = 'Personal Vault',
  initialTheme = 'light',
  initialCurrencies = ['PKR', 'TRY', 'USD', 'EUR', 'GBP', 'USDT'],
  colors,
}) {
  const [step, setStep] = useState(1);
  const [vaultName, setVaultName] = useState(initialVaultName || 'Personal Vault');
  const [theme, setTheme] = useState(initialTheme || 'light');
  const [currencies, setCurrencies] = useState(initialCurrencies || ['PKR', 'TRY', 'USD', 'EUR', 'GBP', 'USDT']);
  const [welcomeMoved, setWelcomeMoved] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setWelcomeMoved(false);
      const timer = setTimeout(() => {
        setWelcomeMoved(true);
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    // When changing step, animate center to top
    setWelcomeMoved(false);
    const timer = setTimeout(() => {
      setWelcomeMoved(true);
    }, 1400);
    return () => clearTimeout(timer);
  }, [step]);

  if (!open) return null;

  const C = colors;

  const currencyOptions = [
    { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee', flag: '🇵🇰' },
    { code: 'TRY', symbol: '₺', name: 'Turkish Lira', flag: '🇹🇷' },
    { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
    { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
    { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
    { code: 'USDT', symbol: '₮', name: 'Tether USD', flag: '₮' },
  ];

  const toggleCurrency = (code) => {
    if (currencies.includes(code)) {
      if (currencies.length <= 1) return;
      setCurrencies(currencies.filter((c) => c !== code));
    } else {
      setCurrencies([...currencies, code]);
    }
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onFinish({
        vaultName: vaultName.trim() || 'Personal Vault',
        theme,
        currencies,
      });
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onFinish({
        vaultName: initialVaultName || 'Personal Vault',
        theme: initialTheme || 'light',
        currencies: initialCurrencies,
      });
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle at center, ${C.surface} 0%, ${C.ice} 100%)`,
        padding: 20,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: C.surface,
          borderRadius: 24,
          border: `1px solid ${C.line}`,
          boxShadow: '0 24px 60px rgba(20,17,13,0.18)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 480,
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
      >
        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: 6, padding: '16px 20px 0' }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: step >= s ? C.navy : `${C.line}`,
                transition: 'background .3s ease',
              }}
            />
          ))}
        </div>

        {/* Scrollable Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* ============================================================ */}
          {/* STEP 1: WELCOME & VAULT NAME SETUP                            */}
          {/* ============================================================ */}
          {step === 1 && (
            <div>
              {/* Animated Header */}
              <div
                style={{
                  textAlign: 'center',
                  marginBottom: 24,
                  transform: welcomeMoved ? 'translateY(0) scale(1)' : 'translateY(80px) scale(1.1)',
                  opacity: 1,
                  transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: `linear-gradient(135deg, ${C.navy}, ${C.navySoft})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    boxShadow: '0 8px 24px rgba(20,17,13,0.2)',
                  }}
                >
                  <ShieldCheck size={26} color="#fff" />
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: C.heading }}>
                  Welcome to Vaultify
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                  Let's configure your private multi-currency wealth sanctuary
                </div>
              </div>

              {welcomeMoved && (
                <div className="vlf-animate-fade-in">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: C.navySoft, display: 'block', marginBottom: 8 }}>
                    Name your Primary Vault:
                  </label>
                  <input
                    type="text"
                    required
                    value={vaultName}
                    onChange={(e) => setVaultName(e.target.value)}
                    placeholder="e.g. Personal Vault, Family Wealth"
                    style={{
                      width: '100%',
                      border: `1.5px solid ${C.line}`,
                      borderRadius: 12,
                      padding: '13px 14px',
                      fontSize: 15,
                      fontWeight: 600,
                      background: C.ice,
                      color: C.navySoft,
                      outline: 'none',
                      boxSizing: 'border-box',
                      marginBottom: 12,
                    }}
                  />

                  {/* Preset chips */}
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>
                    Quick suggestions:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                    {['Personal Vault', 'Family Assets', 'Freelance & Business', 'Crypto & Wealth'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setVaultName(preset)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 20,
                          border: `1px solid ${vaultName === preset ? C.navy : C.line}`,
                          background: vaultName === preset ? `${C.navy}12` : C.surface,
                          color: vaultName === preset ? C.navy : C.navySoft,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <div style={{
                    background: C.ice, border: `1px solid ${C.line}`, borderRadius: 12,
                    padding: '10px 12px', fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Sparkles size={14} color={C.steel} />
                    <span>You can create multiple isolated workspaces anytime in Settings.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2: WELCOME [NAME] & THEME SETUP                         */}
          {/* ============================================================ */}
          {step === 2 && (
            <div>
              {/* Animated Header */}
              <div
                style={{
                  textAlign: 'center',
                  marginBottom: 20,
                  transform: welcomeMoved ? 'translateY(0) scale(1)' : 'translateY(70px) scale(1.08)',
                  opacity: 1,
                  transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 23, fontWeight: 700, color: C.heading }}>
                  Welcome {userName || 'there'}, to Vaultify!
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                  Step 2 of 3: Choose your workspace theme
                </div>
              </div>

              {welcomeMoved && (
                <div className="vlf-animate-fade-in">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    {/* Light Theme Card */}
                    <div
                      onClick={() => setTheme('light')}
                      style={{
                        borderRadius: 16,
                        border: `2px solid ${theme === 'light' ? C.navy : C.line}`,
                        background: '#FAF7EF',
                        padding: 16,
                        cursor: 'pointer',
                        boxShadow: theme === 'light' ? '0 6px 20px rgba(20,17,13,0.12)' : 'none',
                        position: 'relative',
                        transition: 'all .2s ease',
                      }}
                    >
                      {theme === 'light' && (
                        <div style={{
                          position: 'absolute', top: 10, right: 10,
                          width: 20, height: 20, borderRadius: '50%', background: C.navy,
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <Sun size={18} color="#14110D" />
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#14110D' }}>Light Sand</div>
                      </div>
                      <div style={{ background: '#FFFFFF', borderRadius: 8, padding: 8, border: '1px solid rgba(20,17,13,0.08)' }}>
                        <div style={{ height: 6, width: '60%', background: '#14110D', borderRadius: 3, marginBottom: 4 }} />
                        <div style={{ height: 4, width: '40%', background: '#7A7265', borderRadius: 2 }} />
                      </div>
                    </div>

                    {/* Dark Theme Card */}
                    <div
                      onClick={() => setTheme('dark')}
                      style={{
                        borderRadius: 16,
                        border: `2px solid ${theme === 'dark' ? '#1F6F52' : C.line}`,
                        background: '#121217',
                        padding: 16,
                        cursor: 'pointer',
                        boxShadow: theme === 'dark' ? '0 6px 20px rgba(0,0,0,0.3)' : 'none',
                        position: 'relative',
                        transition: 'all .2s ease',
                      }}
                    >
                      {theme === 'dark' && (
                        <div style={{
                          position: 'absolute', top: 10, right: 10,
                          width: 20, height: 20, borderRadius: '50%', background: '#1F6F52',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <Moon size={18} color="#EFF4F1" />
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#EFF4F1' }}>Midnight Dark</div>
                      </div>
                      <div style={{ background: '#1A1A22', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ height: 6, width: '60%', background: '#EFF4F1', borderRadius: 3, marginBottom: 4 }} />
                        <div style={{ height: 4, width: '40%', background: '#7C8983', borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>
                    You can switch themes anytime in Settings or your profile menu.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 3: CURRENCIES & FEATURES DISCLAIMER                     */}
          {/* ============================================================ */}
          {step === 3 && (
            <div className="vlf-animate-fade-in">
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.heading }}>
                  Currencies & Features Overview
                </div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
                  Select the currencies you actively manage
                </div>
              </div>

              {/* Currency Toggle Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
                {currencyOptions.map((c) => {
                  const isEnabled = currencies.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => toggleCurrency(c.code)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 14,
                        border: `1.5px solid ${isEnabled ? C.navy : C.line}`,
                        background: isEnabled ? `${C.navy}10` : C.surface,
                        color: isEnabled ? C.navy : C.muted,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        cursor: 'pointer',
                        transition: 'all .15s ease',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{c.flag}</span>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>{c.code}</span>
                      <span style={{ fontSize: 10, opacity: 0.75 }}>{c.symbol}</span>
                    </button>
                  );
                })}
              </div>

              {/* What you can do summary guide */}
              <div style={{
                background: C.ice, border: `1px solid ${C.line}`, borderRadius: 16,
                padding: '14px 16px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.heading, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={15} color={C.steel} /> What you can do with Vaultify:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: C.navySoft }}>
                  <div>• <strong>Multi-Currency Net Worth:</strong> Automatic conversion to unified PKR total.</div>
                  <div>• <strong>Reminders & Bills:</strong> Due dates, recurring expenses & 1-click ledger logging.</div>
                  <div>• <strong>Currency FX Exchange:</strong> Track currency conversions and spreads accurately.</div>
                  <div>• <strong>Excel Backup & Import:</strong> Full offline backups with password protection.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation Bar */}
        <div
          style={{
            borderTop: `1px solid ${C.line}`,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: C.surface,
          }}
        >
          {/* Bottom-left: Skip option (text only) */}
          <button
            type="button"
            onClick={handleSkip}
            style={{
              background: 'none',
              border: 'none',
              color: C.muted,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 8px',
            }}
          >
            Skip
          </button>

          {/* Bottom-right: Next / Finish (Colored button) */}
          <button
            type="button"
            onClick={handleNext}
            style={{
              padding: '11px 22px',
              borderRadius: 12,
              border: 'none',
              background: `linear-gradient(135deg, ${C.navy}, ${C.navySoft})`,
              color: '#fff',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(20,17,13,0.2)',
            }}
          >
            <span>{step === 3 ? 'Open My Vault 🚀' : 'Next'}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
