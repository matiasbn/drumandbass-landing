'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { RiArrowUpLine, RiMusic2Line, RiFlashlightFill, RiQuestionLine } from '@remixicon/react';
import { useCamera } from '../CameraContext';
import { useScore } from '../ScoreContext';

function dispatchKey(key: string, type: 'keydown' | 'keyup') {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
}

function dispatchMouse(button: number, type: 'mousedown' | 'mouseup') {
  window.dispatchEvent(new MouseEvent(type, { button, bubbles: true }));
}

const JOYSTICK_SIZE = 120;
const THUMB_SIZE = 48;
const DEADZONE = 10;

// Stick derecho (mirar): velocidad de giro a fondo (rad/s)
const YAW_RATE = 2.4;
const PITCH_RATE = 1.7;
const GRENADE_HOLD_MS = 220; // mantener quieto el stick derecho carga la granada

// Movimientos especiales (mismas teclas que en desktop: 6-0)
const SPECIALS = ['Onda', 'Spotlight', 'Confetti', 'Levitar', 'Terremoto'];
// 5 bailes (teclas 1-5)
const DANCES = ['Hands Up', 'Spin', 'Headbang', 'Split', 'Backflip'];

export const MobileControls: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [danceMenuOpen, setDanceMenuOpen] = useState(false);
  const [specialMenuOpen, setSpecialMenuOpen] = useState(false);
  const { cameraYawRef, cameraPitchRef } = useCamera();
  const { specialCharges } = useScore(); // cargas de especial listas → badge en el botón

  // --- Stick izquierdo (moverse: WASD, con strafe en A/D) ---
  const leftJoyRef = useRef<HTMLDivElement>(null);
  const leftThumbRef = useRef<HTMLDivElement>(null);
  const leftKeysRef = useRef<Set<string>>(new Set());
  const leftTouchIdRef = useRef<number | null>(null);

  // --- Stick derecho (mirar + disparar/granada) ---
  const rightJoyRef = useRef<HTMLDivElement>(null);
  const rightThumbRef = useRef<HTMLDivElement>(null);
  const rightTouchIdRef = useRef<number | null>(null);
  const rightOffsetRef = useRef({ x: 0, y: 0 }); // -1..1 desde el centro
  const rightMovedRef = useRef(false); // ¿se empujó el stick? (entonces es "mirar", no tap)
  const grenadeChargingRef = useRef(false);
  const grenadeHoldTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  useEffect(() => {
    const checkLayout = () => {
      const mq = window.matchMedia('(max-width: 1024px)');
      setIsMobile(mq.matches);
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkLayout();
    window.addEventListener('resize', checkLayout);
    window.addEventListener('orientationchange', () => setTimeout(checkLayout, 100));
    return () => {
      window.removeEventListener('resize', checkLayout);
      window.removeEventListener('orientationchange', () => {});
    };
  }, []);

  // ═══ Stick izquierdo: moverse ═══
  const updateLeftStick = useCallback((clientX: number, clientY: number) => {
    const el = leftJoyRef.current;
    const thumb = leftThumbRef.current;
    if (!el || !thumb) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = JOYSTICK_SIZE / 2 - THUMB_SIZE / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    thumb.style.transform = `translate(${dx}px, ${dy}px)`;

    // W/A/S/D: adelante/atrás con W/S, strafe con A/D (FPS de consola).
    const newKeys = new Set<string>();
    if (dist > DEADZONE) {
      if (dy < -DEADZONE) newKeys.add('w');
      if (dy > DEADZONE) newKeys.add('s');
      if (dx < -DEADZONE) newKeys.add('a');
      if (dx > DEADZONE) newKeys.add('d');
    }
    for (const k of leftKeysRef.current) {
      if (!newKeys.has(k)) dispatchKey(k, 'keyup');
    }
    for (const k of newKeys) {
      if (!leftKeysRef.current.has(k)) dispatchKey(k, 'keydown');
    }
    leftKeysRef.current = newKeys;
  }, []);

  const resetLeftStick = useCallback(() => {
    if (leftThumbRef.current) leftThumbRef.current.style.transform = 'translate(0px, 0px)';
    for (const k of leftKeysRef.current) dispatchKey(k, 'keyup');
    leftKeysRef.current = new Set();
    leftTouchIdRef.current = null;
  }, []);

  const onLeftStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    leftTouchIdRef.current = t.identifier;
    updateLeftStick(t.clientX, t.clientY);
  }, [updateLeftStick]);

  const onLeftMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === leftTouchIdRef.current) {
        updateLeftStick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        return;
      }
    }
  }, [updateLeftStick]);

  const onLeftEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === leftTouchIdRef.current) {
        resetLeftStick();
        return;
      }
    }
  }, [resetLeftStick]);

  // ═══ Stick derecho: mirar (continuo), tap = disparar, mantener = granada ═══
  const clearGrenadeTimer = useCallback(() => {
    if (grenadeHoldTimerRef.current !== null) {
      window.clearTimeout(grenadeHoldTimerRef.current);
      grenadeHoldTimerRef.current = null;
    }
  }, []);

  // Bucle que gira la cámara según cuánto se empuje el stick (rate-based, como
  // el stick derecho de una consola).
  const lookLoop = useCallback(() => {
    const now = performance.now();
    const dt = Math.min((now - lastTsRef.current) / 1000, 0.05);
    lastTsRef.current = now;
    const { x, y } = rightOffsetRef.current;
    if (x !== 0) cameraYawRef.current -= x * YAW_RATE * dt;
    if (y !== 0) {
      cameraPitchRef.current = Math.max(-0.3, Math.min(1.2, cameraPitchRef.current + y * PITCH_RATE * dt));
    }
    rafRef.current = requestAnimationFrame(lookLoop);
  }, [cameraYawRef, cameraPitchRef]);

  const startLookLoop = useCallback(() => {
    if (rafRef.current == null) {
      lastTsRef.current = performance.now();
      rafRef.current = requestAnimationFrame(lookLoop);
    }
  }, [lookLoop]);

  const stopLookLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    rightOffsetRef.current = { x: 0, y: 0 };
  }, []);

  const updateRightStick = useCallback((clientX: number, clientY: number) => {
    const el = rightJoyRef.current;
    const thumb = rightThumbRef.current;
    if (!el || !thumb) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = JOYSTICK_SIZE / 2 - THUMB_SIZE / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    thumb.style.transform = `translate(${dx}px, ${dy}px)`;

    if (dist > DEADZONE) {
      rightOffsetRef.current = { x: dx / maxR, y: dy / maxR };
      if (!rightMovedRef.current) {
        // Empujar el stick = mirar → ya no es tap ni granada.
        rightMovedRef.current = true;
        clearGrenadeTimer();
      }
    } else {
      rightOffsetRef.current = { x: 0, y: 0 };
    }
  }, [clearGrenadeTimer]);

  const onRightStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (rightTouchIdRef.current !== null) return;
    const t = e.changedTouches[0];
    rightTouchIdRef.current = t.identifier;
    rightMovedRef.current = false;
    rightOffsetRef.current = { x: 0, y: 0 };
    startLookLoop();
    // Mantener el stick quieto → carga la granada.
    clearGrenadeTimer();
    grenadeHoldTimerRef.current = window.setTimeout(() => {
      if (!rightMovedRef.current) {
        grenadeChargingRef.current = true;
        dispatchMouse(2, 'mousedown');
      }
    }, GRENADE_HOLD_MS);
  }, [startLookLoop, clearGrenadeTimer]);

  const onRightMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === rightTouchIdRef.current) {
        updateRightStick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        return;
      }
    }
  }, [updateRightStick]);

  const onRightEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier !== rightTouchIdRef.current) continue;
      clearGrenadeTimer();
      stopLookLoop();
      if (rightThumbRef.current) rightThumbRef.current.style.transform = 'translate(0px, 0px)';
      if (grenadeChargingRef.current) {
        grenadeChargingRef.current = false;
        dispatchMouse(2, 'mouseup'); // lanzar granada
      } else if (!rightMovedRef.current) {
        dispatchMouse(0, 'mousedown'); // tap → disparar
        setTimeout(() => dispatchMouse(0, 'mouseup'), 40);
      }
      rightTouchIdRef.current = null;
      rightMovedRef.current = false;
      return;
    }
  }, [clearGrenadeTimer, stopLookLoop]);

  const resetRight = useCallback(() => {
    clearGrenadeTimer();
    stopLookLoop();
    if (rightThumbRef.current) rightThumbRef.current.style.transform = 'translate(0px, 0px)';
    if (grenadeChargingRef.current) {
      grenadeChargingRef.current = false;
      dispatchMouse(2, 'mouseup');
    }
    rightTouchIdRef.current = null;
    rightMovedRef.current = false;
  }, [clearGrenadeTimer, stopLookLoop]);

  // Limpieza si el componente se desmonta a medio gesto.
  useEffect(() => () => {
    clearGrenadeTimer();
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, [clearGrenadeTimer]);

  // --- Botones ---
  const onJump = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    dispatchKey(' ', 'keydown');
    setTimeout(() => dispatchKey(' ', 'keyup'), 50);
  }, []);

  const onDance = useCallback((key: string) => (e: React.TouchEvent) => {
    e.preventDefault();
    dispatchKey(key, 'keydown');
    setTimeout(() => dispatchKey(key, 'keyup'), 50);
    setDanceMenuOpen(false);
  }, []);

  const onSpecial = useCallback((index: number) => (e: React.TouchEvent) => {
    e.preventDefault();
    const key = index === 4 ? '0' : String(index + 6);
    dispatchKey(key, 'keydown');
    setTimeout(() => dispatchKey(key, 'keyup'), 50);
    setSpecialMenuOpen(false);
  }, []);

  const onWave = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    dispatchKey('q', 'keydown');
    setTimeout(() => dispatchKey('q', 'keyup'), 50);
  }, []);

  const openInstructions = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    window.dispatchEvent(new Event('club:open-instructions'));
  }, []);

  if (!isMobile) return null;

  // Portrait orientation prompt
  if (isPortrait) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center gap-4 text-white font-mono">
        <div className="text-4xl animate-pulse">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 1H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2z" />
            <path d="M12 18h.01" />
          </svg>
        </div>
        <div className="text-lg text-[#00ccff]">GIRA TU DISPOSITIVO</div>
        <div className="text-xs text-white/50">El club funciona mejor en horizontal</div>
      </div>
    );
  }

  const btnClass =
    'flex items-center justify-center rounded-full bg-black/50 backdrop-blur border select-none active:bg-white/20 transition-colors touch-none';
  const stickClass =
    'rounded-full bg-white/10 backdrop-blur border border-white/20 touch-none select-none relative';
  // Evita que un long-press sobre el stick seleccione texto o abra el callout de
  // iOS (eso cancelaba el toque y la granada no se lanzaba).
  const stickStyle: React.CSSProperties = {
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    touchAction: 'none',
  };
  const thumbStyle: React.CSSProperties = {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    left: (JOYSTICK_SIZE - THUMB_SIZE) / 2,
    top: (JOYSTICK_SIZE - THUMB_SIZE) / 2,
    pointerEvents: 'none',
  };

  return (
    <div className="fixed inset-0 z-30 pointer-events-none touch-none select-none">
      {/* Stick izquierdo — moverse */}
      <div className="pointer-events-auto absolute bottom-6 left-4 touch-none">
        <div
          ref={leftJoyRef}
          className={stickClass}
          style={stickStyle}
          onTouchStart={onLeftStart}
          onTouchMove={onLeftMove}
          onTouchEnd={onLeftEnd}
          onTouchCancel={resetLeftStick}
        >
          <div ref={leftThumbRef} className="absolute rounded-full bg-white/40 border border-white/60" style={thumbStyle} />
        </div>
      </div>

      {/* Abajo-derecha: botón de saltar + stick derecho (mirar/disparar/granada) */}
      <div className="pointer-events-auto absolute bottom-6 right-4 flex items-end gap-4 touch-none">
        {/* Saltar — a la izquierda del stick derecho */}
        <button
          className={`${btnClass} w-14 h-14 border-[#00ff41]/40 text-[#00ff41] mb-6`}
          onTouchStart={onJump}
          aria-label="Saltar"
        >
          <RiArrowUpLine className="w-7 h-7" />
        </button>

        {/* Stick derecho */}
        <div
          ref={rightJoyRef}
          className={`${stickClass} border-[#ff0055]/30`}
          style={stickStyle}
          onTouchStart={onRightStart}
          onTouchMove={onRightMove}
          onTouchEnd={onRightEnd}
          onTouchCancel={resetRight}
        >
          <div ref={rightThumbRef} className="absolute rounded-full bg-[#ff0055]/40 border border-[#ff0055]/60" style={thumbStyle} />
        </div>
      </div>

      {/* Menús (fila abajo-centro, entre los dos sticks): bailes · especiales · saludo · ayuda.
          Los desplegables se abren hacia ARRIBA. */}
      <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-row gap-1.5 touch-none">
        {/* Bailes (1-5) */}
        <div className="relative">
          <button
            className={`${btnClass} w-10 h-10 ${danceMenuOpen ? 'border-[#ff0055]/60 text-[#ff0055] bg-[#ff0055]/10' : 'border-white/20 text-white/60'}`}
            onTouchStart={(e) => { e.preventDefault(); setSpecialMenuOpen(false); setDanceMenuOpen(o => !o); }}
          >
            <RiMusic2Line className="w-5 h-5" />
          </button>
          {danceMenuOpen && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col gap-1.5 bg-black/85 backdrop-blur border border-white/10 p-2 rounded-lg">
              {DANCES.map((name, i) => (
                <button
                  key={i}
                  className="px-3 py-1.5 text-xs font-mono text-[#ff0055] border border-[#ff0055]/30 rounded active:bg-[#ff0055]/20 whitespace-nowrap text-left"
                  onTouchStart={onDance(String(i + 1))}
                >
                  {i + 1} · {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Especiales (6-0) — cuando hay cargas listas: dorado, anillo pulsante y contador */}
        <div className="relative">
          {specialCharges > 0 && (
            <span className="absolute inset-0 rounded-full border-2 border-[#ffdd00] animate-ping pointer-events-none" />
          )}
          <button
            className={`${btnClass} relative w-10 h-10 ${
              specialMenuOpen || specialCharges > 0
                ? 'border-[#ffdd00]/70 text-[#ffdd00] bg-[#ffdd00]/10'
                : 'border-white/20 text-white/60'
            }`}
            onTouchStart={(e) => { e.preventDefault(); setDanceMenuOpen(false); setSpecialMenuOpen(o => !o); }}
          >
            <RiFlashlightFill className="w-5 h-5" />
            {specialCharges > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-[#ffdd00] text-black text-[10px] font-bold rounded-full leading-none">
                {specialCharges}
              </span>
            )}
          </button>
          {specialMenuOpen && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col gap-1.5 bg-black/85 backdrop-blur border border-white/10 p-2 rounded-lg">
              {SPECIALS.map((name, i) => (
                <button
                  key={i}
                  className="px-3 py-1.5 text-xs font-mono text-[#ffdd00] border border-[#ffdd00]/30 rounded active:bg-[#ffdd00]/20 whitespace-nowrap text-left"
                  onTouchStart={onSpecial(i)}
                >
                  {i === 4 ? 0 : i + 6} · {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Saludar (Q) */}
        <button
          className={`${btnClass} w-10 h-10 border-white/20 text-base`}
          onTouchStart={onWave}
          aria-label="Saludar"
        >
          <span aria-hidden>👋</span>
        </button>

        {/* Instrucciones */}
        <button
          className={`${btnClass} w-10 h-10 border-white/20 text-white/60`}
          onTouchStart={openInstructions}
          aria-label="Cómo jugar"
        >
          <RiQuestionLine className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
