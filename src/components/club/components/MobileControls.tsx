'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { RiArrowUpLine, RiHandHeartLine, RiLoopLeftLine, RiMusic2Line, RiScissorsCutLine, RiRefreshLine, RiHand2, RiFlashlightLine } from '@remixicon/react';
import { useScore, SPECIAL_THRESHOLDS } from '../ScoreContext';

function dispatchKey(key: string, type: 'keydown' | 'keyup') {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
}

const JOYSTICK_SIZE = 120;
const THUMB_SIZE = 48;
const DEADZONE = 10;

export const MobileControls: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const activeKeysRef = useRef<Set<string>>(new Set());
  const touchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

    // Release keys no longer active
    for (const k of activeKeysRef.current) {
      if (!newKeys.has(k)) dispatchKey(k, 'keyup');
    }
    // Press newly active keys
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

  const onActionDown = useCallback((key: string) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    dispatchKey(key, 'keydown');
    if (key === ' ') {
      setTimeout(() => dispatchKey(key, 'keyup'), 50);
    }
  }, []);

  const onActionUp = useCallback((key: string) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (key !== ' ') dispatchKey(key, 'keyup');
  }, []);

  const {
    specialCharges,
    unlockedSpecials,
    enabled,
    useSpecial,
  } = useScore();

  const SPECIAL_NAMES_ES = ['Onda', 'Spotlight', 'Confetti', 'Levitar', 'Terremoto'];

  const btnClass =
    'flex items-center justify-center rounded-full bg-black/50 backdrop-blur border border-white/20 text-white font-mono font-bold select-none active:bg-white/20 transition-colors';

  return (
    <div className="absolute inset-0 z-30 pointer-events-none touch-none">
      {/* Left side — Joystick, mobile only */}
      {isMobile && (
        <div className="pointer-events-auto absolute left-4 flex flex-col items-center gap-3 touch-none" style={{ bottom: 'calc(112px + env(safe-area-inset-bottom, 0px))' }}>
          {/* Joystick */}
          <div
            ref={joystickRef}
            className="rounded-full bg-white/10 backdrop-blur border border-white/20 touch-none"
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
      )}

      {/* Right side — Jump + Dance column above chat toggle, mobile only */}
      {isMobile && (
        <div className="pointer-events-auto absolute right-4 flex flex-row items-end gap-2 touch-none" style={{ bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}>
          {/* Jump button — left of dance column */}
          <button
            className={`${btnClass} w-14 h-14 border-[#00ff41]/40 text-[#00ff41]`}
            onTouchStart={onActionDown(' ')}
            onTouchEnd={onActionUp(' ')}
            onMouseDown={onActionDown(' ')}
            onMouseUp={onActionUp(' ')}
          >
            <RiArrowUpLine className="w-6 h-6" />
          </button>

          {/* Dance moves column */}
          <div className="flex flex-col gap-1.5">
            <button
              className={`${btnClass} w-10 h-10 border-[#ff0055]/40 text-[#ff0055]`}
              onTouchStart={onActionDown('1')}
              onTouchEnd={onActionUp('1')}
              onMouseDown={onActionDown('1')}
              onMouseUp={onActionUp('1')}
            >
              <RiHandHeartLine className="w-4 h-4" />
            </button>
            <button
              className={`${btnClass} w-10 h-10 border-[#ff0055]/40 text-[#ff0055]`}
              onTouchStart={onActionDown('2')}
              onTouchEnd={onActionUp('2')}
              onMouseDown={onActionDown('2')}
              onMouseUp={onActionUp('2')}
            >
              <RiLoopLeftLine className="w-4 h-4" />
            </button>
            <button
              className={`${btnClass} w-10 h-10 border-[#ff0055]/40 text-[#ff0055]`}
              onTouchStart={onActionDown('3')}
              onTouchEnd={onActionUp('3')}
              onMouseDown={onActionDown('3')}
              onMouseUp={onActionUp('3')}
            >
              <RiMusic2Line className="w-4 h-4" />
            </button>
            <button
              className={`${btnClass} w-10 h-10 border-[#ff0055]/40 text-[#ff0055]`}
              onTouchStart={onActionDown('4')}
              onTouchEnd={onActionUp('4')}
              onMouseDown={onActionDown('4')}
              onMouseUp={onActionUp('4')}
            >
              <RiScissorsCutLine className="w-4 h-4" />
            </button>
            <button
              className={`${btnClass} w-10 h-10 border-[#ff0055]/40 text-[#ff0055]`}
              onTouchStart={onActionDown('5')}
              onTouchEnd={onActionUp('5')}
              onMouseDown={onActionDown('5')}
              onMouseUp={onActionUp('5')}
            >
              <RiRefreshLine className="w-4 h-4" />
            </button>
            <button
              className={`${btnClass} w-10 h-10 border-[#00ccff]/40 text-[#00ccff]`}
              onTouchStart={onActionDown('6')}
              onTouchEnd={onActionUp('6')}
              onMouseDown={onActionDown('6')}
              onMouseUp={onActionUp('6')}
            >
              <RiHand2 className="w-4 h-4" />
            </button>
          </div>

          {/* Special moves */}
          {enabled && unlockedSpecials > 0 && (
            <div className="flex flex-col gap-1 w-[120px]">
              <div className="text-[8px] font-mono text-white/40 text-center">
                ESPECIALES {specialCharges > 0 && <span className="text-[#ff0055]">({specialCharges})</span>}
              </div>
              {SPECIAL_NAMES_ES.map((name, i) => {
                const unlocked = i < unlockedSpecials;
                const canUse = unlocked && specialCharges > 0;
                return (
                  <button
                    key={i}
                    onTouchStart={(e) => { e.preventDefault(); if (canUse) useSpecial(i); }}
                    disabled={!canUse}
                    className={`w-full px-2 py-1 text-[10px] font-mono flex items-center gap-1 transition-all border rounded ${
                      canUse
                        ? 'bg-black/70 border-[#ff0055]/50 text-[#ff0055] active:bg-[#ff0055]/20'
                        : unlocked
                          ? 'bg-black/50 border-white/10 text-white/30'
                          : 'bg-black/30 border-white/5 text-white/15'
                    }`}
                  >
                    <RiFlashlightLine className="w-3 h-3 shrink-0" />
                    <span className="flex-1 text-left">{unlocked ? name : `??? (${SPECIAL_THRESHOLDS[i]}pts)`}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Desktop: action buttons left of chat panel */}
      {!isMobile && (
        <div className="pointer-events-auto absolute bottom-4 right-[344px] flex flex-col items-center gap-3 touch-none">
          {/* Jump */}
          <button
            className={`${btnClass} w-14 h-14 border-[#00ff41]/40 text-[#00ff41]`}
            onTouchStart={onActionDown(' ')}
            onTouchEnd={onActionUp(' ')}
            onMouseDown={onActionDown(' ')}
            onMouseUp={onActionUp(' ')}
          >
            <RiArrowUpLine className="w-6 h-6" />
          </button>

          {/* Dance moves row */}
          <div className="flex gap-2">
            <button
              className={`${btnClass} w-11 h-11 border-[#ff0055]/40 text-[#ff0055]`}
              onTouchStart={onActionDown('1')}
              onTouchEnd={onActionUp('1')}
              onMouseDown={onActionDown('1')}
              onMouseUp={onActionUp('1')}
            >
              <RiHandHeartLine className="w-5 h-5" />
            </button>
            <button
              className={`${btnClass} w-11 h-11 border-[#ff0055]/40 text-[#ff0055]`}
              onTouchStart={onActionDown('2')}
              onTouchEnd={onActionUp('2')}
              onMouseDown={onActionDown('2')}
              onMouseUp={onActionUp('2')}
            >
              <RiLoopLeftLine className="w-5 h-5" />
            </button>
            <button
              className={`${btnClass} w-11 h-11 border-[#ff0055]/40 text-[#ff0055]`}
              onTouchStart={onActionDown('3')}
              onTouchEnd={onActionUp('3')}
              onMouseDown={onActionDown('3')}
              onMouseUp={onActionUp('3')}
            >
              <RiMusic2Line className="w-5 h-5" />
            </button>
            <button
              className={`${btnClass} w-11 h-11 border-[#ff0055]/40 text-[#ff0055]`}
              onTouchStart={onActionDown('4')}
              onTouchEnd={onActionUp('4')}
              onMouseDown={onActionDown('4')}
              onMouseUp={onActionUp('4')}
            >
              <RiScissorsCutLine className="w-5 h-5" />
            </button>
            <button
              className={`${btnClass} w-11 h-11 border-[#ff0055]/40 text-[#ff0055]`}
              onTouchStart={onActionDown('5')}
              onTouchEnd={onActionUp('5')}
              onMouseDown={onActionDown('5')}
              onMouseUp={onActionUp('5')}
            >
              <RiRefreshLine className="w-5 h-5" />
            </button>
            <button
              className={`${btnClass} w-11 h-11 border-[#00ccff]/40 text-[#00ccff]`}
              onTouchStart={onActionDown('6')}
              onTouchEnd={onActionUp('6')}
              onMouseDown={onActionDown('6')}
              onMouseUp={onActionUp('6')}
            >
              <RiHand2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
