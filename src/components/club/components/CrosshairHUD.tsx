'use client';

import React, { useEffect, useRef } from 'react';
import { TUNING } from '../tuning';
import { hud, comboColor, HitKind } from '../juice';
import { playUiTick } from '../sounds';

// Crosshair del Bass Cannon (WS-2, §4): estado de cooldown (contrae al disparar y
// re-expande al estar listo), hitmarkers X/estrella de 80ms, anillo de carga de
// granada, barra de decay del combo (4s) y color por multiplicador (rosa→cian→dorado).
// TODO se actualiza por rAF manipulando el DOM directo — cero setState, cero re-renders.
// Montar en NightclubSceneInner junto a <DamageOverlay />.

const HITMARKER_POOL = 4;
const HITMARKER_HOLD_MS = 80; // visible pleno
const HITMARKER_FADE_MS = 160; // fade posterior
const RING_R = 21; // radio del anillo de carga (SVG)
const RING_C = 2 * Math.PI * RING_R;

interface MarkerState {
  until: number;
  kind: HitKind;
}

export const CrosshairHUD: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const crossRef = useRef<SVGSVGElement>(null);
  const crossPartsRef = useRef<SVGGElement>(null);
  const chargeRingRef = useRef<SVGCircleElement>(null);
  const comboWrapRef = useRef<HTMLDivElement>(null);
  const comboBarRef = useRef<HTMLDivElement>(null);
  const comboLabelRef = useRef<HTMLDivElement>(null);
  const comboLostRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Desktop-first: en punteros gruesos (móvil) el crosshair no aplica (tap dispara plano)
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
      if (rootRef.current) rootRef.current.style.display = 'none';
      return;
    }

    const markers: MarkerState[] = Array.from({ length: HITMARKER_POOL }, () => ({ until: -1e12, kind: 'normal' as HitKind }));
    let nextMarker = 0;
    let lastColor = '';
    let wasCoolingDown = false;
    let comboWasActive = false;
    let comboLostUntil = -1e12;
    let rafId = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const now = performance.now();
      const root = rootRef.current;
      if (!root) return;

      // Atenuado cuando no hay pointer lock (no estás apuntando)
      root.style.opacity = document.pointerLockElement ? '1' : '0.3';

      // --- Color por multiplicador de combo (rosa→cian→dorado) ---
      const color = comboColor(hud.combo.mult);
      if (color !== lastColor) {
        lastColor = color;
        if (crossPartsRef.current) {
          crossPartsRef.current.setAttribute('stroke', color);
          crossPartsRef.current.setAttribute('fill', color);
        }
        if (comboBarRef.current) comboBarRef.current.style.background = color;
        if (comboLabelRef.current) comboLabelRef.current.style.color = color;
      }

      // --- Cooldown del disparo: contrae y re-expande al estar listo ---
      const p = Math.min(1, (now - hud.lastShotAt) / hud.shotCooldownMs);
      const coolingDown = p < 1;
      // ease-out con leve overshoot al final (el "pop" de estar listo)
      const eased = 1 - Math.pow(1 - p, 3);
      const overshoot = p >= 0.85 && p < 1 ? (p - 0.85) * 0.5 : 0;
      const scale = 0.72 + 0.28 * eased + overshoot;
      if (crossRef.current) {
        crossRef.current.style.transform = `scale(${scale.toFixed(3)})`;
        crossRef.current.style.opacity = coolingDown ? '0.55' : '1';
      }
      if (wasCoolingDown && !coolingDown) playUiTick(); // cooldown listo
      wasCoolingDown = coolingDown;

      // --- Anillo de carga de granada ---
      const ring = chargeRingRef.current;
      if (ring) {
        const c = hud.grenadeCharge;
        if (c >= 0) {
          ring.style.opacity = '1';
          ring.setAttribute('stroke-dashoffset', String(RING_C * (1 - c)));
          ring.setAttribute('stroke', c >= 1 ? '#ff0055' : '#ffcc00');
        } else {
          ring.style.opacity = '0';
        }
      }

      // --- Barra de decay del combo (4s) ---
      const combo = hud.combo;
      const comboActive = combo.hits > 0 && now < combo.until;
      if (comboWrapRef.current) {
        comboWrapRef.current.style.opacity = comboActive ? '1' : '0';
      }
      if (comboActive && comboBarRef.current) {
        const remain = Math.max(0, (combo.until - now) / (TUNING.combo.ventanaS * 1000));
        comboBarRef.current.style.transform = `scaleX(${remain.toFixed(3)})`;
        if (comboLabelRef.current) comboLabelRef.current.textContent = `x${combo.mult}`;
      }
      // "combo perdido" — fade suave, sin castigo (M10)
      if (comboWasActive && !comboActive && combo.until > 0) {
        comboLostUntil = now + 900;
      }
      comboWasActive = comboActive;
      if (comboLostRef.current) {
        const lost = now < comboLostUntil;
        comboLostRef.current.style.opacity = lost ? String(Math.min(1, (comboLostUntil - now) / 450)) : '0';
      }

      // --- Hitmarkers: consumir la cola del bus ---
      while (hud.hitQueue.length > 0) {
        const kind = hud.hitQueue.shift() as HitKind;
        const slot = nextMarker;
        nextMarker = (nextMarker + 1) % HITMARKER_POOL;
        markers[slot].until = now + HITMARKER_HOLD_MS + HITMARKER_FADE_MS;
        markers[slot].kind = kind;
        const el = markerRefs.current[slot];
        if (el) {
          const star = kind === 'air';
          const gold = kind === 'beat' || kind === 'air' || kind === 'bump';
          el.textContent = star ? '✦' : '✕';
          el.style.color = gold ? '#ffd700' : color;
          el.style.textShadow = `0 0 8px ${gold ? '#ffd700' : color}`;
        }
      }
      for (let i = 0; i < HITMARKER_POOL; i++) {
        const el = markerRefs.current[i];
        if (!el) continue;
        const left = markers[i].until - now;
        if (left <= 0) {
          el.style.opacity = '0';
        } else if (left > HITMARKER_FADE_MS) {
          el.style.opacity = '1';
          el.style.transform = 'translate(-50%, -50%) scale(1.25)';
        } else {
          el.style.opacity = String(left / HITMARKER_FADE_MS);
          el.style.transform = 'translate(-50%, -50%) scale(1)';
        }
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div ref={rootRef} className="fixed inset-0 z-40 pointer-events-none" style={{ opacity: 0.3, transition: 'opacity 0.2s ease' }}>
      {/* Centro: crosshair + anillo de carga */}
      <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%, -50%)' }}>
        <svg ref={crossRef} width="56" height="56" viewBox="0 0 56 56" style={{ display: 'block', transformOrigin: 'center', transition: 'opacity 0.1s linear' }}>
          {/* Anillo de carga de granada (M9) */}
          <circle
            ref={chargeRingRef}
            cx="28"
            cy="28"
            r={RING_R}
            fill="none"
            stroke="#ffcc00"
            strokeWidth="2.5"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C}
            transform="rotate(-90 28 28)"
            style={{ opacity: 0, transition: 'opacity 0.12s linear' }}
          />
          {/* Cruz con gap central */}
          <g ref={crossPartsRef} stroke="#ff0055" strokeWidth="2" fill="#ff0055">
            <line x1="28" y1="10" x2="28" y2="19" />
            <line x1="28" y1="37" x2="28" y2="46" />
            <line x1="10" y1="28" x2="19" y2="28" />
            <line x1="37" y1="28" x2="46" y2="28" />
            <circle cx="28" cy="28" r="1.4" stroke="none" />
          </g>
        </svg>

        {/* Hitmarkers X / estrella (pool DOM, 80ms + fade) */}
        {Array.from({ length: HITMARKER_POOL }, (_, i) => (
          <div
            key={`hm-${i}`}
            ref={el => { markerRefs.current[i] = el; }}
            className="absolute left-1/2 top-1/2 font-mono select-none"
            style={{
              opacity: 0,
              transform: 'translate(-50%, -50%) scale(1.25)',
              fontSize: '26px',
              fontWeight: 'bold',
              color: '#ff0055',
              transition: 'transform 0.08s ease-out',
            }}
          >
            ✕
          </div>
        ))}
      </div>

      {/* Barra de decay del combo (4s) bajo el crosshair */}
      <div
        ref={comboWrapRef}
        className="absolute left-1/2 top-1/2 flex items-center gap-2"
        style={{ transform: 'translate(-50%, 44px)', opacity: 0, transition: 'opacity 0.3s ease' }}
      >
        <div ref={comboLabelRef} className="font-mono text-xs font-bold" style={{ color: '#ff0055', textShadow: '0 0 6px currentColor' }}>
          x1
        </div>
        <div className="w-16 h-1 bg-white/15 overflow-hidden">
          <div
            ref={comboBarRef}
            className="h-full w-full"
            style={{ background: '#ff0055', transform: 'scaleX(0)', transformOrigin: 'left center' }}
          />
        </div>
      </div>

      {/* "combo perdido" — fade suave, sin castigo */}
      <div
        ref={comboLostRef}
        className="absolute left-1/2 top-1/2 font-mono text-[10px] tracking-widest text-white/60"
        style={{ transform: 'translate(-50%, 62px)', opacity: 0, transition: 'opacity 0.25s ease' }}
      >
        COMBO PERDIDO
      </div>
    </div>
  );
};
