import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';

export function SplashScreen({ onComplete }) {
  const [stage, setStage] = useState('center'); // 'center' -> 'moving' -> 'done'

  useEffect(() => {
    // Stage 1: Pulse in center for 1.3s
    const timer1 = setTimeout(() => {
      setStage('moving');
    }, 1300);

    // Stage 2: Finish transition and reveal app after 2.0s
    const timer2 = setTimeout(() => {
      setStage('done');
      if (onComplete) onComplete();
    }, 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  if (stage === 'done') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#14110D',
        transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: stage === 'moving' ? 0.95 : 1,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transition: 'transform 0.75s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.75s ease',
          transform: stage === 'moving' ? 'translateY(-36vh) scale(0.6)' : 'translateY(0) scale(1)',
        }}
      >
        <div className="vlf-splash-v-badge">
          <div className="vlf-splash-ring" />
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 44, fontWeight: 900, color: '#EFF4F1' }}>
            V
          </span>
        </div>

        <div style={{
          marginTop: 18,
          textAlign: 'center',
          transition: 'opacity 0.4s ease',
          opacity: stage === 'moving' ? 0 : 1,
        }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: '#EFF4F1', letterSpacing: '0.04em' }}>
            Vaultify
          </div>
          <div style={{ fontSize: 13, color: '#A8A3BC', marginTop: 4, letterSpacing: '0.02em' }}>
            Private Multi-Currency Wealth Sanctuary
          </div>
        </div>
      </div>
    </div>
  );
}
