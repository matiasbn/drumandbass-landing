'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { RiArrowUpLine, RiHandHeartLine, RiLoopLeftLine, RiMusic2Line } from '@remixicon/react';

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
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
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

  const onActionDown = useCallback((key: string) => (e: React.TouchEvent) => {
    e.preventDefault();
    dispatchKey(key, 'keydown');
    if (key === ' ') {
      // Jump is a one-shot, release immediately
      setTimeout(() => dispatchKey(key, 'keyup'), 50);
    }
  }, []);

  const onActionUp = useCallback((key: string) => (e: React.TouchEvent) => {
    e.preventDefault();
    if (key !== ' ') dispatchKey(key, 'keyup');
  }, []);

  if (!isMobile) return null;

  const btnClass =
    'flex items-center justify-center rounded-full bg-black/50 backdrop-blur border border-white/20 text-white font-mono font-bold select-none active:bg-white/20 transition-colors';

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* Joystick — bottom left */}
      <div
        ref={joystickRef}
        className="pointer-events-auto absolute bottom-28 left-6 rounded-full bg-white/10 backdrop-blur border border-white/20"
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

      {/* Action buttons — bottom right */}
      <div className="pointer-events-auto absolute bottom-28 right-6 flex flex-col items-center gap-3">
        {/* Jump */}
        <button
          className={`${btnClass} w-14 h-14 border-[#00ff41]/40 text-[#00ff41]`}
          onTouchStart={onActionDown(' ')}
          onTouchEnd={onActionUp(' ')}
        >
          <RiArrowUpLine className="w-6 h-6" />
        </button>

        {/* Dance moves row */}
        <div className="flex gap-2">
          <button
            className={`${btnClass} w-11 h-11 border-[#ff0055]/40 text-[#ff0055]`}
            onTouchStart={onActionDown('1')}
            onTouchEnd={onActionUp('1')}
          >
            <RiHandHeartLine className="w-5 h-5" />
          </button>
          <button
            className={`${btnClass} w-11 h-11 border-[#ff0055]/40 text-[#ff0055]`}
            onTouchStart={onActionDown('2')}
            onTouchEnd={onActionUp('2')}
          >
            <RiLoopLeftLine className="w-5 h-5" />
          </button>
          <button
            className={`${btnClass} w-11 h-11 border-[#ff0055]/40 text-[#ff0055]`}
            onTouchStart={onActionDown('3')}
            onTouchEnd={onActionUp('3')}
          >
            <RiMusic2Line className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
