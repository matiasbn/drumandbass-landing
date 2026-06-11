'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { RiArrowUpLine, RiCrosshair2Line, RiBattery2ChargeLine, RiMusic2Line } from '@remixicon/react';
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

// Camera look zone
const LOOK_SENSITIVITY = 0.006;

export const MobileControls: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [danceMenuOpen, setDanceMenuOpen] = useState(false);
  const { cameraYawRef, cameraPitchRef } = useCamera();

  // Joystick refs
  const joystickRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const activeKeysRef = useRef<Set<string>>(new Set());
  const touchIdRef = useRef<number | null>(null);

  // Camera look refs
  const lookTouchIdRef = useRef<number | null>(null);
  const lookLastXRef = useRef(0);
  const lookLastYRef = useRef(0);

  // Grenade charge refs
  const grenadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grenadeChargingRef = useRef(false);

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

  // --- Joystick (left side) ---
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

  // --- Camera look (right side touch area) ---
  const onLookTouchStart = useCallback((e: React.TouchEvent) => {
    if (lookTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchIdRef.current = touch.identifier;
    lookLastXRef.current = touch.clientX;
    lookLastYRef.current = touch.clientY;
  }, []);

  const onLookTouchMove = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        const dx = touch.clientX - lookLastXRef.current;
        const dy = touch.clientY - lookLastYRef.current;
        cameraYawRef.current -= dx * LOOK_SENSITIVITY;
        cameraPitchRef.current = Math.max(-0.3, Math.min(1.2, cameraPitchRef.current + dy * LOOK_SENSITIVITY));
        lookLastXRef.current = touch.clientX;
        lookLastYRef.current = touch.clientY;
        return;
      }
    }
  }, [cameraYawRef, cameraPitchRef]);

  const onLookTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        return;
      }
    }
  }, []);

  // --- Action buttons ---
  const onShoot = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    dispatchMouse(0, 'mousedown');
    setTimeout(() => dispatchMouse(0, 'mouseup'), 50);
  }, []);

  const onGrenadeStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    grenadeChargingRef.current = true;
    dispatchMouse(2, 'mousedown');
  }, []);

  const onGrenadeEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (grenadeChargingRef.current) {
      grenadeChargingRef.current = false;
      dispatchMouse(2, 'mouseup');
    }
  }, []);

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
      {/* Left side — Joystick */}
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

      {/* Right side — Camera look zone (invisible, covers right half) */}
      <div
        className="pointer-events-auto absolute touch-none"
        style={{ top: 0, right: 0, bottom: 0, width: '50%' }}
        onTouchStart={onLookTouchStart}
        onTouchMove={onLookTouchMove}
        onTouchEnd={onLookTouchEnd}
        onTouchCancel={onLookTouchEnd}
      />

      {/* Right side — Action buttons */}
      <div className="pointer-events-auto absolute bottom-6 right-4 flex items-end gap-3 touch-none">
        {/* Grenade (hold) */}
        <button
          className={`${btnClass} w-14 h-14 border-[#ff8800]/40 text-[#ff8800]`}
          onTouchStart={onGrenadeStart}
          onTouchEnd={onGrenadeEnd}
          onTouchCancel={onGrenadeEnd}
        >
          <RiBattery2ChargeLine className="w-6 h-6" />
        </button>

        {/* Shoot */}
        <button
          className={`${btnClass} w-16 h-16 border-[#ff0055]/50 text-[#ff0055]`}
          onTouchStart={onShoot}
        >
          <RiCrosshair2Line className="w-7 h-7" />
        </button>

        {/* Jump */}
        <button
          className={`${btnClass} w-14 h-14 border-[#00ff41]/40 text-[#00ff41]`}
          onTouchStart={onJump}
        >
          <RiArrowUpLine className="w-6 h-6" />
        </button>
      </div>

      {/* Dance menu toggle — top right */}
      <div className="pointer-events-auto absolute top-4 right-4 touch-none">
        <button
          className={`${btnClass} w-10 h-10 ${danceMenuOpen ? 'border-[#ff0055]/60 text-[#ff0055] bg-[#ff0055]/10' : 'border-white/20 text-white/60'}`}
          onTouchStart={(e) => { e.preventDefault(); setDanceMenuOpen(o => !o); }}
        >
          <RiMusic2Line className="w-5 h-5" />
        </button>

        {/* Dance radial menu */}
        {danceMenuOpen && (
          <div className="absolute top-12 right-0 flex flex-col gap-1.5 bg-black/80 backdrop-blur border border-white/10 p-2 rounded-lg">
            {['Hands Up', 'Spin', 'Headbang', 'Split', 'Backflip'].map((name, i) => (
              <button
                key={i}
                className="px-3 py-1.5 text-xs font-mono text-[#ff0055] border border-[#ff0055]/30 rounded active:bg-[#ff0055]/20"
                onTouchStart={onDance(String(i + 1))}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
