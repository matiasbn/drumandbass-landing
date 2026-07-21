'use client';

// Calidad gráfica del club (WS-3): Alta / Media / Baja, persistida en localStorage.
// - Alta:  Bloom + dpr hasta 1.5
// - Media: Bloom + dpr 1
// - Baja:  sin Bloom, strobes simples, partículas ÷2, shake off (lo lee juice.ts vía qualityRef)
// Módulo singleton sin React state por frame: los loops calientes leen qualityRef,
// los componentes que necesitan re-render usan useQuality().

import { useSyncExternalStore } from 'react';

export type Quality = 'alta' | 'media' | 'baja';

const STORAGE_KEY = 'dnb_quality';

function load(): Quality {
  if (typeof window === 'undefined') return 'alta';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'media' || stored === 'baja' ? stored : 'alta';
}

/** Ref caliente para loops de frame (juice/partículas): cero suscripciones */
export const qualityRef: { current: Quality } = { current: load() };

const listeners = new Set<() => void>();

export function getQuality(): Quality {
  return qualityRef.current;
}

export function setQuality(q: Quality): void {
  if (qualityRef.current === q) return;
  qualityRef.current = q;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, q);
  }
  listeners.forEach((fn) => fn());
}

export function subscribeQuality(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Hook React: re-renderiza al cambiar la calidad (aplicación en vivo, sin recargar) */
export function useQuality(): Quality {
  return useSyncExternalStore(subscribeQuality, getQuality, () => 'alta');
}
