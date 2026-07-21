'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useHealth } from '../HealthContext';
import { onHypeBumpRef } from '../juice';

/**
 * Full-screen hype overlay effects (re-propuesto WS-2: todo es DORADO, nada de daño).
 * Incluye el flash de hype-bump "<X> te energizó" (§5) vía onHypeBumpRef de juice.ts.
 * Uses direct DOM manipulation — no React re-renders.
 */
export const DamageOverlay: React.FC = () => {
  const { onHypeRef, onHypeDropRef } = useHealth();
  const flashRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const goldFlashRef = useRef<HTMLDivElement>(null);
  const bumpBannerRef = useRef<HTMLDivElement>(null);
  const bumpNameRef = useRef<HTMLSpanElement>(null);
  const bumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashHype = useCallback(() => {
    if (!flashRef.current) return;
    flashRef.current.style.opacity = '0.5';
    flashRef.current.style.display = 'block';
    setTimeout(() => {
      if (flashRef.current) {
        flashRef.current.style.opacity = '0';
        setTimeout(() => {
          if (flashRef.current) flashRef.current.style.display = 'none';
        }, 400);
      }
    }, 120);
  }, []);

  const showHypeDrop = useCallback(() => {
    if (!dropRef.current || !goldFlashRef.current) return;

    // Gold flash
    goldFlashRef.current.style.display = 'block';
    goldFlashRef.current.style.opacity = '0.8';
    setTimeout(() => {
      if (goldFlashRef.current) {
        goldFlashRef.current.style.opacity = '0';
        setTimeout(() => {
          if (goldFlashRef.current) goldFlashRef.current.style.display = 'none';
        }, 600);
      }
    }, 200);

    // Main celebration overlay
    dropRef.current.style.display = 'flex';
    dropRef.current.style.opacity = '1';

    // Reset text animation by toggling class
    const textEl = dropRef.current.querySelector('[data-hype-text]') as HTMLElement;
    if (textEl) {
      textEl.style.animation = 'none';
      // Force reflow
      void textEl.offsetHeight;
      textEl.style.animation = 'hypeDropScaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, hypeDropPulse 0.5s ease-in-out 0.6s infinite alternate';
    }

    // Fade out over 3 seconds
    if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
    dropTimerRef.current = setTimeout(() => {
      if (dropRef.current) {
        dropRef.current.style.opacity = '0';
        setTimeout(() => {
          if (dropRef.current) dropRef.current.style.display = 'none';
        }, 1000);
      }
    }, 2000);
  }, []);

  // Hype-bump entre jugadores (§5): flash dorado + "<X> te energizó"
  const showHypeBump = useCallback((fromName: string) => {
    flashHype();
    const banner = bumpBannerRef.current;
    if (!banner || !bumpNameRef.current) return;
    bumpNameRef.current.textContent = fromName;
    banner.style.display = 'flex';
    banner.style.opacity = '1';
    banner.style.transform = 'translate(-50%, 0) scale(1)';
    if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
    bumpTimerRef.current = setTimeout(() => {
      if (bumpBannerRef.current) {
        bumpBannerRef.current.style.opacity = '0';
        bumpBannerRef.current.style.transform = 'translate(-50%, -8px) scale(0.95)';
        setTimeout(() => {
          if (bumpBannerRef.current) bumpBannerRef.current.style.display = 'none';
        }, 400);
      }
    }, 1400);
  }, [flashHype]);

  useEffect(() => {
    onHypeRef.current = flashHype;
    onHypeDropRef.current = showHypeDrop;
    onHypeBumpRef.current = showHypeBump;
    return () => {
      onHypeRef.current = null;
      onHypeDropRef.current = null;
      onHypeBumpRef.current = null;
      if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
    };
  }, [flashHype, showHypeDrop, showHypeBump, onHypeRef, onHypeDropRef]);

  return (
    <>
      {/* Flash de energía — borde DORADO (hype ganado / hype-bump; ya no hay daño) */}
      <div
        ref={flashRef}
        className="fixed inset-0 z-[100] pointer-events-none"
        style={{
          display: 'none',
          background: 'radial-gradient(ellipse at center, transparent 42%, rgba(255,215,0,0.28) 72%, rgba(255,170,0,0.4) 100%)',
          opacity: 0,
          transition: 'opacity 0.4s ease-out',
        }}
      />
      {/* Banner de hype-bump: "<X> te energizó" */}
      <div
        ref={bumpBannerRef}
        className="fixed left-1/2 top-[18%] z-[103] pointer-events-none items-center gap-2 px-4 py-2 font-mono"
        style={{
          display: 'none',
          opacity: 0,
          transform: 'translate(-50%, 0) scale(1)',
          transition: 'opacity 0.35s ease-out, transform 0.35s ease-out',
          background: 'rgba(0,0,0,0.65)',
          border: '1px solid rgba(255,215,0,0.6)',
          color: '#ffd700',
          textShadow: '0 0 10px rgba(255,215,0,0.8)',
          fontSize: 'clamp(0.8rem, 2vw, 1.05rem)',
          letterSpacing: '0.1em',
        }}
      >
        <span ref={bumpNameRef} className="font-bold" />
        <span>te energizó</span>
        <span className="font-bold">+8</span>
      </div>
      {/* Gold flash on hype drop trigger */}
      <div
        ref={goldFlashRef}
        className="fixed inset-0 z-[102] pointer-events-none"
        style={{
          display: 'none',
          background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.6) 0%, rgba(255,170,0,0.3) 40%, transparent 70%)',
          opacity: 0,
          transition: 'opacity 0.6s ease-out',
        }}
      />
      {/* HYPE DROP celebration overlay */}
      <div
        ref={dropRef}
        className="fixed inset-0 z-[101] flex flex-col items-center justify-center pointer-events-none"
        style={{
          display: 'none',
          opacity: 0,
          transition: 'opacity 1s ease-out',
        }}
      >
        {/* Pulsing golden vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(255,215,0,0.25) 60%, rgba(255,170,0,0.4) 80%, rgba(255,100,0,0.3) 100%)',
            animation: 'hypeDropVignette 0.8s ease-in-out infinite alternate',
          }}
        />
        {/* Rainbow border effect */}
        <div
          className="absolute inset-0"
          style={{
            border: '4px solid transparent',
            borderImage: 'linear-gradient(135deg, #ff0055, #ffdd00, #00ff41, #00ccff, #9933ff, #ff0055) 1',
            animation: 'hypeDropBorder 1s linear infinite',
          }}
        />
        {/* Inner glow */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,221,0,0.2) 0%, rgba(153,51,255,0.1) 40%, transparent 70%)',
          }}
        />

        {/* CSS sparkles around text */}
        <div className="absolute inset-0 overflow-hidden" style={{ animation: 'hypeDropBorder 2s linear infinite' }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${3 + Math.random() * 5}px`,
                height: `${3 + Math.random() * 5}px`,
                left: `${15 + Math.random() * 70}%`,
                top: `${25 + Math.random() * 50}%`,
                background: ['#ffd700', '#ff0055', '#00ccff', '#ff00ff', '#00ff41'][i % 5],
                boxShadow: `0 0 ${6 + Math.random() * 8}px currentColor`,
                animation: `hypeSparkle ${0.5 + Math.random() * 1}s ease-in-out ${Math.random() * 0.5}s infinite alternate`,
              }}
            />
          ))}
        </div>

        {/* Main text with scale-in animation */}
        <div
          data-hype-text
          style={{
            fontFamily: 'monospace',
            fontSize: 'clamp(2.5rem, 10vw, 6rem)',
            fontWeight: 'bold',
            letterSpacing: '0.2em',
            color: '#ffd700',
            textShadow: '0 0 20px rgba(255,215,0,0.9), 0 0 40px rgba(255,215,0,0.5), 0 0 80px rgba(255,100,0,0.7), 0 0 120px rgba(153,51,255,0.5)',
            animation: 'hypeDropScaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, hypeDropPulse 0.5s ease-in-out 0.6s infinite alternate',
            transform: 'scale(3)',
            opacity: 0,
          }}
        >
          HYPE DROP!
        </div>

        {/* Sub-text */}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 'clamp(0.8rem, 3vw, 1.5rem)',
            color: '#ffdd00',
            letterSpacing: '0.4em',
            marginTop: '0.5rem',
            textShadow: '0 0 10px rgba(255,221,0,0.8)',
            animation: 'hypeDropPulse 0.7s ease-in-out 0.8s infinite alternate',
            opacity: 0.8,
          }}
        >
          MAX HYPE REACHED
        </div>

        {/* Inline styles for animations */}
        <style>{`
          @keyframes hypeDropScaleIn {
            0% { transform: scale(3); opacity: 0; }
            50% { transform: scale(0.9); opacity: 1; }
            70% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes hypeDropPulse {
            from { transform: scale(1); }
            to { transform: scale(1.08); }
          }
          @keyframes hypeDropBorder {
            from { filter: hue-rotate(0deg); }
            to { filter: hue-rotate(360deg); }
          }
          @keyframes hypeDropVignette {
            from { opacity: 0.6; }
            to { opacity: 1; }
          }
          @keyframes hypeSparkle {
            0% { transform: scale(0.3) translateY(0); opacity: 0.3; }
            100% { transform: scale(1.5) translateY(-20px); opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
};
