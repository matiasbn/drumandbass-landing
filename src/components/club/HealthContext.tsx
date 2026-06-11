'use client';

import React, { createContext, useContext, useRef, useCallback, ReactNode } from 'react';

const MAX_HYPE = 100;
const HYPE_SHOT = 15;
const HYPE_GRENADE = 25;
const HYPE_DECAY = 3; // per second

export interface HypeState {
  hype: number;
  maxHype: number;
  hyped: boolean;
}

interface HealthContextType {
  /** Local player hype (ref to avoid re-renders) */
  localHypeRef: React.MutableRefObject<HypeState>;
  /** NPC hype map */
  npcHypeRef: React.MutableRefObject<Map<string, HypeState>>;
  /** Add hype to local player */
  addHype: (amount: number) => void;
  /** Add hype to NPC, returns true if NPC hit 100% (triggered hype drop) */
  addNpcHype: (npcId: string, amount: number) => boolean;
  /** Get hype amount for projectile type */
  getHypeAmount: (type: 'shot' | 'grenade') => number;
  /** Check if local player is in hyped state */
  isHyped: () => boolean;
  /** Decay hype over time — call from useFrame */
  decayHype: (dt: number) => void;
  /** Callback ref for hype hit */
  onHypeRef: React.MutableRefObject<(() => void) | null>;
  /** Callback ref for hype drop */
  onHypeDropRef: React.MutableRefObject<(() => void) | null>;
}

const HealthContext = createContext<HealthContextType | null>(null);

const makeHype = (): HypeState => ({ hype: 0, maxHype: MAX_HYPE, hyped: false });

export const HealthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const localHypeRef = useRef<HypeState>(makeHype());
  const npcHypeRef = useRef<Map<string, HypeState>>(new Map());
  const onHypeRef = useRef<(() => void) | null>(null);
  const onHypeDropRef = useRef<(() => void) | null>(null);
  const hypeDropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHypeDrop = useCallback(() => {
    const h = localHypeRef.current;
    h.hyped = true;
    h.hype = MAX_HYPE;
    onHypeDropRef.current?.();
    // Clear any existing timer
    if (hypeDropTimerRef.current) clearTimeout(hypeDropTimerRef.current);
    hypeDropTimerRef.current = setTimeout(() => {
      h.hyped = false;
      h.hype = 0;
      hypeDropTimerRef.current = null;
    }, 3000);
  }, []);

  const addHype = useCallback((amount: number) => {
    const h = localHypeRef.current;
    if (h.hyped) return; // Don't add hype during hype drop
    h.hype = Math.min(MAX_HYPE, h.hype + amount);
    onHypeRef.current?.();
    if (h.hype >= MAX_HYPE) {
      triggerHypeDrop();
    }
  }, [triggerHypeDrop]);

  const addNpcHype = useCallback((npcId: string, amount: number): boolean => {
    let h = npcHypeRef.current.get(npcId);
    if (!h) {
      h = makeHype();
      npcHypeRef.current.set(npcId, h);
    }
    if (h.hyped) return false;
    h.hype = Math.min(MAX_HYPE, h.hype + amount);
    if (h.hype >= MAX_HYPE) {
      h.hyped = true;
      h.hype = MAX_HYPE;
      // Reset NPC after 3 seconds
      setTimeout(() => {
        h!.hyped = false;
        h!.hype = 0;
      }, 3000);
      return true;
    }
    return false;
  }, []);

  const getHypeAmount = useCallback((type: 'shot' | 'grenade'): number => {
    return type === 'shot' ? HYPE_SHOT : HYPE_GRENADE;
  }, []);

  const isHyped = useCallback(() => localHypeRef.current.hyped, []);

  const decayHype = useCallback((dt: number) => {
    const h = localHypeRef.current;
    if (h.hyped || h.hype <= 0) return;
    h.hype = Math.max(0, h.hype - HYPE_DECAY * dt);
  }, []);

  return (
    <HealthContext.Provider value={{
      localHypeRef, npcHypeRef, addHype, addNpcHype,
      getHypeAmount, isHyped, decayHype, onHypeRef, onHypeDropRef,
    }}>
      {children}
    </HealthContext.Provider>
  );
};

export const useHealth = () => {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealth must be used within HealthProvider');
  return ctx;
};

export { MAX_HYPE };
