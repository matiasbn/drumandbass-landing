'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { RiArrowUpLine, RiMusic2Line, RiFlashlightFill, RiQuestionLine } from '@remixicon/react';
import { useCamera } from '../CameraContext';

function dispatchKey(key: string, type: 'keydown' | 'keyup') {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
}

function dispatchMouse(button: number, type: 'mousedown' | 'mouseup') {
  window.dispatchEvent(new MouseEvent(type, { button, bubbles: true }));
}

const JOYSTICK_SIZE = 120;
const THUMB_SIZE = 48;
const DEADZONE = 10;

// Zona derecha (mirar / disparar / granada)
const LOOK_SENSITIVITY = 0.006;
const AIM_MOVE_THRESHOLD = 10; // px de arrastre para tratarlo como "mirar" y no un tap
const GRENADE_HOLD_MS = 220; // mantener quieto el dedo este tiempo empieza a cargar la granada

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

  // Joystick refs
  const joystickRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const activeKeysRef = useRef<Set<string>>(new Set());
  const touchIdRef = useRef<number | null>(null);

  // Zona derecha: mirar (arrastrar) · disparar (tap) · granada (mantener)
  const aimTouchIdRef = useRef<number | null>(null);
  const aimLastXRef = useRef(0);
  const aimLastYRef = useRef(0);
  const aimStartXRef = useRef(0);
  const aimStartYRef = useRef(0);
  const aimMovedRef = useRef(false);
  const grenadeChargingRef = useRef(false);
  const grenadeHoldTimerRef = useRef<number | null>(null);

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

  // --- Joystick (izquierda): arriba/abajo = avanzar/retroceder, lados = GIRAR ---
  const updateJoystick = useCallback((clientX: number, clientY: number) => {
    const el = joystickRef.current;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = JOYSTICK_SIZE / 2 - THUMB_SIZE / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    thumb.style.transform = `translate(${dx}px, ${dy}px)`;

    // Los lados mandan ArrowLeft/ArrowRight, que en el juego GIRAN la cámara (no
    // strafean); arriba/abajo mandan ArrowUp/ArrowDown (avanzar/retroceder).
    const newKeys = new Set<string>();
    if (dist > DEADZONE) {
      if (dy < -DEADZONE) newKeys.add('ArrowUp');
      if (dy > DEADZONE) newKeys.add('ArrowDown');
      if (dx < -DEADZONE) newKeys.add('ArrowLeft');
      if (dx > DEADZONE) newKeys.add('ArrowRight');
    }

    for (const k of activeKeysRef.current) {
      if (!newKeys.has(k)) dispatchKey(k, 'keyup');
    }
    for (const k of newKeys) {
      if (!activeKeysRef.current.has(k)) dispatchKey(k, 'keydown');
    }
    activeKeysRef.current = newKeys;
  }, []);

  const resetJoystick = useCallback(() => {
    if (thumbRef.current) thumbRef.current.style.transform = 'translate(0px, 0px)';
    for (const k of activeKeysRef.current) dispatchKey(k, 'keyup');
    activeKeysRef.current = new Set();
    touchIdRef.current = null;
  }, []);

  const onJoystickTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    updateJoystick(touch.clientX, touch.clientY);
  }, [updateJoystick]);

  const onJoystickTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        updateJoystick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        return;
      }
    }
  }, [updateJoystick]);

  const onJoystickTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        resetJoystick();
        return;
      }
    }
  }, [resetJoystick]);

  // --- Zona derecha: mirar / disparar / granada ---
  // Arrastrar = mirar (yaw + pitch). Tap = disparar. Mantener el dedo quieto =
  // cargar la Bomba de Bajo; al soltar se lanza.
  const clearGrenadeTimer = useCallback(() => {
    if (grenadeHoldTimerRef.current !== null) {
      window.clearTimeout(grenadeHoldTimerRef.current);
      grenadeHoldTimerRef.current = null;
    }
  }, []);

  const onAimTouchStart = useCallback((e: React.TouchEvent) => {
    if (aimTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    aimTouchIdRef.current = touch.identifier;
    aimStartXRef.current = touch.clientX;
    aimStartYRef.current = touch.clientY;
    aimLastXRef.current = touch.clientX;
    aimLastYRef.current = touch.clientY;
    aimMovedRef.current = false;
    // Si el dedo se queda quieto, empieza a cargar la granada.
    clearGrenadeTimer();
    grenadeHoldTimerRef.current = window.setTimeout(() => {
      if (!aimMovedRef.current) {
        grenadeChargingRef.current = true;
        dispatchMouse(2, 'mousedown');
      }
    }, GRENADE_HOLD_MS);
  }, [clearGrenadeTimer]);

  const onAimTouchMove = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== aimTouchIdRef.current) continue;
      const dx = touch.clientX - aimLastXRef.current;
      const dy = touch.clientY - aimLastYRef.current;
      // Mirar: arrastrar mueve la cámara (yaw + pitch → mirar a los lados y arriba/abajo).
      cameraYawRef.current -= dx * LOOK_SENSITIVITY;
      cameraPitchRef.current = Math.max(-0.3, Math.min(1.2, cameraPitchRef.current + dy * LOOK_SENSITIVITY));
      aimLastXRef.current = touch.clientX;
      aimLastYRef.current = touch.clientY;
      // ¿Se movió lo suficiente para ser un arrastre (y no un tap)?
      if (!aimMovedRef.current) {
        const totX = touch.clientX - aimStartXRef.current;
        const totY = touch.clientY - aimStartYRef.current;
        if (Math.hypot(totX, totY) > AIM_MOVE_THRESHOLD) {
          aimMovedRef.current = true;
          // Si todavía no empezó a cargar, este gesto es "mirar": cancela la granada.
          if (!grenadeChargingRef.current) clearGrenadeTimer();
        }
      }
      return;
    }
  }, [cameraYawRef, cameraPitchRef, clearGrenadeTimer]);

  const onAimTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier !== aimTouchIdRef.current) continue;
      clearGrenadeTimer();
      if (grenadeChargingRef.current) {
        // Estaba cargando la granada → soltar la lanza.
        grenadeChargingRef.current = false;
        dispatchMouse(2, 'mouseup');
      } else if (!aimMovedRef.current) {
        // Tap sin arrastre → disparo de energía.
        dispatchMouse(0, 'mousedown');
        setTimeout(() => dispatchMouse(0, 'mouseup'), 40);
      }
      aimTouchIdRef.current = null;
      aimMovedRef.current = false;
      return;
    }
  }, [clearGrenadeTimer]);

  const resetAim = useCallback(() => {
    clearGrenadeTimer();
    if (grenadeChargingRef.current) {
      grenadeChargingRef.current = false;
      dispatchMouse(2, 'mouseup');
    }
    aimTouchIdRef.current = null;
    aimMovedRef.current = false;
  }, [clearGrenadeTimer]);

  // Limpia el timer de la granada si el componente se desmonta a medio gesto.
  useEffect(() => () => clearGrenadeTimer(), [clearGrenadeTimer]);

  // --- Botones de acción ---
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
    // 6-0 → especiales 0..4 (misma tecla que en desktop)
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

  return (
    <div className="fixed inset-0 z-30 pointer-events-none touch-none">
      {/* Zona derecha — mirar (arrastrar) · disparar (tap) · granada (mantener).
          Va PRIMERA (debajo) para que los botones de arriba capten sus taps. */}
      <div
        className="pointer-events-auto absolute touch-none"
        style={{ top: 0, right: 0, bottom: 0, width: '50%' }}
        onTouchStart={onAimTouchStart}
        onTouchMove={onAimTouchMove}
        onTouchEnd={onAimTouchEnd}
        onTouchCancel={resetAim}
      />

      {/* Izquierda — Joystick */}
      <div className="pointer-events-auto absolute bottom-6 left-4 touch-none">
        <div
          ref={joystickRef}
          className="rounded-full bg-white/10 backdrop-blur border border-white/20 touch-none relative"
          style={{ width: JOYSTICK_SIZE, height: JOYSTICK_SIZE }}
          onTouchStart={onJoystickTouchStart}
          onTouchMove={onJoystickTouchMove}
          onTouchEnd={onJoystickTouchEnd}
          onTouchCancel={resetJoystick}
        >
          <div
            ref={thumbRef}
            className="absolute rounded-full bg-white/40 border border-white/60"
            style={{
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              left: (JOYSTICK_SIZE - THUMB_SIZE) / 2,
              top: (JOYSTICK_SIZE - THUMB_SIZE) / 2,
            }}
          />
        </div>
      </div>

      {/* Menús (fila abajo-centro): bailes · especiales · saludo · ayuda.
          Van entre el joystick (izq) y el botón de saltar (der) para no solaparse
          con ninguno; los desplegables se abren hacia ARRIBA. */}
      <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-row gap-2 touch-none">
        {/* Bailes (1-5) */}
        <div className="relative">
          <button
            className={`${btnClass} w-11 h-11 ${danceMenuOpen ? 'border-[#ff0055]/60 text-[#ff0055] bg-[#ff0055]/10' : 'border-white/20 text-white/60'}`}
            onTouchStart={(e) => { e.preventDefault(); setSpecialMenuOpen(false); setDanceMenuOpen(o => !o); }}
          >
            <RiMusic2Line className="w-5 h-5" />
          </button>
          {danceMenuOpen && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex flex-col gap-1.5 bg-black/85 backdrop-blur border border-white/10 p-2 rounded-lg">
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

        {/* Especiales (6-0) */}
        <div className="relative">
          <button
            className={`${btnClass} w-11 h-11 ${specialMenuOpen ? 'border-[#ffdd00]/60 text-[#ffdd00] bg-[#ffdd00]/10' : 'border-white/20 text-white/60'}`}
            onTouchStart={(e) => { e.preventDefault(); setDanceMenuOpen(false); setSpecialMenuOpen(o => !o); }}
          >
            <RiFlashlightFill className="w-5 h-5" />
          </button>
          {specialMenuOpen && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex flex-col gap-1.5 bg-black/85 backdrop-blur border border-white/10 p-2 rounded-lg">
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
          className={`${btnClass} w-11 h-11 border-white/20 text-lg`}
          onTouchStart={onWave}
          aria-label="Saludar"
        >
          <span aria-hidden>👋</span>
        </button>

        {/* Instrucciones */}
        <button
          className={`${btnClass} w-11 h-11 border-white/20 text-white/60`}
          onTouchStart={openInstructions}
          aria-label="Cómo jugar"
        >
          <RiQuestionLine className="w-5 h-5" />
        </button>
      </div>

      {/* Abajo-derecha — Saltar (disparo y granada viven en la zona derecha) */}
      <div className="pointer-events-auto absolute bottom-6 right-4 touch-none">
        <button
          className={`${btnClass} w-16 h-16 border-[#00ff41]/40 text-[#00ff41]`}
          onTouchStart={onJump}
          aria-label="Saltar"
        >
          <RiArrowUpLine className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};
